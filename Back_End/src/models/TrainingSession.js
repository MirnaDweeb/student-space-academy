const mongoose = require('mongoose');

const TrainingSessionSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    sessionNumber: { type: Number, required: true },
    title: { type: String, required: true },
    focus: { type: String },
    activities: [{ type: String }],
    date: { type: Date, required: true },
    startTime: { type: String, default: '10:00 AM' },
    endTime: { type: String, default: '03:00 PM' },
    instructor: { type: String, default: 'EGSA Faculty' },
    location: { type: String, default: 'Egyptian Space Academy, Cairo' },
    deliveryMode: { type: String, enum: ['Onsite', 'Online', 'Hybrid'], default: 'Onsite' },
    status: {
      type: String,
      enum: ['Scheduled', 'Active', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    attendanceWindow: {
      opensAt: { type: Date },
      closesAt: { type: Date },
    },
    qrCode: {
      token: { type: String, index: true },
      expiresAt: { type: Date },
      generatedAt: { type: Date },
      isActive: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

TrainingSessionSchema.index({ cohort: 1, sessionNumber: 1 }, { unique: true });

module.exports = mongoose.model('TrainingSession', TrainingSessionSchema);
