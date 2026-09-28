const { body } = require('express-validator');

const updateProfileValidator = [
  body('status').optional().isIn(['student', 'graduate']).withMessage('Status must be student or graduate.'),
  body('university').optional().trim().notEmpty().withMessage('University cannot be empty.'),
  body('faculty').optional().trim().notEmpty().withMessage('Faculty cannot be empty.'),
  body('department').optional().trim(),
  body('academicYear').optional().trim(),
  body('graduationYear').optional().isInt({ min: 1990, max: 2100 }).withMessage('Graduation year looks invalid.'),
  body('skills').optional().isArray().withMessage('Skills must be a list.'),
  body('experience').optional().isArray().withMessage('Experience must be a list.'),
  body('previousTraining').optional().isArray().withMessage('Previous training must be a list.'),
];

const setGoalValidator = [
  body('goalId').isMongoId().withMessage('A valid goalId is required.'),
];

module.exports = { updateProfileValidator, setGoalValidator };
