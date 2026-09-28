const Enrollment = require('../models/Enrollment');

async function myEnrollments(req, res, next) {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate('course')
      .populate('cohort')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: enrollments });
  } catch (err) {
    next(err);
  }
}

module.exports = { myEnrollments };
