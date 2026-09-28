const LearningPath = require('../models/LearningPath');
const StudentProfile = require('../models/StudentProfile');
const { getRecommendedPath } = require('../services/recommendationService');
const { AppError } = require('../middleware/error');

async function listPaths(req, res, next) {
  try {
    const paths = await LearningPath.find()
      .populate('goal')
      .populate('courses.course')
      .populate('recommendedStartingCourse');
    res.json({ success: true, data: paths });
  } catch (err) {
    next(err);
  }
}

async function getRecommended(req, res, next) {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) throw new AppError('Profile not found.', 404);
    if (!profile.learningGoal) {
      return res.json({ success: true, data: null, message: 'No learning goal selected yet.' });
    }
    const path = await getRecommendedPath(profile);
    res.json({ success: true, data: path });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPaths, getRecommended };
