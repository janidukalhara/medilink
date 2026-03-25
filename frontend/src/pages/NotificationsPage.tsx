import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { notificationAPI } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await notificationAPI.getAll();
      setNotifications(data.notifications);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await notificationAPI.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    toast.success('All marked as read');
  };

  const markRead = async (id: string) => {
    await notificationAPI.markRead(id);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const typeIcon: Record<string, string> = {
    prescription_processed: '🔬', quote_received: '💰', quote_accepted: '✅',
    order_confirmed: '📦', order_dispatched: '🚚', order_delivered: '🎉',
    pharmacy_approved: '🏥', new_message: '💬',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary-600" /> Notifications
        </h1>
        {notifications.some(n => !n.isRead) && (
          <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-1">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n._id}
              onClick={() => !n.isRead && markRead(n._id)}
              className={`p-4 rounded-xl border cursor-pointer transition-colors ${n.isRead ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{typeIcon[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium text-sm ${n.isRead ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</p>
                    {!n.isRead && <div className="w-2 h-2 bg-primary-500 rounded-full ml-2 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{format(new Date(n.createdAt), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
