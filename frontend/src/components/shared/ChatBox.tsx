import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

interface Message {
  _id: string;
  sender: { _id: string; name: string; role: string };
  senderRole: string;
  content: string;
  createdAt: string;
  roomKey?: string;
}

interface Props {
  prescriptionId: string;
  pharmacyId?:    string;
  pharmacyName?:  string;
  compact?:       boolean;
}

export default function ChatBox({ prescriptionId, pharmacyId, pharmacyName, compact }: Props) {
  const { user }  = useAuth();
  const socket    = useSocket();
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIds     = useRef<Set<string>>(new Set()); // dedup guard

  // Room key — same formula as server
  const roomKey = pharmacyId
    ? `${prescriptionId}_${pharmacyId}`
    : prescriptionId;

  // ── Load history ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    seenIds.current.clear();
    chatAPI.getMessages(prescriptionId, pharmacyId)
      .then(r => {
        const msgs: Message[] = r.data.messages;
        msgs.forEach(m => seenIds.current.add(m._id));
        setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [prescriptionId, pharmacyId]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Join this specific chat room
    socket.emit('join_room', roomKey);

    const onMsg = (msg: Message) => {
      // Dedup: ignore if already in list
      if (seenIds.current.has(msg._id)) return;
      // Scope check: only show messages that belong to this room
      if (msg.roomKey && msg.roomKey !== roomKey) return;
      seenIds.current.add(msg._id);
      setMessages(prev => [...prev, msg]);
    };

    const onTyping = (data: any) => {
      if (data.userId !== user?._id && data.roomKey === roomKey) {
        setTypingUser(data.name);
      }
    };

    const onStopTyping = (data: any) => {
      if (data.roomKey === roomKey) setTypingUser(null);
    };

    socket.on('new_message',      onMsg);
    socket.on('user_typing',      onTyping);
    socket.on('user_stop_typing', onStopTyping);

    return () => {
      socket.off('new_message',      onMsg);
      socket.off('user_typing',      onTyping);
      socket.off('user_stop_typing', onStopTyping);
    };
  }, [socket, roomKey, user?._id]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Typing indicator ─────────────────────────────────────────────────────
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    socket?.emit('typing', { roomKey });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => socket?.emit('stop_typing', { roomKey }),
      2000
    );
  };

  // ── Send message ─────────────────────────────────────────────────────────
  // KEY FIX: We add the message to local state IMMEDIATELY (optimistic update)
  // and also send via socket. The socket event from server will be deduped.
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    // Optimistic: add to UI right away
    const tempId  = `temp_${Date.now()}`;
    const tempMsg: Message = {
      _id:       tempId,
      sender:    { _id: user!._id, name: user!.name, role: user!.role },
      senderRole: user!.role,
      content:   text,
      createdAt: new Date().toISOString(),
      roomKey,
    };
    seenIds.current.add(tempId);
    setMessages(prev => [...prev, tempMsg]);

    try {
      if (socket?.connected) {
        // Primary: send via socket
        socket.emit('send_message', {
          prescriptionId,
          pharmacyId: pharmacyId || null,
          content:    text,
        });
        // Server will broadcast back — dedup guard prevents duplicate
      } else {
        // Fallback: REST API
        const { data } = await chatAPI.send(prescriptionId, text, pharmacyId);
        // Replace temp message with real one from server
        const realMsg = data.message;
        seenIds.current.add(realMsg._id);
        setMessages(prev => prev.map(m => m._id === tempId ? { ...realMsg, roomKey } : m));
      }
    } catch {
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setInput(text); // restore input
    }

    setSending(false);
  }, [input, sending, socket, prescriptionId, pharmacyId, roomKey, user]);

  // ── Bubble styling ───────────────────────────────────────────────────────
  const bubbleClass = (role: string, isMe: boolean) => {
    if (isMe) return 'bg-primary-600 text-white rounded-2xl rounded-br-sm';
    if (role === 'pharmacy') return 'bg-teal-50 text-teal-900 border border-teal-100 rounded-2xl rounded-bl-sm';
    if (role === 'admin')    return 'bg-purple-50 text-purple-900 border border-purple-100 rounded-2xl rounded-bl-sm';
    return 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm';
  };

  const roleLabel = (role: string) =>
    ({ patient: 'Patient', pharmacy: 'Pharmacy', admin: 'Admin' }[role] ?? role);

  return (
    <div className={`flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white
      ${compact ? 'h-72' : 'h-[460px]'}`}>

      {/* Header */}
      <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center gap-2 flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-primary-500" />
        <span className="text-sm font-semibold text-gray-700">
          {pharmacyName ? `Chat — ${pharmacyName}` : 'Prescription Chat'}
        </span>
        <div className={`ml-auto w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-400' : 'bg-gray-300'}`}
          title={socket?.connected ? 'Connected' : 'Offline'} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-10">
            <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.sender._id === user?._id;
          const isTemp = msg._id.startsWith('temp_');
          return (
            <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[78%]`}>
                {!isMe && (
                  <span className="text-[11px] text-gray-400 mb-0.5 ml-1">
                    {msg.sender.name} · {roleLabel(msg.senderRole || msg.sender.role)}
                  </span>
                )}
                <div className={`px-3 py-2 text-sm leading-relaxed ${bubbleClass(msg.sender.role, isMe)} ${isTemp ? 'opacity-70' : ''}`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                  {format(new Date(msg.createdAt), 'h:mm a')}
                  {isMe && isTemp && <span className="text-gray-300">· sending…</span>}
                  {isMe && !isTemp && <span className="text-primary-300">✓</span>}
                </span>
              </div>
            </div>
          );
        })}

        {typingUser && (
          <div className="flex items-center gap-2 text-xs text-gray-400 pl-1">
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            {typingUser} is typing…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t bg-white flex gap-2 flex-shrink-0">
        <input
          className="input flex-1 text-sm py-2"
          placeholder="Type a message…"
          value={input}
          onChange={handleInput}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="btn-primary px-3 py-2 flex items-center justify-center min-w-[40px]"
        >
          {sending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  );
}
