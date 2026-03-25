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
    const pharmacy = await User.findByIdAndUpdate(id, { isApproved: true, isActive: true }, { new: true });
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

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
    const pharmacy = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    res.json({ message: 'Pharmacy rejected', pharmacy });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    const total = await User.countDocuments(query);
    const users = await User.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit));
    res.json({ users, total, pages: Math.ceil(total/limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
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
      Prescription.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      Prescription.countDocuments({ status: 'failed' }),
      Quotation.countDocuments({ status: 'submitted' }),
      Quotation.countDocuments({ status: 'accepted' }),
    ]);

    // Average OCR confidence
    const ocrStats = await Prescription.aggregate([
      { $match: { ocrConfidence: { $gt: 0 } } },
      { $group: { _id: null, avgConfidence: { $avg: '$ocrConfidence' }, count: { $sum: 1 } } },
    ]);

    // Recent prescriptions by day (last 7 days)
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
