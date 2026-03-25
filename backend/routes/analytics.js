const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { getPatientAnalytics, getPharmacyAnalytics } = require('../controllers/analyticsController');

router.use(protect);
router.get('/patient', authorize('patient'), getPatientAnalytics);
router.get('/pharmacy', authorize('pharmacy'), getPharmacyAnalytics);

module.exports = router;
