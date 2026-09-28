const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Token missing.' });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Invalid or expired access token.',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    // Account state enforcement
    if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled' || !user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Account is deactivated or suspended. Please contact EGSA administration.',
      });
    }

    // Email verification check for protected resources
    if (user.accountStatus === 'unverified' || (!user.isEmailVerified && user.role === 'student')) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email address has not been verified yet. Please verify your email before accessing the portal.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Authentication failure.' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role authorization.' });
    }
    next();
  };
}

module.exports = { protect, authorize };

