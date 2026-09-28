const mongoose = require('mongoose');
const crypto = require('crypto');

const CertificateSchema = new mongoose.Schema(
  {
    certificateId: { type: String, unique: true, sparse: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
    recipientName: { type: String, required: true, trim: true },
    certificateName: { type: String, trim: true },
    issueDate: { type: Date },
    submittedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: [
        'NOT_ELIGIBLE',
        'ELIGIBLE',
        'NAME_SUBMITTED',
        'UNDER_PREPARATION',
        'ISSUED',
        'REVOKED',
        // Backward-compatibility aliases
        'Eligible',
        'Pending',
        'Issued',
        'Revoked',
      ],
      default: 'NAME_SUBMITTED',
    },
    verificationToken: { type: String, unique: true, sparse: true },
    nameConfirmedAt: { type: Date, default: Date.now },
    nameConfirmedBy: {
      type: String,
      enum: ['student', 'admin', 'system'],
      default: 'student',
    },
    // Admin Upload & Issuance Details
    fileUrl: { type: String, trim: true },
    fileName: { type: String, trim: true },
    fileMimeType: { type: String, trim: true },
    fileSizeBytes: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNotes: { type: String, trim: true },
    correctionHistory: [
      {
        oldName: { type: String, required: true },
        newName: { type: String, required: true },
        correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        correctedByName: { type: String },
        correctedAt: { type: Date, default: Date.now },
        reason: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

CertificateSchema.pre('validate', function (next) {
  if (this.certificateName && !this.recipientName) {
    this.recipientName = this.certificateName;
  } else if (this.recipientName && !this.certificateName) {
    this.certificateName = this.recipientName;
  }
  next();
});

CertificateSchema.statics.generateVerificationToken = function () {
  return crypto.randomBytes(16).toString('hex');
};

CertificateSchema.statics.generateCertificateId = function () {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `EGSA-CERT-${random}`;
};

module.exports = mongoose.model('Certificate', CertificateSchema);
