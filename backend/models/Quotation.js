const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  medicineName: { type: String, required: true },
  originalName: String,
  available:    { type: Boolean, default: true },
  unitPrice:    Number,
  quantity:     Number,
  totalPrice:   Number,
  notes:        String,
  substitute:   String,
});

const quotationSchema = new mongoose.Schema({
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true },
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pharmacy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  items:       [quotationItemSchema],
  subtotal:    { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  isDeliveryAvailable: { type: Boolean, default: false },
  estimatedTime:       String,
  validUntil:          Date,
  notes:               String,

  // Fulfillment
  fulfillmentType: {
    type:    String,
    enum:    ['delivery', 'pickup'],
    default: 'delivery',
  },

  // Pharmacy-side order flow status
  orderStatus: {
    type: String,
    enum: [
      'pending',        // waiting for pharmacy to quote
      'submitted',      // quote sent to patient
      'accepted',       // patient accepted this quote
      'rejected',       // patient rejected / chose another
      'confirmed',      // pharmacy confirmed they will fulfill
      'preparing',      // pharmacy preparing medicines
      // ── Delivery path ──
      'dispatched',     // out for delivery
      'delivered',      // pharmacy marks as delivered
      // ── Pickup path ──
      'pickup_ready',   // pharmacy marks medicines ready for collection
      'picked_up',      // pharmacy marks patient has collected
      // ── Final states ──
      'completed',      // patient confirmed receipt (closes order)
      'cancelled',      // cancelled
      'expired',        // quote expired without acceptance
    ],
    default: 'pending',
  },

  acceptedAt:    Date,
  rejectedAt:    Date,
  completedAt:   Date,
}, { timestamps: true });

quotationSchema.index({ prescription: 1, pharmacy: 1 });
quotationSchema.index({ patient: 1, orderStatus: 1 });

module.exports = mongoose.model('Quotation', quotationSchema);
