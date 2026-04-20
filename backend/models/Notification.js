const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'prescription_processed',
      'quote_received',
      'quote_accepted',
      'quote_rejected',
      'order_confirmed',
      'order_preparing',
      'order_dispatched',
      'order_delivered',
      'order_pickup_ready',
      'order_picked_up',
      'order_completed',
      'order_cancelled',
      'order_expired',
      'fulfillment_changed',
      'new_message',
      'pharmacy_approved',
      'system',
    ],
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  isRead: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
