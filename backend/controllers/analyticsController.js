const Prescription = require('../models/Prescription');
const Quotation = require('../models/Quotation');

// ─── Patient analytics ────────────────────────────────────────────────────────
exports.getPatientAnalytics = async (req, res) => {
  try {
    const patientId = req.user._id;
    const [total, byStatus, recentPrescriptions] = await Promise.all([
      Prescription.countDocuments({ patient: patientId }),
      Prescription.aggregate([
        { $match: { patient: patientId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Prescription.find({ patient: patientId }).sort({ createdAt: -1 }).limit(5),
    ]);
    res.json({ total, byStatus, recentPrescriptions });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Pharmacy analytics ───────────────────────────────────────────────────────
// Handles both old docs (status field) and new docs (orderStatus field)
exports.getPharmacyAnalytics = async (req, res) => {
  try {
    const pharmacyId = req.user._id;

    // Queries that match BOTH old field (status) and new field (orderStatus)
    const acceptedStatuses = ['accepted','confirmed','preparing','dispatched',
                              'delivered','pickup_ready','picked_up','completed'];

    const matchAccepted = {
      pharmacy: pharmacyId,
      $or: [
        { orderStatus: { $in: acceptedStatuses } },
        { status: 'accepted' },
      ],
    };

    const matchPending = {
      pharmacy: pharmacyId,
      $or: [{ orderStatus: 'pending' }, { status: 'pending' }],
    };

    const matchSubmitted = {
      pharmacy: pharmacyId,
      $or: [{ orderStatus: 'submitted' }, { status: 'submitted' }],
    };

    const matchActive = {
      pharmacy: pharmacyId,
      $or: [
        { orderStatus: { $in: ['confirmed','preparing','dispatched','pickup_ready'] } },
        { status: 'confirmed' },
      ],
    };

    const [totalQuotes, accepted, pending, submitted, activeOrders, revenueRes, recentOrders] =
      await Promise.all([
        Quotation.countDocuments({ pharmacy: pharmacyId }),
        Quotation.countDocuments(matchAccepted),
        Quotation.countDocuments(matchPending),
        Quotation.countDocuments(matchSubmitted),
        Quotation.countDocuments(matchActive),
        Quotation.aggregate([
          { $match: matchAccepted },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Quotation.find(matchAccepted)
          .sort({ updatedAt: -1 })
          .limit(5)
          .populate('patient', 'name')
          .populate('prescription', 'extractedMedicines'),
      ]);

    res.json({
      totalQuotes,
      accepted,
      pending,
      submitted,
      activeOrders,
      revenue:        revenueRes[0]?.total || 0,
      acceptanceRate: totalQuotes ? ((accepted / totalQuotes) * 100).toFixed(1) : 0,
      recentOrders,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
