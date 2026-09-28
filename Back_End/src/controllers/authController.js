const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const {
  signAccessToken,
  signRefreshToken,
  generateRandomToken,
  hashToken,
} = require('../utils/token');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendRegistrationConfirmationEmail,
} = require('../utils/email');
const { notify } = require('../services/notificationService');
const { AppError } = require('../middleware/error');

/**
 * Safely masks an email address for public responses (e.g. s***o@domain.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Register a new Space Academy Student
 */
async function register(req, res, next) {
  try {
    const {
      fullName,
      email,
      password,
      confirmPassword,
      phone,
      nationalId,
      status,
      university,
      faculty,
      department,
      graduationYear,
      agreeToTerms,
    } = req.body;

    if (!fullName || !email || !password || !phone || !nationalId) {
      throw new AppError('Missing required personal registration fields.', 400);
    }
    if (password !== confirmPassword) {
      throw new AppError('Password and confirmation password do not match.', 400);
    }
    if (!agreeToTerms || (agreeToTerms !== true && agreeToTerms !== 'true')) {
      throw new AppError('You must accept the terms and conditions to register.', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedNationalId = String(nationalId).trim();

    // Check duplicate account by email or National ID with safe response
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { nationalId: normalizedNationalId }],
    });
    if (existing) {
      throw new AppError('An account with this email address or National ID already exists.', 409);
    }

    // Cryptographically secure verification token
    const rawVerificationToken = generateRandomToken(32);
    const verificationHash = hashToken(rawVerificationToken);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create User (STRICT SECURITY RULE: Public registration creates STUDENT only)
    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password,
      phone: phone.trim(),
      nationalId: normalizedNationalId,
      role: 'student', // Enforce student role server-side
      accountStatus: 'unverified',
      isEmailVerified: false,
      emailVerificationTokenHash: verificationHash,
      emailVerificationToken: rawVerificationToken, // Backward compatibility
      emailVerificationExpires: verificationExpires,
      isActive: false,
    });

    // Create associated StudentProfile with academic information
    await StudentProfile.create({
      user: user._id,
      status: status || 'student',
      university: (university || '').trim() || 'Egyptian Space Academy Candidate',
      faculty: (faculty || '').trim() || 'General Engineering',
      department: (department || '').trim() || undefined,
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
      profileCompleted: false,
    });

    // 1. Send institutional verification email (Email 1)
    const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const verificationUrl = `${clientUrl}/verify-email?token=${rawVerificationToken}`;

    try {
      await sendVerificationEmail({
        to: user.email,
        fullName: user.fullName,
        verificationUrl,
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send verification email:', emailErr.message);
    }

    // 2. Send institutional registration confirmation email (Email 2)
    try {
      await sendRegistrationConfirmationEmail({
        to: user.email,
        fullName: user.fullName,
        registrationNumber: user.registrationNumber,
        email: user.email,
        preferredLanguage: user.preferredLanguage || 'en',
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send registration confirmation email:', emailErr.message);
    }

    // 3. Create initial in-app registration notification
    try {
      await notify({
        recipient: user._id,
        title: 'Registration Received',
        message: `Welcome to EGSA Space Academy! Your registration reference is ${user.registrationNumber || 'EGSA-CADET'}. Please verify your email to apply for space courses.`,
        type: 'info',
      });
    } catch (notifErr) {
      console.error('[NOTIF ERROR] Failed to create registration notification:', notifErr.message);
    }

    // Notice: Do NOT issue tokens or automatically log in. User must verify email first.
    res.status(201).json({
      success: true,
      message: 'Registration successful. A verification link has been sent to your email. Please verify your email before signing in.',
      data: {
        email: maskEmail(user.email),
        registrationNumber: user.registrationNumber,
        unverified: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Verify Student Email Address
 */
async function verifyEmail(req, res, next) {
  try {
    const rawToken = req.params?.token || req.body?.token;
    if (!rawToken || !String(rawToken).trim()) {
      throw new AppError('Verification token is required.', 400);
    }

    const tokenHash = hashToken(rawToken);

    // Look for matching non-expired token (check both hashed and raw legacy token)
    const user = await User.findOne({
      $or: [
        { emailVerificationTokenHash: tokenHash },
        { emailVerificationToken: rawToken },
      ],
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationTokenHash +emailVerificationToken +emailVerificationExpires');

    if (!user) {
      throw new AppError('Invalid, expired, or already used verification token. Please request a new verification email.', 400);
    }

    user.isEmailVerified = true;
    user.accountStatus = 'active';
    user.isActive = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    try {
      await notify({
        recipient: user._id,
        title: 'Email Verified',
        message: 'Your email address has been verified successfully. Your EGSA Space Academy account is now active.',
        type: 'success',
      });
    } catch (_) {}

    res.json({
      success: true,
      message: 'Email address verified successfully. You can now sign in to your EGSA Space Academy account.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Resend Email Verification Token
 */
async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email address is required.', 400);

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+emailVerificationTokenHash +emailVerificationExpires'
    );

    // Anti-enumeration: Safe generic response if account does not exist
    if (!user) {
      return res.json({
        success: true,
        message: 'If an unverified account exists with that email address, a new verification link has been sent.',
      });
    }

    // If already verified, inform student safely
    if (user.isEmailVerified && user.accountStatus === 'active') {
      return res.json({
        success: true,
        message: 'This account has already been verified. You may sign in directly.',
      });
    }

    // Generate fresh single-use verification token
    const rawVerificationToken = generateRandomToken(32);
    user.emailVerificationTokenHash = hashToken(rawVerificationToken);
    user.emailVerificationToken = rawVerificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const verificationUrl = `${clientUrl}/verify-email?token=${rawVerificationToken}`;

    await sendVerificationEmail({
      to: user.email,
      fullName: user.fullName,
      verificationUrl,
    });

    res.json({
      success: true,
      message: 'A fresh verification link has been dispatched to your email address.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Authenticate User & Issue Short-lived Access Token + Refresh Session
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('Email and password are required.', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    // Anti-enumeration: generic error for non-existent account or wrong password
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('The email or password is incorrect.', 401);
    }

    // Check account status: Suspended or Disabled
    if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled' || !user.isActive) {
      // If user is unverified and isActive is false, handle verification check first
      if (user.accountStatus !== 'unverified' && user.isEmailVerified) {
        throw new AppError('Account is deactivated or suspended. Please contact EGSA administration.', 403);
      }
    }

    // Enforce email verification before student portal access
    if (!user.isEmailVerified || user.accountStatus === 'unverified') {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Your email address has not been verified yet. Please verify your email before signing in.',
        data: {
          email: maskEmail(user.email),
          unverified: true,
        },
      });
    }

    // Issue tokens
    const accessToken = signAccessToken(user);
    const rawRefreshToken = generateRandomToken(40);
    const refreshTokenHash = hashToken(rawRefreshToken);
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Prune expired or revoked sessions, then register new session
    const existingSessions = (user.refreshTokens || []).filter(
      (t) => !t.revokedAt && t.expiresAt && t.expiresAt > Date.now()
    );

    existingSessions.push({
      tokenHash: refreshTokenHash,
      createdAt: new Date(),
      expiresAt: refreshExpires,
      userAgent: req.headers['user-agent'] || 'Unknown Client',
      ip: req.ip || req.socket?.remoteAddress || 'Unknown IP',
    });

    user.refreshTokens = existingSessions;
    await user.save();

    // Check profile completion status for student
    let profileCompleted = false;
    if (user.role === 'student') {
      const profile = await StudentProfile.findOne({ user: user._id });
      profileCompleted = !!profile?.profileCompleted;
    }

    res.json({
      success: true,
      message: 'Authentication successful.',
      data: {
        token: accessToken, // Backward compatibility for existing endpoints
        accessToken,
        refreshToken: rawRefreshToken,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          nationalId: user.nationalId,
          accountStatus: user.accountStatus,
          isEmailVerified: user.isEmailVerified,
          profileCompleted,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Rotate Refresh Token & Issue Fresh Access Token
 */
async function refreshToken(req, res, next) {
  try {
    const rawRefreshToken = req.body?.refreshToken || req.headers['x-refresh-token'];
    if (!rawRefreshToken) {
      throw new AppError('Refresh token is required.', 401);
    }

    const tokenHash = hashToken(rawRefreshToken);

    const user = await User.findOne({
      'refreshTokens.tokenHash': tokenHash,
    });

    if (!user) {
      throw new AppError('Invalid refresh session. Please sign in again.', 401);
    }

    const session = user.refreshTokens.find((t) => t.tokenHash === tokenHash);
    if (!session || session.revokedAt || (session.expiresAt && session.expiresAt < Date.now())) {
      throw new AppError('Refresh token has expired or was revoked. Please sign in again.', 401);
    }

    // Token Rotation: Revoke current session, create fresh one
    session.revokedAt = new Date();

    const newRawRefreshToken = generateRandomToken(40);
    const newHash = hashToken(newRawRefreshToken);
    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    user.refreshTokens.push({
      tokenHash: newHash,
      createdAt: new Date(),
      expiresAt: newExpires,
      userAgent: req.headers['user-agent'] || 'Unknown Client',
      ip: req.ip || req.socket?.remoteAddress || 'Unknown IP',
    });

    await user.save();

    const newAccessToken = signAccessToken(user);

    res.json({
      success: true,
      data: {
        token: newAccessToken,
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Logout: Revoke the caller's refresh token session
 */
async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.body?.refreshToken || req.headers['x-refresh-token'];
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await User.updateOne(
        { 'refreshTokens.tokenHash': tokenHash },
        { $set: { 'refreshTokens.$.revokedAt': new Date() } }
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully. Authenticated session terminated.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Authenticated User Profile Summary
 */
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) throw new AppError('User not found.', 404);

    let profile = null;
    let profileCompleted = false;

    if (user.role === 'student') {
      profile = await StudentProfile.findOne({ user: user._id })
        .populate('learningGoal')
        .populate('completedCourses', 'title level');
      profileCompleted = !!profile?.profileCompleted;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          nationalId: user.nationalId,
          accountStatus: user.accountStatus,
          isEmailVerified: user.isEmailVerified,
          profileCompleted,
        },
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Request Password Reset (Protected against account enumeration)
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email address is required.', 400);

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+passwordResetTokenHash +passwordResetExpires'
    );

    // Always respond with generic safe message to prevent email enumeration
    if (user) {
      const rawResetToken = generateRandomToken(32);
      user.passwordResetTokenHash = hashToken(rawResetToken);
      user.passwordResetToken = rawResetToken; // Backward compatibility
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
      const resetUrl = `${clientUrl}/reset-password?token=${rawResetToken}`;

      await sendPasswordResetEmail({
        to: user.email,
        fullName: user.fullName,
        resetUrl,
      });
    }

    res.json({
      success: true,
      message: 'If an account exists with that email address, password reset instructions have been dispatched.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Reset Password with secure token and session revocation
 */
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      throw new AppError('Reset token and new password are required.', 400);
    }

    const tokenHash = hashToken(token);

    const user = await User.findOne({
      $or: [
        { passwordResetTokenHash: tokenHash },
        { passwordResetToken: token },
      ],
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetTokenHash +passwordResetToken +passwordResetExpires +refreshTokens');

    if (!user) {
      throw new AppError('Invalid or expired password reset link.', 400);
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = password;
    user.passwordResetTokenHash = undefined;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Invalidate all existing refresh tokens for security
    if (user.refreshTokens && Array.isArray(user.refreshTokens)) {
      user.refreshTokens.forEach((s) => {
        if (!s.revokedAt) s.revokedAt = new Date();
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. All previous sessions have been invalidated. You can now sign in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  maskEmail,
};

