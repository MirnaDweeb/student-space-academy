const express = require('express');
const router = express.Router();
const mediaCtrl = require('../controllers/mediaController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public Gallery (No auth required)
router.get('/public', mediaCtrl.getPublicGallery);

// Admin Moderation & Curation Endpoints (Must precede parameterized /:id routes)
router.get(['/admin', '/admin/all'], protect, authorize('admin', 'superadmin'), mediaCtrl.adminList);
router.route('/admin/:id/approve').post(protect, authorize('admin', 'superadmin'), mediaCtrl.adminApprove).patch(protect, authorize('admin', 'superadmin'), mediaCtrl.adminApprove);
router.route('/admin/:id/reject').post(protect, authorize('admin', 'superadmin'), mediaCtrl.adminReject).patch(protect, authorize('admin', 'superadmin'), mediaCtrl.adminReject);
router.post('/admin/:id/request-changes', protect, authorize('admin', 'superadmin'), mediaCtrl.adminRequestChanges);
router.post('/admin/:id/select', protect, authorize('admin', 'superadmin'), mediaCtrl.adminSelect);
router.post('/admin/:id/publish', protect, authorize('admin', 'superadmin'), mediaCtrl.adminPublish);
router.post('/admin/:id/unpublish', protect, authorize('admin', 'superadmin'), mediaCtrl.adminUnpublish);

// Student Authenticated Endpoints
router.get('/my', protect, mediaCtrl.getMyMedia);
router.post('/upload', protect, upload.single('file'), mediaCtrl.uploadMedia);
router.get('/:id', protect, mediaCtrl.getMediaDetails);
router.post('/:id/submit', protect, mediaCtrl.submitDraft);
router.post('/:id/resubmit', protect, upload.single('file'), mediaCtrl.resubmit);
router.delete('/:id', protect, mediaCtrl.deleteMedia);

module.exports = router;
