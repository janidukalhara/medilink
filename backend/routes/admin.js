const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getPendingPharmacies, approvePharmacy, rejectPharmacy,
  getAllUsers, toggleUserStatus, getDashboardStats
} = require('../controllers/adminController');

router.use(protect, authorize('admin'));
router.get('/pharmacies/pending', getPendingPharmacies);
router.put('/pharmacies/:id/approve', approvePharmacy);
router.put('/pharmacies/:id/reject', rejectPharmacy);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle', toggleUserStatus);
router.get('/dashboard', getDashboardStats);

module.exports = router;
