const mongoose = require('mongoose');

const LearningPathSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningGoal', required: true },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
    courses: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
        order: { type: Number, required: true },
      },
    ],
    recommendedStartingCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LearningPath', LearningPathSchema);
