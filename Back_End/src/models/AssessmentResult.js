const mongoose = require('mongoose');

const AuditTrailSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['Created_Draft', 'Updated_Draft', 'Finalized', 'Published', 'Admin_Override'],
    },
    previousScore: { type: Number },
    newScore: { type: Number },
    previousStatus: { type: String },
    newStatus: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String },
  },
  { _id: false }
);

const AssessmentResultSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentSubmission',
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment',
      required: true,
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cohort',
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    maxScore: {
      type: Number,
      required: true,
      default: 100,
    },
    percentage: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Draft', 'Finalized', 'Published'],
      default: 'Draft',
    },
    resultLabel: {
      type: String,
      enum: ['Passed', 'Failed', 'Pending', 'Incomplete', 'Exempt'],
      default: 'Pending',
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
    },
    strengths: {
      type: String,
      trim: true,
      default: '',
    },
    improvementAreas: {
      type: String,
      trim: true,
      default: '',
    },
    instructorNote: {
      type: String,
      trim: true,
      default: '',
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
    finalizedAt: {
      type: Date,
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    publishedAt: {
      type: Date,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    auditTrail: [AuditTrailSchema],
  },
  { timestamps: true }
);

// One official evaluation result per student per assessment
AssessmentResultSchema.index({ assessment: 1, student: 1 }, { unique: true });
AssessmentResultSchema.index({ student: 1, course: 1, status: 1 });
AssessmentResultSchema.index({ cohort: 1, status: 1 });
AssessmentResultSchema.index({ instructor: 1 });

module.exports = mongoose.model('AssessmentResult', AssessmentResultSchema);
