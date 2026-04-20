const User = require('../models/User');
const PharmacyInventory = require('../models/PharmacyInventory');
const Quotation = require('../models/Quotation');
const Prescription = require('../models/Prescription');

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── SMART PHARMACY MATCHING ───────────────────────────────────────────────────
// Priority:
//   1. Same Grama Niladhari division (exact GN match)
//   2. Within 3 km radius
//   3. Expand to 5 km if fewer than 2 pharmacies found in 3 km
//   4. Fall back to same district
exports.getNearbyPharmacies = async (req, res) => {
  try {
    const { lat, lng, prescriptionId, limit = 20 } = req.query;

    // Base query — only approved & active pharmacies
    const baseQuery = { role: 'pharmacy', isApproved: true, isActive: true };

    // ── If patient coords + prescriptionId: smart GN + radius matching ──
    if (lat && lng && prescriptionId) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      // Get patient's GN division from their profile
      const patient = await User.findById(req.user._id).select('patientProfile');
      const patientGN = patient?.patientProfile?.gramaNiladhari?.divisionName || '';
      const patientDistrict = patient?.patientProfile?.district || '';

      // Load all approved pharmacies
      const allPharmacies = await User.find(baseQuery)
        .select('name pharmacyProfile phone email')
        .limit(200);

      // Score each pharmacy
      const scored = allPharmacies.map(p => {
        const coords = p.pharmacyProfile?.location?.coordinates;
        const pharmLat = coords?.[1];
        const pharmLng = coords?.[0];
        const pharmGN = p.pharmacyProfile?.gramaNiladhari?.divisionName || '';
        const pharmDistrict = p.pharmacyProfile?.district || '';

        let distanceKm = Infinity;
        if (pharmLat && pharmLng) {
          distanceKm = haversineKm(userLat, userLng, pharmLat, pharmLng);
        }

        const gnMatch = patientGN && pharmGN &&
          patientGN.toLowerCase() === pharmGN.toLowerCase();
        const districtMatch = patientDistrict &&
          pharmDistrict.toLowerCase() === patientDistrict.toLowerCase();

        return { pharmacy: p, distanceKm, gnMatch, districtMatch };
      });

      // Tier 1: exact GN match
      const gnMatched = scored.filter(s => s.gnMatch);

      // Tier 2: within 3 km
      const within3km = scored.filter(s => s.distanceKm <= 3);

      // Tier 3: within 5 km (fallback)
      const within5km = scored.filter(s => s.distanceKm <= 5);

      // Tier 4: same district
      const sameDistrict = scored.filter(s => s.districtMatch);

      // Merge tiers — deduplicate by _id, preserve priority order
      const seen = new Set();
      const merged = [];

      const addTier = (tier, label) => {
        tier.forEach(s => {
          const id = s.pharmacy._id.toString();
          if (!seen.has(id)) {
            seen.add(id);
            merged.push({ ...s, matchTier: label });
          }
        });
      };

      addTier(gnMatched, 'gn_match');
      addTier(within3km, '3km');
      addTier(within5km, '5km');
      addTier(sameDistrict, 'district');

      // If still empty, return all
      if (merged.length === 0) {
        scored.forEach(s => {
          merged.push({ ...s, matchTier: 'all' });
        });
      }

      const result = merged.slice(0, Number(limit)).map(s => ({
        ...s.pharmacy.toObject(),
        _matchTier: s.matchTier,
        _distanceKm: s.distanceKm === Infinity ? null : parseFloat(s.distanceKm.toFixed(2)),
        _gnMatch: s.gnMatch,
      }));

      return res.json({
        pharmacies: result,
        source: 'smart_match',
        patientGN: patientGN || null,
        patientDistrict: patientDistrict || null,
        summary: {
          gnMatch: result.filter(p => p._matchTier === 'gn_match').length,
          within3km: result.filter(p => p._matchTier === '3km').length,
          within5km: result.filter(p => p._matchTier === '5km').length,
          district: result.filter(p => p._matchTier === 'district').length,
        },
      });
    }

    // ── Simple fallback: no coords given ──
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      try {
        const pharmacies = await User.find({
          ...baseQuery,
          'pharmacyProfile.location': {
            $near: {
              $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
              $maxDistance: 15000,
            },
          },
        }).select('name pharmacyProfile phone email').limit(Number(limit));
        return res.json({ pharmacies, source: 'nearby' });
      } catch {
        // geo index not ready — fall through
      }
    }

    // ── No coords: return all ──
    const pharmacies = await User.find(baseQuery)
      .select('name pharmacyProfile phone email')
      .limit(Number(limit));
    return res.json({ pharmacies, source: 'all' });

  } catch (err) {
    const pharmacies = await User.find({ role: 'pharmacy', isApproved: true, isActive: true })
      .select('name pharmacyProfile phone email').limit(20);
    res.json({ pharmacies, source: 'fallback', error: err.message });
  }
};

// ─── INVENTORY ────────────────────────────────────────────────────────────────
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

// ─── AUTO-QUOTATION ────────────────────────────────────────────────────────────
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
      const safeRegex = new RegExp(med.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const inventoryItem = await PharmacyInventory.findOne({
        pharmacy: req.user._id,
        isAvailable: true,
        $or: [
          { medicineName: safeRegex },
          { genericName: safeRegex },
          { aliases: safeRegex },
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
        const firstWord = new RegExp(med.name.split(' ')[0], 'i');
        const anyMatch = await PharmacyInventory.findOne({
          pharmacy: req.user._id,
          $or: [{ medicineName: firstWord }, { genericName: firstWord }],
        });
        autoItems.push({
          medicineName: anyMatch ? anyMatch.medicineName : med.name,
          originalName: med.name,
          available: !!anyMatch,
          unitPrice: anyMatch ? anyMatch.unitPrice : 0,
          quantity: qty,
          totalPrice: anyMatch ? anyMatch.unitPrice * qty : 0,
          substitute: anyMatch ? anyMatch.medicineName : '',
          notes: anyMatch ? `Substitute: ${anyMatch.medicineName}` : 'Not in stock',
        });
      }
    }

    const subtotal = autoItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const deliveryFee = req.user.pharmacyProfile?.isDeliveryAvailable ? 150 : 0;

    res.json({
      summary: {
        items: autoItems, subtotal, deliveryFee,
        totalAmount: subtotal + deliveryFee,
        isDeliveryAvailable: req.user.pharmacyProfile?.isDeliveryAvailable || false,
        estimatedTime: '2-4 hours',
        matchRate: medicines.length > 0 ? Math.round((totalMatched / medicines.length) * 100) : 0,
        autoGenerated: true,
      },
      message: `Auto-generated: ${totalMatched}/${medicines.length} medicines matched`,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
