const { body, param, check } = require('express-validator');

const registerValidator = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ min: 3 })
    .withMessage('Full name must be at least 3 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid working email address is required.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required.'),
  body('nationalId')
    .trim()
    .notEmpty()
    .withMessage('National ID is required.')
    .matches(/^\d{14}$/)
    .withMessage('National ID must be exactly 14 digits.'),
  body('university')
    .trim()
    .notEmpty()
    .withMessage('University is required.'),
  body('faculty')
    .trim()
    .notEmpty()
    .withMessage('Faculty / Department is required.'),
  body('department')
    .optional()
    .trim(),
  body('status')
    .optional()
    .isIn(['student', 'graduate'])
    .withMessage('Status must be student or graduate.'),
  body('graduationYear')
    .optional({ checkFalsy: true })
    .isInt({ min: 1990, max: 2100 })
    .withMessage('Graduation year must be a valid year (1990-2100).'),
  body('agreeToTerms')
    .custom((value) => value === true || value === 'true')
    .withMessage('You must accept the EGSA Space Academy terms and conditions to proceed.'),
];

const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
];

const resendVerificationValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required.')
    .normalizeEmail(),
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required.')
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required.'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters.'),
];

const verifyEmailValidator = [
  check('token')
    .trim()
    .notEmpty()
    .withMessage('Verification token is required.'),
];


module.exports = {
  registerValidator,
  loginValidator,
  resendVerificationValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  verifyEmailValidator,
};

