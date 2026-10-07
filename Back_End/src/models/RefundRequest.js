const mongoose = require('mongoose');

const RefundRequestSchema = new mongoose.Schema(
  {
    refundNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'EGP',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending Review', 'Approved', 'Processing', 'Refunded', 'Rejected', 'Failed'],
      default: 'Pending Review',
      index: true,
    },
    refundDestination: {
      refundMethod: {
        type: String,
        enum: ['ORIGINAL_PAYMENT_METHOD', 'BANK_TRANSFER'],
        default: 'ORIGINAL_PAYMENT_METHOD',
      },
      accountHolderName: { type: String, trim: true },
      bankName: { type: String, trim: true },
      maskedAccount: { type: String, trim: true },
      maskedIban: { type: String, trim: true },
    },
    adminDecision: {
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      decidedAt: { type: Date },
      decisionNote: { type: String, trim: true },
      approvedAmount: { type: Number },
    },
    execution: {
      processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      processedAt: { type: Date },
      providerReference: { type: String, trim: true },
      settlementMethod: {
        type: String,
        enum: ['PAYMOB_ONLINE', 'BANK_TRANSFER', 'MANUAL_FINANCE'],
      },
      failureReason: { type: String },
      notes: { type: String },
    },
    auditLog: [
      {
        action: { type: String, required: true },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actorRole: { type: String },
        timestamp: { type: Date, default: Date.now },
        details: { type: String },
      },
    ],
  },
  { timestamps: true }
);

RefundRequestSchema.statics.generateRefundNumber = function () {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `EGSA-REF-${random}`;
};

RefundRequestSchema.pre('save', function (next) {
  if (!this.refundNumber) {
    const random = Math.floor(100000 + Math.random() * 900000);
    this.refundNumber = `EGSA-REF-${random}`;
  }
  next();
});

module.exports = mongoose.model('RefundRequest', RefundRequestSchema);
