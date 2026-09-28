const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { startAssessmentValidator, submitAssessmentValidator } = require('../validators/cycleValidators');
const ctrl = require('../controllers/readinessController');

router.post('/start', protect, validate(startAssessmentValidator), ctrl.startAssessment);
router.post('/:attemptId/submit', protect, validate(submitAssessmentValidator), ctrl.submitAssessment);
router.get('/:attemptId/result', protect, ctrl.getResult);

module.exports = router;
