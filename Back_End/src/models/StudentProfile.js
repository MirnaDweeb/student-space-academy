const mongoose = require('mongoose');

const StudentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    dateOfBirth: { type: Date },
    status: { type: String, enum: ['student', 'graduate'], required: true },
    university: { type: String, required: true },
    faculty: { type: String, required: true },
    department: { type: String },
    academicYear: { type: String },
    graduationYear: { type: Number },
    skills: [{ type: String }],
    experience: [{ type: String }],
    previousTraining: [{ type: String }],
    learningGoal: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningGoal' },
    completedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    profileCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudentProfile', StudentProfileSchema);
