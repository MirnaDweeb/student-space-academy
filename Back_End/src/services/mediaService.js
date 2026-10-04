const Media = require('../models/Media');
const Enrollment = require('../models/Enrollment');
const TrainingSession = require('../models/TrainingSession');
const Course = require('../models/Course');
const { notify } = require('./notificationService');
const { AppError } = require('../middleware/error');

/**
 * Validates that the student is legitimately enrolled in the course & cohort
 * and that the selected session belongs to that cohort.
 */
async function validateStudentSessionAccess(studentId, courseId, cohortId, sessionId) {
  const enrollment = await Enrollment.findOne({
    student: studentId,
    course: courseId,
    cohort: cohortId,
    status: { $in: ['Active', 'Confirmed', 'Completed'] },
  });

  if (!enrollment) {
    throw new AppError('You are not actively enrolled in this course and cohort.', 403);
  }

  let session = null;
  if (sessionId) {
    session = await TrainingSession.findOne({
      _id: sessionId,
      course: courseId,
      cohort: cohortId,
    });
    if (!session) {
      throw new AppError('The selected training session does not belong to your enrolled cohort.', 400);
    }
  }

  return { enrollment, session };
}

/**
 * Creates a media submission for an enrolled training session or project.
 */
async function createMediaSubmission(studentId, file, data) {
  if (!file) {
    throw new AppError('Image file is required for media submission.', 400);
  }

  const { courseId, cohortId, sessionId, category, title, caption, description, consentConfirmed, submitImmediately } = data;

  if (!courseId || !cohortId) {
    throw new AppError('Course and cohort associations are mandatory for media submission.', 400);
  }

  if (!title || !title.trim()) {
    throw new AppError('Media title is required.', 400);
  }

  const { enrollment, session } = await validateStudentSessionAccess(studentId, courseId, cohortId, sessionId);

  const fileUrl = `/uploads/media/${file.filename}`;
  const shouldSubmit = submitImmediately === 'true' || submitImmediately === true;
  const initialStatus = shouldSubmit ? 'Pending_Review' : 'Draft';
  const now = new Date();

  const history = [];
  if (shouldSubmit) {
    history.push({
      action: 'Submitted',
      changedAt: now,
      previousStatus: 'Draft',
      newStatus: 'Pending_Review',
      comment: 'Initial submission by student for institutional review.',
    });
  }

  const media = await Media.create({
    student: studentId,
    course: courseId,
    cohort: cohortId,
    session: session ? session._id : undefined,
    enrollment: enrollment._id,
    category: category || 'Project',
    uploadedByType: 'Student',
    title: title.trim(),
    caption: caption ? caption.trim() : '',
    description: description ? description.trim() : '',
    fileUrl,
    thumbnailUrl: fileUrl, // Disk storage serves same image; can be scaled via CSS/CDN
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    status: initialStatus,
    submittedAt: shouldSubmit ? now : null,
    consentConfirmed: consentConfirmed === 'true' || consentConfirmed === true,
    reviewHistory: history,
  });

  if (shouldSubmit) {
    await notify(
      studentId,
      'Media Submission Queued for Review',
      `Your media "${media.title}" has been successfully submitted for EGSA Academy editorial review.`,
      'info'
    );
  }

  return media;
}

/**
 * Submits an existing draft media for review.
 */
async function submitDraft(mediaId, studentId) {
  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  if (String(media.student) !== String(studentId)) {
    throw new AppError('You do not have permission to submit this media item.', 403);
  }

  if (media.status !== 'Draft') {
    throw new AppError(`Cannot submit media with current status: ${media.status}`, 400);
  }

  const now = new Date();
  media.status = 'Pending_Review';
  media.submittedAt = now;
  media.reviewHistory.push({
    action: 'Submitted',
    changedAt: now,
    previousStatus: 'Draft',
    newStatus: 'Pending_Review',
    comment: 'Draft submitted by student for review.',
  });

  await media.save();

  await notify(
    studentId,
    'Media Submission Received',
    `Your media "${media.title}" has been submitted for moderation review.`,
    'info'
  );

  return media;
}

/**
 * Resubmits a rejected or changes-requested media item.
 */
async function resubmitMedia(mediaId, studentId, updates, newFile) {
  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  if (String(media.student) !== String(studentId)) {
    throw new AppError('You do not have permission to modify this media item.', 403);
  }

  if (media.status !== 'Changes_Requested' && media.status !== 'Rejected') {
    throw new AppError('Only media requiring changes or rejected submissions can be resubmitted.', 400);
  }

  const previousStatus = media.status;
  const now = new Date();

  if (newFile) {
    media.fileUrl = `/uploads/media/${newFile.filename}`;
    media.thumbnailUrl = media.fileUrl;
    media.filename = newFile.filename;
    media.originalName = newFile.originalname;
    media.mimeType = newFile.mimetype;
    media.fileSize = newFile.size;
  }

  if (updates.title) media.title = updates.title.trim();
  if (updates.caption !== undefined) media.caption = updates.caption.trim();
  if (updates.description !== undefined) media.description = updates.description.trim();

  media.status = 'Pending_Review';
  media.submittedAt = now;
  media.reviewHistory.push({
    action: 'Resubmitted',
    changedAt: now,
    previousStatus,
    newStatus: 'Pending_Review',
    comment: updates.resubmitNotes || 'Student updated metadata/image and resubmitted for review.',
  });

  await media.save();

  await notify(
    studentId,
    'Media Resubmission Received',
    `Your updated media "${media.title}" has been resubmitted for Academy review.`,
    'info'
  );

  return media;
}

