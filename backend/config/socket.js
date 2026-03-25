const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

module.exports = (io) => {
  // ── Auth middleware ──────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.user.name} (${socket.user.role})`);
    socket.join(`user_${socket.user.id}`);

    // ── Join room ──────────────────────────────────────────────────────────
    // roomKey format:  "prescriptionId"  OR  "prescriptionId_pharmacyId"
    socket.on('join_room', (roomKey) => {
      socket.join(`room_${roomKey}`);
      console.log(`📎 ${socket.user.name} joined room: ${roomKey}`);
    });

    // ── Send message ───────────────────────────────────────────────────────
    // data = { prescriptionId, pharmacyId?, content }
    // prescriptionId is ALWAYS the real MongoDB prescription _id
    // pharmacyId scopes the chat thread
    socket.on('send_message', async (data) => {
      try {
        const { prescriptionId, pharmacyId, content } = data;

        // Determine pharmacyId for scoping
        let scopedPharmacyId = pharmacyId || null;
        if (socket.user.role === 'pharmacy') scopedPharmacyId = socket.user.id;

        // Save to DB
        const message = await Message.create({
          prescriptionId,
          pharmacyId: scopedPharmacyId,
          sender:     socket.user.id,
          senderRole: socket.user.role,
          content,
        });
        const populated = await message.populate('sender', 'name role');

        // Build room key
        const roomKey = scopedPharmacyId
          ? `${prescriptionId}_${scopedPharmacyId}`
          : prescriptionId;

        // Emit to ALL in room (including sender) — room_${roomKey}
        io.to(`room_${roomKey}`).emit('new_message', {
          _id:        populated._id,
          sender:     populated.sender,
          senderRole: populated.senderRole,
          content:    populated.content,
          createdAt:  populated.createdAt,
          roomKey,
        });

      } catch (err) {
        console.error('send_message error:', err.message);
        socket.emit('message_error', { error: 'Message failed to send' });
      }
    });

    // ── Typing ─────────────────────────────────────────────────────────────
    socket.on('typing', ({ roomKey }) => {
      socket.to(`room_${roomKey}`).emit('user_typing', {
        userId: socket.user.id,
        name:   socket.user.name,
        roomKey,
      });
    });

    socket.on('stop_typing', ({ roomKey }) => {
      socket.to(`room_${roomKey}`).emit('user_stop_typing', {
        userId: socket.user.id,
        roomKey,
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.user.name}`);
    });
  });
};
