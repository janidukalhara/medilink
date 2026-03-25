const User = require('../models/User');
const PharmacyInventory = require('../models/PharmacyInventory');
const Quotation = require('../models/Quotation');
const Prescription = require('../models/Prescription');

// ─── PROXIMITY: Find nearby pharmacies ────────────────────────────────────────
exports.getNearbyPharmacies = async (req, res) => {
  try {
    const { lat, lng, radiusKm = 15, limit = 20 } = req.query;

    if (!lat || !lng) {
      // Fallback: return all approved pharmacies (no coordinates given)
      const pharmacies = await User.find({ role: 'pharmacy', isApproved: true, isActive: true })
        .select('name pharmacyProfile phone email')
        .limit(Number(limit));
      return res.json({ pharmacies, source: 'all' });
    }

    const radiusMeters = Number(radiusKm) * 1000;

    const pharmacies = await User.find({
      role: 'pharmacy',
      isApproved: true,
      isActive: true,
      'pharmacyProfile.location': {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: radiusMeters,
        },
      },
    })
      .select('name pharmacyProfile phone email')
      .limit(Number(limit));

    res.json({ pharmacies, source: 'nearby', radiusKm: Number(radiusKm) });
  } catch (err) {
    // If geo index not ready, fall back gracefully
    const pharmacies = await User.find({ role: 'pharmacy', isApproved: true, isActive: true })
      .select('name pharmacyProfile phone email')
      .limit(20);
    res.json({ pharmacies, source: 'fallback', error: err.message });
  }
};

// ─── INVENTORY: Pharmacy manages its own stock ────────────────────────────────
exports.getInventory = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = { pharmacy: req.user._id };
    if (search) {
      query.$or = [
        { medicineName: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await PharmacyInventory.countDocuments(query);
    const items = await PharmacyInventory.find(query)
      .sort({ medicineName: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ items, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addInventoryItem = async (req, res) => {
  try {
    const item = await PharmacyInventory.create({ ...req.body, pharmacy: req.user._id });
    res.status(201).json({ item });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateInventoryItem = async (req, res) => {
  try {
    const item = await PharmacyInventory.findOneAndUpdate(
      { _id: req.params.id, pharmacy: req.user._id },
      req.body, { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteInventoryItem = async (req, res) => {
  try {
    await PharmacyInventory.findOneAndDelete({ _id: req.params.id, pharmacy: req.user._id });
    res.json({ message: 'Item removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── AUTO-QUOTATION: Generate quotation from inventory ────────────────────────
exports.autoGenerateQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;

    const quotation = await Quotation.findOne({ _id: quotationId, pharmacy: req.user._id })
      .populate('prescription', 'extractedMedicines');

    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const medicines = quotation.prescription?.extractedMedicines || [];
    if (!medicines.length) return res.status(400).json({ error: 'No medicines to quote' });

    const autoItems = [];
    let totalMatched = 0;

    for (const med of medicines) {
      // Fuzzy search in pharmacy inventory
      const inventoryItem = await PharmacyInventory.findOne({
        pharmacy: req.user._id,
        isAvailable: true,
        $or: [
          { medicineName: { $regex: new RegExp(med.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
          { genericName: { $regex: new RegExp(med.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
          { aliases: { $regex: new RegExp(med.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
        ],
      });

      const qty = med.quantity || 1;

      if (inventoryItem && inventoryItem.stockQuantity >= qty) {
        autoItems.push({
          medicineName: inventoryItem.medicineName,
          originalName: med.name,
          available: true,
          unitPrice: inventoryItem.unitPrice,
          quantity: qty,
          totalPrice: inventoryItem.unitPrice * qty,
          notes: inventoryItem.dosageStrength ? `Available: ${inventoryItem.dosageStrength}` : '',
        });
        totalMatched++;
      } else {
        // Not in stock — look for partial match (different strength)
        const anyMatch = await PharmacyInventory.findOne({
          pharmacy: req.user._id,
          $or: [
            { medicineName: { $regex: med.name.split(' ')[0], $options: 'i' } },
            { genericName: { $regex: med.name.split(' ')[0], $options: 'i' } },
          ],
        });

        autoItems.push({
          medicineName: anyMatch ? anyMatch.medicineName : med.name,
          originalName: med.name,
          available: !!anyMatch,
          unitPrice: anyMatch ? anyMatch.unitPrice : 0,
          quantity: qty,
          totalPrice: anyMatch ? anyMatch.unitPrice * qty : 0,
          substitute: anyMatch ? anyMatch.medicineName : '',
          notes: anyMatch ? `Substitute available: ${anyMatch.medicineName}` : 'Not in stock',
        });
      }
    }

    // Calculate totals
    const subtotal = autoItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const deliveryFee = req.user.pharmacyProfile?.isDeliveryAvailable ? 150 : 0;

    const summary = {
      items: autoItems,
      subtotal,
      deliveryFee,
      totalAmount: subtotal + deliveryFee,
      isDeliveryAvailable: req.user.pharmacyProfile?.isDeliveryAvailable || false,
      estimatedTime: '2-4 hours',
      matchRate: medicines.length > 0 ? Math.round((totalMatched / medicines.length) * 100) : 0,
      autoGenerated: true,
    };

    res.json({ summary, message: `Auto-generated: ${totalMatched}/${medicines.length} medicines matched from your inventory` });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
