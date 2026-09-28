const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/assessmentController');
const { protect, authorize } = require('../middleware/auth');
const assessmentUpload = require('../middleware/assessmentUpload');

// Student endpoints
router.get('/my', protect, ctrl.getMyAssessments);

// Student file / submission downloads
router.get('/submissions/:submissionId/file', protect, ctrl.downloadSubmissionFile);
router.get('/:id/attachment/:filename', protect, ctrl.downloadAttachment);

// Student submit work
router.post('/:id/submit', protect, assessmentUpload.single('file'), ctrl.submitAssessment);

// Overview metrics for staff
router.get('/stats/overview', protect, authorize('instructor', 'admin', 'superadmin'), ctrl.getOverviewStats);

// List assessments (students see enrolled cohort assessments, staff sees all/filtered)
router.get('/', protect, ctrl.listAssessments);

// Faculty & Admin: Define new assessment
router.post('/', protect, authorize('instructor', 'admin', 'superadmin'), ctrl.createAssessment);

// Single assessment details
router.get('/:id', protect, ctrl.getAssessmentById);

// Update assessment definition
router.patch('/:id', protect, authorize('instructor', 'admin', 'superadmin'), ctrl.updateAssessment);

// Cohort student roster for assessment with evaluation statuses
router.get('/:id/students', protect, authorize('instructor', 'admin', 'superadmin'), ctrl.getCohortStudents);

// Record or draft student evaluation
router.post('/:id/students/:studentId/evaluate', protect, authorize('instructor', 'admin', 'superadmin'), ctrl.recordEvaluation);

// Finalize evaluation (lock)
router.post('/results/:resultId/finalize', protect, authorize('instructor', 'admin', 'superadmin'), ctrl.finalizeEvaluation);

// Publish evaluation to student
router.post('/results/:resultId/publish', protect, authorize('instructor', 'admin', 'superadmin'), ctrl.publishEvaluation);

module.exports = router;
