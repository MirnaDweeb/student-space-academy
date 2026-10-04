const rateLimit = require('express-rate-limit');

// When running automated tests, pass through without blocking
const isTest = process.env.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 30, // 30 failed attempts per 15 min for login/register
  skipSuccessfulRequests: true, // Only count failed attempts towards lockout
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 10,
  message: {
    success: false,
    message: 'Too many verification email requests. Please wait a few minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 10,
  message: {
    success: false,
    message: 'Too many password reset attempts. Please wait a few minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const certificateVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 60, // 60 credential lookups per 15 min
  message: {
    success: false,
    message: 'Too many verification lookup requests from this IP address. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  resendVerificationLimiter,
  passwordResetLimiter,
  certificateVerifyLimiter,
};
