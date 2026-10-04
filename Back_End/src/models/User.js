const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, required: true, trim: true },
    nationalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{14}$/, 'National ID must be exactly 14 digits.'],
    },
    role: { type: String, enum: ['student', 'admin', 'instructor'], default: 'student' },
    isEmailVerified: { type: Boolean, default: true },
    accountStatus: {
      type: String,
      enum: ['unverified', 'active', 'suspended', 'disabled'],
      default: 'active',
    },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationToken: { type: String, select: false }, // backward compatibility
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetToken: { type: String, select: false }, // backward compatibility
    passwordResetExpires: { type: Date, select: false },
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        revokedAt: { type: Date },
        userAgent: { type: String },
        ip: { type: String },
      },
    ],
    isActive: { type: Boolean, default: true },
    registrationNumber: { type: String, unique: true, sparse: true },
    preferredLanguage: { type: String, enum: ['en', 'ar'], default: 'en' },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function hashPassword(next) {
  // Generate registration reference if missing
  if (!this.registrationNumber && this.role === 'student') {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    this.registrationNumber = `EGSA-${randomDigits}`;
  }

  // Sync isActive with accountStatus if accountStatus was modified
  if (this.isModified('accountStatus')) {
    this.isActive = this.accountStatus === 'active';
  } else if (this.isModified('isActive') && !this.isModified('accountStatus')) {
    if (!this.isActive) this.accountStatus = 'disabled';
  }

  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Safe user object serializer (never exposes password, hashes, or internal refresh tokens)
UserSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    fullName: this.fullName,
    email: this.email,
    phone: this.phone,
    nationalId: this.nationalId,
    role: this.role,
    accountStatus: this.accountStatus || (this.isEmailVerified ? 'active' : 'unverified'),
    isEmailVerified: !!this.isEmailVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', UserSchema);

