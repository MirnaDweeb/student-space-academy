const mongoose = require('mongoose');

const CohortSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    capacity: { type: Number, default: 30, min: 1 },
    seatsTaken: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['Scheduled', 'InProgress', 'Completed', 'Cancelled'], default: 'Scheduled' },
  },
  { timestamps: true }
);

CohortSchema.virtual('availableSeats').get(function () {
  return Math.max(0, (this.capacity || 0) - (this.seatsTaken || 0));
});

CohortSchema.index({ course: 1, name: 1 }, { unique: true });
CohortSchema.index({ course: 1, status: 1 });

CohortSchema.set('toJSON', { virtuals: true });
CohortSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cohort', CohortSchema);
