const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getNotifications, markAllRead, markRead } = require('../controllers/notificationController');

router.use(protect);
router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

module.exports = router;