/**
 * Deletes a draft, rejected, or changes-requested media item.
 */
async function deleteMedia(mediaId, studentId) {
  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  if (String(media.student) !== String(studentId)) {
    throw new AppError('You do not have permission to delete this media item.', 403);
  }

  if (media.status === 'Published' || media.status === 'Selected_For_Publication') {
    throw new AppError('Cannot delete media that is currently published or scheduled for publication.', 400);
  }

  media.archivedAt = new Date();
  await media.deleteOne();
  return { success: true, message: 'Media item deleted successfully.' };
}

/**
 * Retrieves the student's media library with real aggregated metrics and filters.
 */
async function getStudentMedia(studentId, query = {}) {
  const filter = { student: studentId };

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.courseId) {
    filter.course = query.courseId;
  }
  if (query.sessionId) {
    filter.session = query.sessionId;
  }

  const [items, allStudentItems] = await Promise.all([
    Media.find(filter)
      .populate('course', 'title code level')
      .populate('session', 'title sessionNumber date')
      .sort({ createdAt: -1 }),
    Media.find({ student: studentId }).select('status'),
  ]);

  const summary = {
    totalCount: allStudentItems.length,
    draftCount: allStudentItems.filter((m) => m.status === 'Draft').length,
    pendingCount: allStudentItems.filter((m) => m.status === 'Pending_Review' || m.status === 'Under_Review').length,
    approvedCount: allStudentItems.filter((m) => m.status === 'Approved' || m.status === 'Selected_For_Publication').length,
    publishedCount: allStudentItems.filter((m) => m.status === 'Published').length,
    rejectedCount: allStudentItems.filter((m) => m.status === 'Rejected').length,
    changesRequestedCount: allStudentItems.filter((m) => m.status === 'Changes_Requested').length,
  };

  return { items, summary };
}

/**
 * Retrieves single media details with access enforcement.
 */
async function getMediaDetails(mediaId, user) {
  const media = await Media.findById(mediaId)
    .populate('course', 'title code level')
    .populate('cohort', 'name startDate endDate')
    .populate('session', 'title sessionNumber date instructor location')
    .populate('reviewedBy', 'fullName email role')
    .populate('selectedBy', 'fullName email')
    .populate('publishedBy', 'fullName email');

  if (!media) throw new AppError('Media item not found.', 404);

  const isOwner = String(media.student) === String(user._id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new AppError('Unauthorized access to private student media.', 403);
  }

  return media;
}

/**
 * ADMIN: Lists media submissions for editorial moderation queue.
 */
async function listAdminMedia(query = {}) {
  const filter = {};

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.courseId) {
    filter.course = query.courseId;
  }

  const items = await Media.find(filter)
    .populate('student', 'fullName email')
    .populate('course', 'title code level')
    .populate('cohort', 'name startDate endDate')
    .populate('session', 'title sessionNumber date location')
    .sort({ submittedAt: -1, createdAt: -1 });

  const counts = await Media.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const stats = {
    pending: 0,
    underReview: 0,
    approved: 0,
    changesRequested: 0,
    rejected: 0,
    selected: 0,
    published: 0,
  };

  counts.forEach((c) => {
    if (c._id === 'Pending_Review') stats.pending = c.count;
    if (c._id === 'Under_Review') stats.underReview = c.count;
    if (c._id === 'Approved') stats.approved = c.count;
    if (c._id === 'Changes_Requested') stats.changesRequested = c.count;
    if (c._id === 'Rejected') stats.rejected = c.count;
    if (c._id === 'Selected_For_Publication') stats.selected = c.count;
    if (c._id === 'Published') stats.published = c.count;
  });

  return { items, stats };
}

/**
 * ADMIN: Approves media for institutional compliance.
 */
async function approveMedia(mediaId, adminUserId, notes) {
  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  const previousStatus = media.status;
  const now = new Date();

  media.status = 'Approved';
  media.approvedAt = now;
  media.reviewedBy = adminUserId;
  media.reviewedAt = now;
  media.reviewComment = notes ? notes.trim() : '';

  media.reviewHistory.push({
    action: 'Approved',
    admin: adminUserId,
    changedAt: now,
    previousStatus,
    newStatus: 'Approved',
    comment: notes ? notes.trim() : 'Media approved by Academy moderation.',
  });

  await media.save();

  await notify(
    media.student,
    'Media Approved',
    `Your training media "${media.title}" has been approved by the EGSA Academy board.`,
    'success'
  );

  return media;
}

/**
 * ADMIN: Rejects media with institutional rationale.
 */
