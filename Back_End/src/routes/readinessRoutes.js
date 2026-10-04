const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { startAssessmentValidator, submitAssessmentValidator } = require('../validators/cycleValidators');
const ctrl = require('../controllers/readinessController');

// Student Readiness Assessment Routes
router.post('/start', protect, validate(startAssessmentValidator), ctrl.startAssessment);
router.post('/:attemptId/submit', protect, validate(submitAssessmentValidator), ctrl.submitAssessment);
router.get('/:attemptId/result', protect, ctrl.getResult);

// Admin Question Authoring & Management Routes
router.post('/admin/questions', protect, authorize('admin', 'superadmin'), ctrl.adminCreateQuestion);
router.post('/admin/questions/bulk', protect, authorize('admin', 'superadmin'), ctrl.adminBulkCreateQuestions);
router.get('/admin/questions', protect, authorize('admin', 'superadmin'), ctrl.adminListQuestions);
router.delete('/admin/questions/:questionId', protect, authorize('admin', 'superadmin'), ctrl.adminDeleteQuestion);

module.exports = router;
