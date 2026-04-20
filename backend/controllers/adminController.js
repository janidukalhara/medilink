const User = require('../models/User');
const Prescription = require('../models/Prescription');
const Quotation = require('../models/Quotation');
const Notification = require('../models/Notification');

exports.getPendingPharmacies = async (req, res) => {
  try {
    const pharmacies = await User.find({ role: 'pharmacy', isApproved: false }).sort({ createdAt: -1 });
    res.json({ pharmacies });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.approvePharmacy = async (req, res) => {
  try {
    const { id } = req.params;

    // FIX: Verify it's actually a pharmacy, not an arbitrary user
    const pharmacy = await User.findOne({ _id: id, role: 'pharmacy' });
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    pharmacy.isApproved = true;
    pharmacy.isActive = true;
    await pharmacy.save();

    await Notification.create({
      recipient: pharmacy._id,
      type: 'pharmacy_approved',
      title: 'Account Approved!',
      message: 'Your pharmacy account has been approved. You can now receive prescription requests.',
    });

    if (req.io) req.io.to(`user_${pharmacy._id}`).emit('account_approved', {});

    res.json({ message: 'Pharmacy approved', pharmacy });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.rejectPharmacy = async (req, res) => {
  try {
    // FIX: Verify it's a pharmacy before deactivating
    const pharmacy = await User.findOne({ _id: req.params.id, role: 'pharmacy' });
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    pharmacy.isActive = false;
    await pharmacy.save();

    res.json({ message: 'Pharmacy rejected', pharmacy });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const query = {};

    // FIX: Validate role filter to prevent arbitrary query injection
    if (role) {
      if (!['patient', 'pharmacy', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role filter' });
      }
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ users, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // FIX: Prevent admin from deactivating their own account
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalPatients,
      totalPharmacies,
      pendingPharmacies,
      totalPrescriptions,
      processedToday,
      failedOCR,
      totalQuotations,
      acceptedQuotations,
    ] = await Promise.all([
      User.countDocuments({ role: 'patient' }),
      User.countDocuments({ role: 'pharmacy', isApproved: true }),
      User.countDocuments({ role: 'pharmacy', isApproved: false }),
      Prescription.countDocuments(),
      Prescription.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      Prescription.countDocuments({ status: 'failed' }),
      // FIX: Use orderStatus (the canonical field) instead of legacy status
      Quotation.countDocuments({ orderStatus: 'submitted' }),
      Quotation.countDocuments({ orderStatus: 'accepted' }),
    ]);

    const ocrStats = await Prescription.aggregate([
      { $match: { ocrConfidence: { $gt: 0 } } },
      { $group: { _id: null, avgConfidence: { $avg: '$ocrConfidence' }, count: { $sum: 1 } } },
    ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const prescriptionsByDay = await Prescription.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      stats: {
        totalPatients,
        totalPharmacies,
        pendingPharmacies,
        totalPrescriptions,
        processedToday,
        failedOCR,
        totalQuotations,
        acceptedQuotations,
        avgOCRConfidence: ocrStats[0]?.avgConfidence?.toFixed(1) || 0,
      },
      prescriptionsByDay,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Update pharmacy details ───────────────────────────────────────────────────
exports.updatePharmacy = async (req, res) => {
  try {
    const updates = { ...req.body };
    // Strip security-sensitive fields — admin can update profile details only
    delete updates.password;
    delete updates.role;
    delete updates.refreshToken;

    const pharmacy = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'pharmacy' },
      updates,
      { new: true }
    );
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });
    res.json({ message: 'Pharmacy updated', pharmacy });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Delete pharmacy ───────────────────────────────────────────────────────────
exports.deletePharmacy = async (req, res) => {
  try {
    const pharmacy = await User.findOneAndDelete({ _id: req.params.id, role: 'pharmacy' });
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });
    res.json({ message: 'Pharmacy deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Get single user details ───────────────────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Get all approved pharmacies ───────────────────────────────────────────────
exports.getAllPharmacies = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = { role: 'pharmacy' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'pharmacyProfile.district': { $regex: search, $options: 'i' } },
        { 'pharmacyProfile.licenseNumber': { $regex: search, $options: 'i' } },
      ];
    }
    const total = await User.countDocuments(query);
    const pharmacies = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ pharmacies, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
