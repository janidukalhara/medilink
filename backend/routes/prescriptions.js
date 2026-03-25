const router = require('express').Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  uploadPrescription, requestQuotes, getMyPrescriptions,
  getPrescriptionById, updateMedicines, cancelPrescription
} = require('../controllers/prescriptionController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(protect);
router.post('/upload', upload.single('prescription'), uploadPrescription);
router.get('/', getMyPrescriptions);
router.get('/:id', getPrescriptionById);
router.put('/:id/request-quotes', authorize('patient'), requestQuotes);
router.put('/:id/medicines', authorize('patient'), updateMedicines);
router.put('/:id/cancel', authorize('patient'), cancelPrescription);

module.exports = router;
