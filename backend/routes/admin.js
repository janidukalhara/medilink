const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getPendingPharmacies, approvePharmacy, rejectPharmacy,
  getAllUsers, toggleUserStatus, getDashboardStats,
  updatePharmacy, deletePharmacy, getUserById, getAllPharmacies,
} = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.get('/dashboard',                  getDashboardStats);
router.get('/pharmacies/pending',         getPendingPharmacies);
router.get('/pharmacies',                 getAllPharmacies);
router.put('/pharmacies/:id/approve',     approvePharmacy);
router.put('/pharmacies/:id/reject',      rejectPharmacy);
router.put('/pharmacies/:id',             updatePharmacy);
router.delete('/pharmacies/:id',          deletePharmacy);
router.get('/users',                      getAllUsers);
router.get('/users/:id',                  getUserById);
router.put('/users/:id/toggle',           toggleUserStatus);

module.exports = router;
