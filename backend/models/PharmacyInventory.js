const mongoose = require('mongoose');

/**
 * Pharmacy Medicine Inventory
 * Each pharmacy maintains its own stock database used for auto-quotation
 */
const inventoryItemSchema = new mongoose.Schema({
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  medicineName: { type: String, required: true, trim: true },
  genericName: { type: String, trim: true },
  brand: { type: String, trim: true },
  category: { type: String },
  form: { type: String, enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'] },
  dosageStrength: { type: String },          // e.g. "500mg"
  unitPrice: { type: Number, required: true, min: 0 },
  stockQuantity: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true },
  aliases: [String],                          // Other names this pharmacy lists it under
}, { timestamps: true });

// Compound index for fast medicine name lookup per pharmacy
inventoryItemSchema.index({ pharmacy: 1, medicineName: 1 });
inventoryItemSchema.index({ pharmacy: 1, isAvailable: 1 });

module.exports = mongoose.model('PharmacyInventory', inventoryItemSchema);
