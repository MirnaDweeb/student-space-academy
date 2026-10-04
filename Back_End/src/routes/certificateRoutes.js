const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const certificateUpload = require('../middleware/certificateUpload');
const { certificateVerifyLimiter } = require('../middleware/rateLimiters');
const ctrl = require('../controllers/certificateController');

// Student: List my certificates and eligible enrollments
router.get('/my', protect, ctrl.myCertificates);

// Student: Submit certificate name request (Status -> NAME_SUBMITTED)
router.post('/submit-name', protect, ctrl.submitName);
router.post('/confirm-name', protect, ctrl.submitName);
router.post('/request', protect, ctrl.submitName);

// Student: Support POST & PATCH /api/certificates/:id/name
router.post('/:id/name', protect, ctrl.submitName);
router.patch('/:id/name', protect, ctrl.submitName);

// Student & Admin: Download certificate file securely
router.get('/:id/download', protect, ctrl.downloadCertificate);

// Student & Admin: Get certificate details by ID
router.get('/:id', protect, ctrl.getCertificateById);

// Admin Certificate Endpoints
router.get('/admin/queue', protect, authorize('admin', 'superadmin'), ctrl.adminList);
router.get('/admin/:id', protect, authorize('admin', 'superadmin'), ctrl.adminGet);
router.post('/admin/:id/create', protect, authorize('admin', 'superadmin'), ctrl.adminCreate);
router.post('/admin/:id/upload', protect, authorize('admin', 'superadmin'), certificateUpload.single('file'), ctrl.adminUpload);
router.post('/admin/:id/issue', protect, authorize('admin', 'superadmin'), ctrl.adminIssue);
router.patch('/admin/:id/status', protect, authorize('admin', 'superadmin'), ctrl.adminStatus);
router.patch('/:id/correct-name', protect, authorize('admin', 'superadmin'), ctrl.correctName);

// Public: Verifiable digital credential check
router.get('/verify/:tokenOrId', certificateVerifyLimiter, ctrl.verifyCertificate);

module.exports = router;
