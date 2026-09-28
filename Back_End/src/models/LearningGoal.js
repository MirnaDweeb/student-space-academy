const mongoose = require('mongoose');

const LearningGoalSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    icon: { type: String, default: 'fa-satellite' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LearningGoal', LearningGoalSchema);
