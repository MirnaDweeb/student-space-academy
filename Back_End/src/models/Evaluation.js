const mongoose = require('mongoose');

const EvaluationSchema = new mongoose.Schema(
  {
    student: {
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
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment',
    },
    ratings: {
      content: {
        type: Number,
        min: 1,
        max: 5,
      },
      instructor: {
        type: Number,
        min: 1,
        max: 5,
      },
      labs: {
        type: Number,
        min: 1,
        max: 5,
      },
      organization: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
    comments: {
      highlights: {
        type: String,
        trim: true,
        default: '',
      },
      improvements: {
        type: String,
        trim: true,
        default: '',
      },
    },
    courseFeedbackCompleted: {
      type: Boolean,
      default: false,
    },
    courseFeedbackSubmittedAt: {
      type: Date,
    },
    // Egyptian Space Agency / Agency Feedback
    agencyFeedback: {
      trainingEnvironment: { type: Number, min: 1, max: 5 },
      facilitiesAndLabs: { type: Number, min: 1, max: 5 },
      organizationAndStaff: { type: Number, min: 1, max: 5 },
      platformExperience: { type: Number, min: 1, max: 5 },
      overallSatisfaction: { type: Number, min: 1, max: 5 },
      recommendAgency: { type: Boolean, default: true },
      comments: { type: String, trim: true, default: '' },
      submittedAt: { type: Date },
    },
    agencyFeedbackCompleted: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

EvaluationSchema.index({ student: 1, course: 1 }, { unique: true });
EvaluationSchema.index({ course: 1 });
EvaluationSchema.index({ cohort: 1 });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
