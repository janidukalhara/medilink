const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getMessages, sendMessage } = require('../controllers/chatController');

router.use(protect);
router.get('/:prescriptionId', getMessages);
router.post('/:prescriptionId', sendMessage);

module.exports = router;
