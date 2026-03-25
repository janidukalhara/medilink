const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: String, frequency: String, duration: String,
  quantity: Number, instructions: String,
  category: String, confidence: { type: Number, default: 0 },
});

const prescriptionSchema = new mongoose.Schema({
  patient:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  imageUrl:      { type: String, required: true },
  imagePublicId: String,

  ocrRawText:           String,
  ocrConfidence:        { type: Number, default: 0 },
  writingStyle:         mongoose.Schema.Types.Mixed,
  extractedMedicines:   [medicineSchema],
  patientInfoExtracted: { name: String, age: Number, gender: String },
  doctorName:           String,
  doctorRegNo:          String,
  hospitalName:         String,
  prescriptionDate:     String,

  status: {
    type: String,
    enum: [
      'processing',       // AI OCR running
      'extracted',        // AI done, patient reviewing
      'quote_requested',  // Sent to pharmacies
      'quotes_received',  // At least one quote received
      'accepted',         // Patient accepted a quote
      'confirmed',        // Pharmacy confirmed the order
      'preparing',        // Pharmacy preparing medicines
      'dispatched',       // Out for delivery
      'delivered',        // Delivered to patient
      'pickup_ready',     // Ready for patient to collect (pharmacy pickup)
      'completed',        // Patient confirmed receipt (delivered OR pickup collected)
      'cancelled',        // Cancelled
      'failed',           // OCR/AI failed
    ],
    default: 'processing',
  },

  // Fulfillment type set by pharmacy
  fulfillmentType: {
    type: String,
    enum: ['delivery', 'pickup'],
    default: 'delivery',
  },

  // Timestamps for key events
  acceptedAt:   Date,
  completedAt:  Date,

  ocrProcessingError: String,
  selectedQuotation:  { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  notes:              String,
  isUrgent:           { type: Boolean, default: false },
  sentToPharmacies:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

prescriptionSchema.index({ patient: 1, status: 1 });
prescriptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
