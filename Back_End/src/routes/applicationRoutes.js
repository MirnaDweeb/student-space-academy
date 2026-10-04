const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createApplicationValidator } = require('../validators/cycleValidators');
const ctrl = require('../controllers/applicationController');

router.post('/', protect, validate(createApplicationValidator), ctrl.createApplication);
router.get('/my', protect, ctrl.myApplications);
router.get('/:id', protect, ctrl.getApplication);
router.patch('/:id/cancel', protect, ctrl.cancelApplication);

module.exports = router;
