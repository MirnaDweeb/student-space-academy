const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/bundleController');

router.get('/', protect, ctrl.listBundles);
router.get('/:id', protect, ctrl.getBundle);

module.exports = router;
