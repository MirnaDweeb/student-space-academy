const StudentProfile = require('../models/StudentProfile');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const Notification = require('../models/Notification');
const LearningPath = require('../models/LearningPath');
const Certificate = require('../models/Certificate');
const TrainingSession = require('../models/TrainingSession');
const Assessment = require('../models/Assessment');
const { getGoalBasedCourseSuggestions } = require('../services/recommendationService');

async function getDashboard(req, res, next) {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id }).populate('learningGoal');

    const [applications, enrollments, notifications, unreadNotificationsCount, certificates, certificatesCount] =
      await Promise.all([
        Application.find({ student: req.user._id })
          .populate('course', 'title code level duration startDate overview')
          .populate('cohort', 'name startDate endDate status')
          .sort({ createdAt: -1 })
          .limit(10),
        Enrollment.find({ student: req.user._id })
          .populate('course', 'title code level duration startDate endDate deliveryMode location overview syllabus')
          .populate('cohort', 'name startDate endDate status capacity seatsTaken')
          .sort({ createdAt: -1 }),
        Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(10),
        Notification.countDocuments({ recipient: req.user._id, isRead: false }),
        Certificate.find({ student: req.user._id })
          .populate('course', 'title code')
          .populate('cohort', 'name')
          .sort({ createdAt: -1 }),
        Certificate.countDocuments({ student: req.user._id, status: { $in: ['ISSUED', 'Issued'] } }),
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
      const courseTitle = a.course?.title || 'Program';
      if (a.status === 'Readiness Required') pendingActions.push(`Take Readiness Assessment: ${courseTitle}`);
      if (a.status === 'Accepted' || a.status === 'Eligible - Payment Pending') {
        pendingActions.push(`Select Package & Complete Payment: ${courseTitle}`);
      }
      if (a.status === 'Under Review') pendingActions.push(`Application Under Review: ${courseTitle}`);
    });

    let recommendations = [];
    if (profile?.learningGoal) {
      try {
        recommendations = await getGoalBasedCourseSuggestions(
          profile.learningGoal._id,
          profile.completedCourses || []
        );
      } catch (recErr) {
        recommendations = [];
      }
    }

    // Retrieve upcoming training sessions and assessments for enrolled cohorts
    let upcomingSessions = [];
    let upcomingAssessments = [];
    const enrolledCohortIds = enrollments.map((e) => e.cohort?._id || e.cohort).filter(Boolean);

    if (enrolledCohortIds.length > 0) {
      try {
        const [sessions, assessments] = await Promise.all([
          TrainingSession.find({
            cohort: { $in: enrolledCohortIds },
            date: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
            status: { $ne: 'Cancelled' },
          })
            .populate('course', 'title code')
            .populate('cohort', 'name')
            .sort({ date: 1 })
            .limit(4),
          Assessment.find({
            cohort: { $in: enrolledCohortIds },
            status: { $in: ['Scheduled', 'In_Progress'] },
          })
            .populate('course', 'title code')
            .populate('cohort', 'name')
            .sort({ dueDate: 1, assessmentDate: 1 })
            .limit(4),
        ]);
        upcomingSessions = sessions;
        upcomingAssessments = assessments;
      } catch (err) {
        upcomingSessions = [];
        upcomingAssessments = [];
      }
    }

    // Synthesize real chronological lifecycle timeline from actual records
    const recentActivity = [];
    applications.forEach((app) => {
      const courseTitle = app.course?.title || 'Space Program';
      const cohortSuffix = app.cohort?.name ? ` (${app.cohort.name})` : '';

      if (app.createdAt) {
        recentActivity.push({
          id: `app-created-${app._id}`,
          type: 'application',
          title: 'Application Submitted',
          description: `Applied for ${courseTitle}${cohortSuffix}`,
          timestamp: app.createdAt,
          status: app.status,
          icon: 'fa-file-lines',
          link: `/student/applications/${app._id}`,
        });
      }

      (app.statusHistory || []).forEach((hist, hIdx) => {
        recentActivity.push({
          id: `app-hist-${app._id}-${hIdx}`,
          type: 'application_status',
          title: `Application: ${hist.status}`,
          description: `${courseTitle}: Status updated to ${hist.status}${hist.note ? ` — ${hist.note}` : ''}`,
          timestamp: hist.changedAt || app.updatedAt,
          status: hist.status,
          icon: hist.status === 'Accepted' || hist.status === 'Confirmed' ? 'fa-circle-check' : 'fa-clipboard-check',
          link: `/student/applications/${app._id}`,
        });
      });
    });

    enrollments.forEach((enr) => {
      const courseTitle = enr.course?.title || 'Space Training';
      const cohortSuffix = enr.cohort?.name ? ` (${enr.cohort.name})` : '';
      recentActivity.push({
        id: `enr-${enr._id}`,
        type: 'enrollment',
        title: 'Enrolled in Training Cycle',
        description: `Seat confirmed in ${courseTitle}${cohortSuffix}`,
        timestamp: enr.enrollmentDate || enr.createdAt,
        status: enr.status,
        icon: 'fa-graduation-cap',
        link: '/student/training',
      });
    });

    certificates.forEach((cert) => {
      const courseTitle = cert.course?.title || 'Program';
      if (cert.status === 'ISSUED' || cert.status === 'Issued') {
        recentActivity.push({
          id: `cert-issued-${cert._id}`,
          type: 'certificate',
          title: 'Official Credential Issued',
          description: `EGSA verified credential issued for ${courseTitle}`,
          timestamp: cert.issueDate || cert.updatedAt,
          status: 'Issued',
          icon: 'fa-award',
          link: '/student/certificate',
        });
      } else if (cert.submittedAt) {
        recentActivity.push({
          id: `cert-sub-${cert._id}`,
          type: 'certificate',
          title: 'Certificate Name Submitted',
          description: `Credential request submitted: "${cert.recipientName || cert.certificateName}"`,
          timestamp: cert.submittedAt,
          status: cert.status,
          icon: 'fa-file-signature',
          link: '/student/certificate',
        });
      }
    });

    recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const timeline = recentActivity.slice(0, 8);

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
        unreadNotificationsCount,
        certificates,
        certificatesCount,
        upcomingSessions,
        upcomingAssessments,
        timeline,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
