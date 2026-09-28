const { body, param } = require('express-validator');

const startAssessmentValidator = [
  body('courseId').isMongoId().withMessage('A valid courseId is required.'),
];

const submitAssessmentValidator = [
  param('attemptId').isMongoId().withMessage('Invalid assessment attempt id.'),
  body('answers').isArray({ min: 1 }).withMessage('Answers must be a non-empty list.'),
  body('answers.*.questionId').isMongoId().withMessage('Each answer needs a valid questionId.'),
  body('answers.*.selectedIndex').isInt({ min: 0 }).withMessage('Each answer needs a valid selectedIndex.'),
];

const createApplicationValidator = [
  body('courseId').isMongoId().withMessage('A valid courseId is required.'),
  body('readinessAttemptId').optional().isMongoId().withMessage('Invalid readiness attempt id.'),
];

const payInvoiceValidator = [
  param('invoiceId').isMongoId().withMessage('Invalid invoice id.'),
  body('method').optional().isIn(['Card', 'BankTransfer', 'Cash', 'Other']).withMessage('Invalid payment method.'),
  body('packageType').optional().isIn(['WITHOUT_TRANSPORTATION', 'WITH_TRANSPORTATION']).withMessage('Invalid package type.'),
];

module.exports = {
  startAssessmentValidator,
  submitAssessmentValidator,
  createApplicationValidator,
  payInvoiceValidator,
};
