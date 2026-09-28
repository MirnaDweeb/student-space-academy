const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EGP' },
    method: { type: String, enum: ['Card', 'BankTransfer', 'Cash', 'Fawry', 'Other'], default: 'Card' },
    transactionId: { type: String, required: true, unique: true },
    provider: { type: String, default: 'DEVELOPMENT_MOCK' },
    providerReference: { type: String },
    isMock: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Pending', 'Initiated', 'Paid', 'Success', 'Failed', 'Cancelled', 'Refunded'],
      default: 'Pending',
    },
    packageType: {
      type: String,
      enum: ['WITHOUT_TRANSPORTATION', 'WITH_TRANSPORTATION'],
    },
    failureReason: { type: String },
    paymentDate: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
    refundAmount: { type: Number, default: 0 },
    refundedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
