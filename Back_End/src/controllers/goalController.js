const LearningGoal = require('../models/LearningGoal');

async function listGoals(req, res, next) {
  try {
    const goals = await LearningGoal.find().sort({ title: 1 });
    res.json({ success: true, data: goals });
  } catch (err) {
    next(err);
  }
}

module.exports = { listGoals };
