const mongoose = require('mongoose');

const MediaReviewHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['Submitted', 'Approved', 'Rejected', 'Changes_Requested', 'Resubmitted', 'Selected_For_Publication', 'Published', 'Unpublished'],
      required: true,
    },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    previousStatus: { type: String },
    newStatus: { type: String, required: true },
    reason: { type: String },
    comment: { type: String },
  },
  { _id: true }
);

const MediaSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession' }, // Optional: can be general project/activity
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
    category: {
      type: String,
      enum: ['Project', 'Activity', 'Student Photo', 'Workshop', 'Other'],
      default: 'Project',
    },
    uploadedByType: {
      type: String,
      enum: ['Student', 'Instructor', 'Admin'],
      default: 'Student',
    },

    title: { type: String, required: true, trim: true, maxlength: 150 },
    caption: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 2000 },

    fileUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true }, // in bytes
    dimensions: {
      width: { type: Number },
      height: { type: Number },
    },

    status: {
      type: String,
      enum: [
        'Draft',
        'Pending_Review',
        'Under_Review',
        'Approved',
        'Rejected',
        'Changes_Requested',
        'Selected_For_Publication',
        'Published',
        'Unpublished',
      ],
      default: 'Draft',
    },

    submittedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewReason: { type: String },
    reviewComment: { type: String },
    reviewHistory: [MediaReviewHistorySchema],

    approvedAt: { type: Date },
    selectedAt: { type: Date },
    selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publicationPlacement: {
      type: String,
      enum: ['general_gallery', 'course_gallery', 'homepage', 'highlights'],
      default: 'general_gallery',
    },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publicVisibility: { type: Boolean, default: false },

    consentConfirmed: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

MediaSchema.index({ student: 1, createdAt: -1 });
MediaSchema.index({ status: 1, createdAt: -1 });
MediaSchema.index({ course: 1, status: 1 });
MediaSchema.index({ session: 1 });
MediaSchema.index({ publicVisibility: 1, publishedAt: -1 });

module.exports = mongoose.model('Media', MediaSchema);
