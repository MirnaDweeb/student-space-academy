const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EGP' },
    method: { type: String, enum: ['Card', 'BankTransfer', 'Cash', 'Fawry', 'Other'], default: 'Card' },
    transactionId: { type: String, required: true, unique: true },
    provider: { type: String, default: 'PAYMOB' },
    providerReference: { type: String, index: true },
    providerSessionId: { type: String, sparse: true, index: true },
    providerOrderId: { type: String, sparse: true, index: true },
    isMock: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Pending', 'Initiated', 'Paid', 'Success', 'Failed', 'Cancelled', 'Refunded', 'Partially_Refunded', 'Requires_Refund'],
      default: 'Pending',
    },
    packageType: {
      type: String,
      enum: ['WITHOUT_TRANSPORTATION', 'WITH_TRANSPORTATION'],
    },
    failureReason: { type: String },
    paymentDate: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },

    // Refund tracking
    refundAmount: { type: Number, default: 0 },
    refundableBalance: { type: Number },
    refundedAt: { type: Date },

    // Legacy sparse aliases for backward compatibility with existing seeds
    stripeCheckoutSessionId: { type: String, sparse: true, index: true },
    stripePaymentIntentId: { type: String, sparse: true, index: true },
  },
  { timestamps: true }
);

PaymentTransactionSchema.pre('save', function (next) {
  if (this.refundableBalance == null && this.amount != null) {
    this.refundableBalance = Math.max(0, this.amount - (this.refundAmount || 0));
  }
  next();
});

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
