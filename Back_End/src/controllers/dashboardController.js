const StudentProfile = require('../models/StudentProfile');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const Notification = require('../models/Notification');
const LearningPath = require('../models/LearningPath');
const { getGoalBasedCourseSuggestions } = require('../services/recommendationService');

async function getDashboard(req, res, next) {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id }).populate('learningGoal');

    const [applications, enrollments, notifications] = await Promise.all([
      Application.find({ student: req.user._id }).populate('course', 'title startDate').sort({ createdAt: -1 }).limit(5),
      Enrollment.find({ student: req.user._id }).populate('course', 'title startDate deliveryMode location'),
      Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(5),
    ]);

    let learningPath = null;
    let completedCount = 0;
    if (profile?.learningGoal) {
      learningPath = await LearningPath.findOne({ goal: profile.learningGoal._id }).populate('courses.course');
      if (learningPath) {
        const completedIds = (profile.completedCourses || []).map((c) => c.toString());
        completedCount = learningPath.courses.filter((c) => completedIds.includes(c.course._id.toString())).length;
      }
    }

    const pendingActions = [];
    if (!profile?.profileCompleted) pendingActions.push('Complete Profile');
    if (!profile?.learningGoal) pendingActions.push('Select a Learning Goal');
    applications.forEach((a) => {
      if (a.status === 'Readiness Required') pendingActions.push(`Take Readiness Assessment: ${a.course.title}`);
      if (a.status === 'Accepted' || a.status === 'Eligible - Payment Pending') pendingActions.push(`Select Package & Complete Payment: ${a.course.title}`);
      if (a.status === 'Under Review') pendingActions.push(`Application Under Review: ${a.course.title}`);
    });

    let recommendations = [];
    if (profile?.learningGoal) {
      recommendations = await getGoalBasedCourseSuggestions(
        profile.learningGoal._id,
        (profile.completedCourses || [])
      );
    }

    res.json({
      success: true,
      data: {
        profile,
        learningPath: learningPath
          ? { title: learningPath.title, totalCourses: learningPath.courses.length, completedCount }
          : null,
        currentApplication: applications[0] || null,
        applications,
        upcomingEnrollments: enrollments,
        pendingActions,
        recommendations,
        notifications,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
