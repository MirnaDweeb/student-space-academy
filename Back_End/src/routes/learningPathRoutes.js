const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/learningPathController');

router.get('/', protect, ctrl.listPaths);
router.get('/recommended', protect, ctrl.getRecommended);

module.exports = router;
