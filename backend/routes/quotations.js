const router = require('express').Router();
const { protect, authorize, requireApproved } = require('../middleware/auth');
const {
  getPharmacyRequests, getPharmacyQuotationById, submitQuotation,
  getPrescriptionQuotations, acceptQuotation, changeFulfillmentType,
  updateOrderStatus, patientCompleteOrder,
} = require('../controllers/quotationController');

router.use(protect);

// Pharmacy
router.get('/pharmacy-requests',   authorize('pharmacy'), requireApproved, getPharmacyRequests);
router.get('/:id/detail',          authorize('pharmacy'), requireApproved, getPharmacyQuotationById);
router.put('/:id/submit',          authorize('pharmacy'), requireApproved, submitQuotation);
router.put('/:id/order-status',    authorize('pharmacy'), requireApproved, updateOrderStatus);

// Patient
router.get('/prescription/:prescriptionId', authorize('patient'), getPrescriptionQuotations);
router.put('/:id/accept',                   authorize('patient'), acceptQuotation);
router.put('/:id/fulfillment',              authorize('patient'), changeFulfillmentType);
router.put('/:id/complete',                 authorize('patient'), patientCompleteOrder);

module.exports = router;