async function rejectMedia(mediaId, adminUserId, reason, comment) {
  if (!reason || !reason.trim()) {
    throw new AppError('Rejection reason is required.', 400);
  }

  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  const previousStatus = media.status;
  const now = new Date();

  media.status = 'Rejected';
  media.reviewedBy = adminUserId;
  media.reviewedAt = now;
  media.reviewReason = reason.trim();
  media.reviewComment = comment ? comment.trim() : '';

  media.reviewHistory.push({
    action: 'Rejected',
    admin: adminUserId,
    changedAt: now,
    previousStatus,
    newStatus: 'Rejected',
    reason: reason.trim(),
    comment: comment ? comment.trim() : '',
  });

  await media.save();

  await notify(
    media.student,
    'Media Submission Rejected',
    `Your media "${media.title}" was not approved: ${reason}. Check My Media for feedback.`,
    'warning'
  );

  return media;
}

/**
 * ADMIN: Requests changes/re-upload from student.
 */
async function requestChanges(mediaId, adminUserId, feedback) {
  if (!feedback || !feedback.trim()) {
    throw new AppError('Feedback instructions are required when requesting changes.', 400);
  }

  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  const previousStatus = media.status;
  const now = new Date();

  media.status = 'Changes_Requested';
  media.reviewedBy = adminUserId;
  media.reviewedAt = now;
  media.reviewComment = feedback.trim();

  media.reviewHistory.push({
    action: 'Changes_Requested',
    admin: adminUserId,
    changedAt: now,
    previousStatus,
    newStatus: 'Changes_Requested',
    comment: feedback.trim(),
  });

  await media.save();

  await notify(
    media.student,
    'Changes Requested for Training Media',
    `Editorial review for "${media.title}": ${feedback.trim()}. You may update and resubmit.`,
    'info'
  );

  return media;
}

/**
 * ADMIN: Curates approved media for official publication placement.
 */
async function selectForPublication(mediaId, adminUserId, placement = 'general_gallery') {
  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  if (media.status !== 'Approved' && media.status !== 'Selected_For_Publication') {
    throw new AppError('Only approved media can be curated for publication.', 400);
  }

  const previousStatus = media.status;
  const now = new Date();

  media.status = 'Selected_For_Publication';
  media.selectedBy = adminUserId;
  media.selectedAt = now;
  media.publicationPlacement = placement;

  media.reviewHistory.push({
    action: 'Selected_For_Publication',
    admin: adminUserId,
    changedAt: now,
    previousStatus,
    newStatus: 'Selected_For_Publication',
    comment: `Selected for placement in ${placement}.`,
  });

  await media.save();
  return media;
}

/**
 * ADMIN: Publishes media to official public channels.
 */
async function publishMedia(mediaId, adminUserId) {
  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  if (media.status !== 'Approved' && media.status !== 'Selected_For_Publication') {
    throw new AppError('Media must be approved before publication.', 400);
  }

  const previousStatus = media.status;
  const now = new Date();

  media.status = 'Published';
  media.publicVisibility = true;
  media.publishedAt = now;
  media.publishedBy = adminUserId;

  media.reviewHistory.push({
    action: 'Published',
    admin: adminUserId,
    changedAt: now,
    previousStatus,
    newStatus: 'Published',
    comment: 'Published to official Egyptian Space Academy public gallery.',
  });

  await media.save();

  await notify(
    media.student,
    'Media Published on EGSA Website!',
    `Your training photo "${media.title}" is now published on the official Egyptian Space Academy website.`,
    'success'
  );

  return media;
}

/**
 * ADMIN: Unpublishes media from public display.
 */
async function unpublishMedia(mediaId, adminUserId, reason) {
  const media = await Media.findById(mediaId);
  if (!media) throw new AppError('Media item not found.', 404);

  if (media.status !== 'Published') {
    throw new AppError('Media is not currently published.', 400);
  }

  const previousStatus = media.status;
  const now = new Date();

  media.status = 'Unpublished';
  media.publicVisibility = false;

  media.reviewHistory.push({
    action: 'Unpublished',
    admin: adminUserId,
    changedAt: now,
    previousStatus,
    newStatus: 'Unpublished',
    comment: reason || 'Unpublished from public display by admin decision.',
  });

  await media.save();
  return media;
}

/**
 * PUBLIC: Sanitized public media gallery. Strictly published items only.
 */
async function getPublicGallery(query = {}) {
  const filter = {
    status: 'Published',
    publicVisibility: true,
  };

  if (query.placement && query.placement !== 'all') {
    filter.publicationPlacement = query.placement;
  }
  if (query.courseId) {
    filter.course = query.courseId;
  }

  const items = await Media.find(filter)
    .select('title caption description fileUrl thumbnailUrl publicationPlacement publishedAt course session')
    .populate('course', 'title code level category')
    .populate('session', 'title sessionNumber date')
    .sort({ publishedAt: -1 });

  return items;
}

module.exports = {
  createMediaSubmission,
  submitDraft,
  resubmitMedia,
  deleteMedia,
  getStudentMedia,
  getMediaDetails,
  listAdminMedia,
  approveMedia,
  rejectMedia,
  requestChanges,
  selectForPublication,
  publishMedia,
  unpublishMedia,
  getPublicGallery,
};
