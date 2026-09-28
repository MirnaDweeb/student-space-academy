const { validationResult } = require('express-validator');

/**
 * Wraps an array of express-validator chains. Runs them, then short-circuits
 * with a 400 + field-level error list if any failed, instead of letting bad
 * input reach controllers/services.
 */
function validate(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map((v) => v.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) return next();

    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  };
}

module.exports = { validate };
