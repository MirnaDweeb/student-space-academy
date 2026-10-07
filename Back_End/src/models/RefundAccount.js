const mongoose = require('mongoose');
const { encrypt, decrypt, maskIdentifier } = require('../utils/encryption');

const RefundAccountSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    refundMethod: {
      type: String,
      enum: ['ORIGINAL_PAYMENT_METHOD', 'BANK_TRANSFER'],
      default: 'ORIGINAL_PAYMENT_METHOD',
    },
    bankName: {
      type: String,
      trim: true,
    },
    accountNumberEncrypted: {
      type: String,
      select: false, // Never return in default queries
    },
    accountNumberMasked: {
      type: String,
      trim: true,
    },
    ibanEncrypted: {
      type: String,
      select: false, // Never return in default queries
    },
    ibanMasked: {
      type: String,
      trim: true,
    },
    swiftCode: {
      type: String,
      trim: true,
    },
    isConfirmed: {
      type: Boolean,
      default: true,
    },
    confirmedAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

/**
 * Safely updates account number with encryption and masking.
 */
RefundAccountSchema.methods.setAccountNumber = function (rawAccountNumber) {
  if (rawAccountNumber) {
    this.accountNumberEncrypted = encrypt(rawAccountNumber);
    this.accountNumberMasked = maskIdentifier(rawAccountNumber, 'ACCOUNT');
  }
};

/**
 * Safely updates IBAN with encryption and masking.
 */
RefundAccountSchema.methods.setIban = function (rawIban) {
  if (rawIban) {
    this.ibanEncrypted = encrypt(rawIban);
    this.ibanMasked = maskIdentifier(rawIban, 'IBAN');
  }
};

/**
 * Decrypts raw IBAN (restricted strictly to authorized finance operations).
 */
RefundAccountSchema.methods.getDecryptedIban = function () {
  return decrypt(this.ibanEncrypted);
};

/**
 * Decrypts raw account number (restricted strictly to authorized finance operations).
 */
RefundAccountSchema.methods.getDecryptedAccountNumber = function () {
  return decrypt(this.accountNumberEncrypted);
};

module.exports = mongoose.model('RefundAccount', RefundAccountSchema);
