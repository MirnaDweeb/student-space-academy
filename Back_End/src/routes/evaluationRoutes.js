const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/evaluationController');

router.use(protect);

// Student endpoints
router.post('/', ctrl.submitEvaluation);
router.post('/course', ctrl.submitEvaluation);
router.post('/agency', ctrl.submitAgencyEvaluation);
router.get('/my', ctrl.getMyEvaluations);
router.get('/status/:courseId', ctrl.getEvaluationStatusForCourse);
router.get('/course/:courseId', ctrl.getEvaluationForCourse);

// Admin endpoints
router.get('/admin', authorize('admin', 'superadmin'), ctrl.adminListEvaluations);

module.exports = router;
