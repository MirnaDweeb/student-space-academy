const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, sparse: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },

    // Financial snapshot at time of purchase - authoritative regardless of later changes to Course.price
    baseAmount: { type: Number },
    coursePriceAtPurchase: { type: Number },
    transportationAmount: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number },
    amount: { type: Number, required: true },

    currency: { type: String, default: 'EGP' },
    dueDate: { type: Date },
    dueAt: { type: Date },
    issuedAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
    cancelledAt: { type: Date },
    expiredAt: { type: Date },

    // Refund audit fields (prepared for refunds architecture)
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String },
    refundedAt: { type: Date },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    packageType: {
      type: String,
      enum: ['WITHOUT_TRANSPORTATION', 'WITH_TRANSPORTATION'],
      default: 'WITHOUT_TRANSPORTATION',
    },
    status: {
      type: String,
      enum: [
        'Not Required',
        'Invoice Issued',
        'Pending',
        'Payment Initiated',
        'Paid',
        'Failed',
        'Overdue',
        'Expired',
        'Cancelled',
        'Waived',
        'Refunded',
        // Uppercase aliases
        'PENDING',
        'PAID',
        'FAILED',
        'CANCELLED',
        'EXPIRED',
      ],
      default: 'Invoice Issued',
    },
  },
  { timestamps: true }
);

InvoiceSchema.statics.generateInvoiceNumber = function () {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `EGSA-INV-${random}`;
};

InvoiceSchema.pre('save', function (next) {
  if (!this.invoiceNumber) {
    const random = Math.floor(100000 + Math.random() * 900000);
    this.invoiceNumber = `EGSA-INV-${random}`;
  }
  if (!this.baseAmount && this.coursePriceAtPurchase != null) {
    this.baseAmount = this.coursePriceAtPurchase;
  }
  if (!this.coursePriceAtPurchase && this.baseAmount != null) {
    this.coursePriceAtPurchase = this.baseAmount;
  }
  if (!this.dueAt && this.dueDate) {
    this.dueAt = this.dueDate;
  }
  if (!this.dueDate && this.dueAt) {
    this.dueDate = this.dueAt;
  }
  next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
