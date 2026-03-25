const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true },
  // pharmacyId scopes the chat to one specific pharmacy-patient pair
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['patient', 'pharmacy', 'admin'] },
  content: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });

messageSchema.index({ prescriptionId: 1, pharmacyId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
