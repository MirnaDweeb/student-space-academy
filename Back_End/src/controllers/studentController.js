const StudentProfile = require('../models/StudentProfile');
const { AppError } = require('../middleware/error');

async function getMe(req, res, next) {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id })
      .populate('learningGoal')
      .populate('completedCourses', 'title level');
    if (!profile) throw new AppError('Profile not found.', 404);

    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          phone: req.user.phone,
        },
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const allowedFields = [
      'dateOfBirth',
      'status',
      'university',
      'faculty',
      'department',
      'academicYear',
      'graduationYear',
      'skills',
      'experience',
      'previousTraining',
    ];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.profileCompleted = true;

    const profile = await StudentProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!profile) throw new AppError('Profile not found.', 404);

    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

async function setGoal(req, res, next) {
  try {
    const { goalId } = req.body;
    if (!goalId) throw new AppError('goalId is required.', 400);

    const profile = await StudentProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { learningGoal: goalId } },
      { new: true }
    ).populate('learningGoal');
    if (!profile) throw new AppError('Profile not found.', 404);

    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe, setGoal };
