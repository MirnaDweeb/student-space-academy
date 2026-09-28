const express = require('express');
const router = express.Router();
const mediaCtrl = require('../controllers/mediaController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public Gallery (No auth required)
router.get('/public', mediaCtrl.getPublicGallery);

// Student Authenticated Endpoints
router.get('/my', protect, mediaCtrl.getMyMedia);
router.post('/upload', protect, upload.single('file'), mediaCtrl.uploadMedia);
router.get('/:id', protect, mediaCtrl.getMediaDetails);
router.post('/:id/submit', protect, mediaCtrl.submitDraft);
router.post('/:id/resubmit', protect, upload.single('file'), mediaCtrl.resubmit);
router.delete('/:id', protect, mediaCtrl.deleteMedia);

// Admin Moderation & Curation Endpoints
router.get('/admin/all', protect, authorize('admin'), mediaCtrl.adminList);
router.post('/admin/:id/approve', protect, authorize('admin'), mediaCtrl.adminApprove);
router.post('/admin/:id/reject', protect, authorize('admin'), mediaCtrl.adminReject);
router.post('/admin/:id/request-changes', protect, authorize('admin'), mediaCtrl.adminRequestChanges);
router.post('/admin/:id/select', protect, authorize('admin'), mediaCtrl.adminSelect);
router.post('/admin/:id/publish', protect, authorize('admin'), mediaCtrl.adminPublish);
router.post('/admin/:id/unpublish', protect, authorize('admin'), mediaCtrl.adminUnpublish);

module.exports = router;
