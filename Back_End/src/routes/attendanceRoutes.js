const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/attendanceController');

// Public policy information
router.get('/policy', ctrl.getPolicy);

// Protected student routes
router.use(protect);

router.get('/summary', ctrl.getSummary);
router.get('/sessions', ctrl.getSessions);
router.post('/check-in/qr', ctrl.checkInWithQR);
router.post('/disputes', ctrl.submitDispute);
router.get('/disputes/my', ctrl.getMyDisputes);

// Admin & Instructor routes
router.post('/sessions/:id/qr', authorize('admin'), ctrl.generateQR);
router.get('/sessions/:id/roster', authorize('admin'), ctrl.getSessionRoster);
router.put('/records/:id', authorize('admin'), ctrl.correctRecord);
router.get('/disputes', authorize('admin'), ctrl.listDisputes);
router.put('/disputes/:id', authorize('admin'), ctrl.reviewDispute);

module.exports = router;
