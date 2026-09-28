const mongoose = require('mongoose');

const CorrectionHistorySchema = new mongoose.Schema(
  {
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const AttendanceRecordSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    status: {
      type: String,
      enum: ['Present', 'Late', 'Absent', 'Excused'],
      default: 'Present',
    },
    checkInTime: { type: Date, default: Date.now },
    checkInMethod: {
      type: String,
      enum: ['QR_Scan', 'QR_Upload', 'Manual_Instructor', 'Manual_Admin', 'Dispute_Approval'],
      default: 'QR_Scan',
    },
    notes: { type: String },
    correctionHistory: [CorrectionHistorySchema],
  },
  { timestamps: true }
);

// Enforce database-level uniqueness: one attendance record per student per session
AttendanceRecordSchema.index({ student: 1, session: 1 }, { unique: true });
AttendanceRecordSchema.index({ enrollment: 1 });
AttendanceRecordSchema.index({ cohort: 1 });

module.exports = mongoose.model('AttendanceRecord', AttendanceRecordSchema);
