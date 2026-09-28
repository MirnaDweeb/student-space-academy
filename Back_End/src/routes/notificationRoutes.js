const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/', protect, ctrl.listNotifications);
router.patch('/:id/read', protect, ctrl.markRead);

module.exports = router;
