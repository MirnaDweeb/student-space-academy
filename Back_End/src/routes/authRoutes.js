const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  authLimiter,
  resendVerificationLimiter,
  passwordResetLimiter,
} = require('../middleware/rateLimiters');
const {
  registerValidator,
  loginValidator,
  resendVerificationValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  verifyEmailValidator,
} = require('../validators/authValidators');

// Public Authentication Flow
router.post('/register', authLimiter, validate(registerValidator), ctrl.register);
router.post('/login', authLimiter, validate(loginValidator), ctrl.login);
router.post('/resend-verification', resendVerificationLimiter, validate(resendVerificationValidator), ctrl.resendVerification);

// Email Verification (Supports POST body, GET query token, and GET /verify/:token)
router.post('/verify-email', validate(verifyEmailValidator), ctrl.verifyEmail);
router.get('/verify-email', validate(verifyEmailValidator), ctrl.verifyEmail);
router.get('/verify/:token', validate(verifyEmailValidator), ctrl.verifyEmail);

// Session Refresh & Termination
router.post('/refresh', ctrl.refreshToken);
router.post('/refresh-token', ctrl.refreshToken);
router.post('/logout', ctrl.logout);

// Password Recovery
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordValidator), ctrl.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordValidator), ctrl.resetPassword);

// Authenticated User Identity
router.get('/me', protect, ctrl.getMe);

module.exports = router;

