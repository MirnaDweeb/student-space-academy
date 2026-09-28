const mediaService = require('../services/mediaService');

// STUDENT CONTROLLERS
async function uploadMedia(req, res, next) {
  try {
    const media = await mediaService.createMediaSubmission(req.user._id, req.file, req.body);
    res.status(201).json({
      success: true,
      message: media.status === 'Pending_Review'
        ? 'Media uploaded and submitted for Academy review.'
        : 'Media draft saved successfully.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

async function getMyMedia(req, res, next) {
  try {
    const result = await mediaService.getStudentMedia(req.user._id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getMediaDetails(req, res, next) {
  try {
    const media = await mediaService.getMediaDetails(req.params.id, req.user);
    res.json({ success: true, data: media });
  } catch (err) {
    next(err);
  }
}

async function submitDraft(req, res, next) {
  try {
    const media = await mediaService.submitDraft(req.params.id, req.user._id);
    res.json({
      success: true,
      message: 'Media submitted for Academy review.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

async function resubmit(req, res, next) {
  try {
    const media = await mediaService.resubmitMedia(
      req.params.id,
      req.user._id,
      req.body,
      req.file
    );
    res.json({
      success: true,
      message: 'Media resubmitted successfully for review.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteMedia(req, res, next) {
  try {
    const result = await mediaService.deleteMedia(req.params.id, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUBLIC GALLERY CONTROLLER
async function getPublicGallery(req, res, next) {
  try {
    const items = await mediaService.getPublicGallery(req.query);
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

// ADMIN MODERATION CONTROLLERS
async function adminList(req, res, next) {
  try {
    const result = await mediaService.listAdminMedia(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function adminApprove(req, res, next) {
  try {
    const media = await mediaService.approveMedia(req.params.id, req.user._id, req.body.notes);
    res.json({
      success: true,
      message: 'Media approved successfully.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

async function adminReject(req, res, next) {
  try {
    const media = await mediaService.rejectMedia(
      req.params.id,
      req.user._id,
      req.body.reason,
      req.body.comment
    );
    res.json({
      success: true,
      message: 'Media submission rejected.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

async function adminRequestChanges(req, res, next) {
  try {
    const media = await mediaService.requestChanges(
      req.params.id,
      req.user._id,
      req.body.feedback
    );
    res.json({
      success: true,
      message: 'Changes requested from student.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

async function adminSelect(req, res, next) {
  try {
    const media = await mediaService.selectForPublication(
      req.params.id,
      req.user._id,
      req.body.placement
    );
    res.json({
      success: true,
      message: 'Media curated and selected for publication.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

async function adminPublish(req, res, next) {
  try {
    const media = await mediaService.publishMedia(req.params.id, req.user._id);
    res.json({
      success: true,
      message: 'Media published to official EGSA Academy channels.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

async function adminUnpublish(req, res, next) {
  try {
    const media = await mediaService.unpublishMedia(
      req.params.id,
      req.user._id,
      req.body.reason
    );
    res.json({
      success: true,
      message: 'Media unpublished from public display.',
      data: media,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadMedia,
  getMyMedia,
  getMediaDetails,
  submitDraft,
  resubmit,
  deleteMedia,
  getPublicGallery,
  adminList,
  adminApprove,
  adminReject,
  adminRequestChanges,
  adminSelect,
  adminPublish,
  adminUnpublish,
};
