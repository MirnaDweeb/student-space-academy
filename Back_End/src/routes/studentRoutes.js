const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { updateProfileValidator, setGoalValidator } = require('../validators/studentValidators');
const ctrl = require('../controllers/studentController');

router.use(protect);
router.get('/me', ctrl.getMe);
router.put('/me', validate(updateProfileValidator), ctrl.updateMe);
router.post('/me/goal', validate(setGoalValidator), ctrl.setGoal);

module.exports = router;
