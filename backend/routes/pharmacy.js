const router = require('express').Router();
const { protect, authorize, requireApproved } = require('../middleware/auth');
const {
  getNearbyPharmacies,
  getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem,
  autoGenerateQuotation,
} = require('../controllers/pharmacyController');

// Public-ish: nearby pharmacies (patient uses this)
router.get('/nearby', protect, getNearbyPharmacies);

// Pharmacy inventory management
router.use('/inventory', protect, authorize('pharmacy'), requireApproved);
router.get('/inventory', getInventory);
router.post('/inventory', addInventoryItem);
router.put('/inventory/:id', updateInventoryItem);
router.delete('/inventory/:id', deleteInventoryItem);

// Auto-quotation
router.post('/quotations/:quotationId/auto-generate', protect, authorize('pharmacy'), requireApproved, autoGenerateQuotation);

module.exports = router;
