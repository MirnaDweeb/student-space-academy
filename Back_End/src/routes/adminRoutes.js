/**
 * Admin routes — admissions, applications, and certificate management.
 * Requires role 'admin' or 'superadmin'.
 */
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');
const certCtrl = require('../controllers/certificateController');
const paymentCtrl = require('../controllers/paymentController');
const certificateUpload = require('../middleware/certificateUpload');

router.use(protect, authorize('admin', 'superadmin'));

// Admissions & Applications
router.get('/overview', ctrl.overview);
router.get('/applications', ctrl.listApplications);
router.get('/applications/manual-review', ctrl.listApplicationsForReview);
router.patch('/applications/:id/accept', ctrl.acceptApplication);
router.patch('/applications/:id/review', ctrl.reviewApplication);
router.patch('/applications/:id/waitlist', ctrl.waitlistApplication);
router.patch('/applications/:id/reject', ctrl.rejectApplication);
router.patch('/applications/:id/promote', ctrl.promoteWaitlist);

// Cohorts & Capacity Management
router.get('/cohorts', ctrl.listCohorts);
router.post('/cohorts', ctrl.createCohort);
router.patch('/cohorts/:id', ctrl.updateCohort);

// Training Sessions
router.get('/sessions', ctrl.listSessions);
router.post('/sessions', ctrl.createSession);

// Certificate Requests & Management Queue
router.get('/certificates', certCtrl.adminList);
router.get('/certificates/:id', certCtrl.adminGet);
router.post('/certificates/:id/create', certCtrl.adminCreate);
router.post('/certificates/:id/upload', certificateUpload.single('file'), certCtrl.adminUpload);
router.post('/certificates/:id/issue', certCtrl.adminIssue);
router.patch('/certificates/:id/status', certCtrl.adminStatus);
router.patch('/certificates/:id/correct-name', certCtrl.correctName);

// Tuition Invoices & Payment Management Queue
router.get('/payments', paymentCtrl.adminList);
router.get('/payments/:id', paymentCtrl.adminGet);

module.exports = router;
