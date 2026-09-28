const Course = require('../models/Course');
const LearningPath = require('../models/LearningPath');

/**
 * Rule-based recommendation engine (MVP).
 * Architecture is intentionally extensible: swap this module's internals
 * for an AI-driven implementation later without changing its public API.
 */
async function getRecommendedPath(studentProfile) {
  if (!studentProfile.learningGoal) return null;
  const path = await LearningPath.findOne({ goal: studentProfile.learningGoal })
    .populate('courses.course')
    .populate('recommendedStartingCourse')
    .populate('goal');
  return path;
}

async function getRecommendationFromReadiness({ course, outcome, knowledgeGaps, recommendedCourse }) {
  if (outcome === 'READY') {
    return { course, reason: 'Your readiness assessment confirms you meet the requirements.', priority: 1 };
  }
  if (recommendedCourse) {
    return {
      course: recommendedCourse,
      reason: `Your assessment identified gaps in ${knowledgeGaps.join(', ') || 'core topics'}. This course covers the missing foundation.`,
      priority: 1,
    };
  }
  return {
    course,
    reason: 'Manual review recommended based on your assessment result.',
    priority: 2,
  };
}

async function getGoalBasedCourseSuggestions(learningGoalId, excludeCourseIds = []) {
  return Course.find({
    goals: learningGoalId,
    _id: { $nin: excludeCourseIds },
    isActive: true,
  }).limit(6);
}

module.exports = { getRecommendedPath, getRecommendationFromReadiness, getGoalBasedCourseSuggestions };
