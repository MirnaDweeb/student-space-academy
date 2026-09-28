const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    enrollmentDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Confirmed', 'Active', 'Completed', 'Cancelled', 'No Show'], default: 'Confirmed' },
    packageType: {
      type: String,
      enum: ['WITHOUT_TRANSPORTATION', 'WITH_TRANSPORTATION'],
      default: 'WITHOUT_TRANSPORTATION',
    },
    transportationRequired: { type: Boolean, default: false },
    paidAmount: { type: Number },
    paymentReference: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentTransaction' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Enrollment', EnrollmentSchema);
