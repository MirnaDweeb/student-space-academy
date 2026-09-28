const mongoose = require('mongoose');

const AttendanceDisputeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    type: {
      type: String,
      enum: ['Dispute', 'Excuse', 'Missed_Checkin', 'Late_Appeal', 'Medical_Excuse', 'Official_Duty', 'Other'],
      default: 'Dispute',
    },
    reason: { type: String, required: true },
    documentation: { type: String },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String },
  },
  { timestamps: true }
);

AttendanceDisputeSchema.index({ student: 1, session: 1 });
AttendanceDisputeSchema.index({ status: 1 });

module.exports = mongoose.model('AttendanceDispute', AttendanceDisputeSchema);
