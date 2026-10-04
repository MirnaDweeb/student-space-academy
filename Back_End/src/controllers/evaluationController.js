const Evaluation = require('../models/Evaluation');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Certificate = require('../models/Certificate');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/error');

/**
 * Submit or update course & instructor evaluation survey.
 * POST /api/evaluations
 * POST /api/evaluations/course
 */
async function submitEvaluation(req, res, next) {
  try {
    // If request indicates agency feedback, route to agency handler
    if (req.body.type === 'agency' || req.body.agencyRatings) {
      return submitAgencyEvaluation(req, res, next);
    }

    const { courseId, ratings, comments } = req.body;
    if (!courseId) {
      throw new AppError('courseId is required.', 400);
    }

    if (!ratings || typeof ratings !== 'object') {
      throw new AppError('Survey ratings are required.', 400);
    }

    const { content, instructor, labs, organization } = ratings;
    const ratingValues = [content, instructor, labs, organization];

    for (const val of ratingValues) {
      const num = Number(val);
      if (isNaN(num) || num < 1 || num > 5) {
        throw new AppError('All survey rating criteria (content, instructor, labs, organization) must be numbers between 1 and 5.', 400);
      }
    }

    // Verify enrollment
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: courseId,
      status: { $in: ['Confirmed', 'Active', 'Completed'] },
    });

    if (!enrollment) {
      throw new AppError('You must have an active or completed enrollment in this course to submit an evaluation.', 403);
    }

    // Existing evaluation check for agency status
    const existing = await Evaluation.findOne({ student: req.user._id, course: courseId });
    const isAgencyDone = Boolean(existing?.agencyFeedbackCompleted);

    const evaluation = await Evaluation.findOneAndUpdate(
      { student: req.user._id, course: courseId },
      {
        $set: {
          student: req.user._id,
          course: courseId,
          cohort: enrollment.cohort,
          enrollment: enrollment._id,
          ratings: {
            content: Number(content),
            instructor: Number(instructor),
            labs: Number(labs),
            organization: Number(organization),
          },
          comments: {
            highlights: comments?.highlights ? String(comments.highlights).trim() : '',
            improvements: comments?.improvements ? String(comments.improvements).trim() : '',
          },
          courseFeedbackCompleted: true,
          courseFeedbackSubmittedAt: new Date(),
          submittedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const isAllFeedbackDone = isAgencyDone;

    // Sync Certificate feedback completion flags
    const cert = await Certificate.findOneAndUpdate(
      { student: req.user._id, course: courseId },
      {
        $set: {
          courseFeedbackCompleted: true,
          ...(isAllFeedbackDone ? { feedbackCompleted: true } : {}),
        },
      },
      { new: true }
    );
    if (cert) {
      // If all feedback done and admin already created/issued certificate, notify student ready
      if (isAllFeedbackDone && cert.adminCreated && (cert.status === 'ISSUED' || cert.fileUrl)) {
        try {
          await Notification.create({
            recipient: req.user._id,
            title: 'Certificate Ready',
            message: 'Your certificate is now available.',
            type: 'success',
            relatedCourse: courseId,
          });
        } catch (notifErr) {
          console.error('[NOTIF ERROR]', notifErr.message);
        }
      }
    }

    // In-App Notification for Course Feedback
    try {
      await Notification.create({
        recipient: req.user._id,
        title: 'Course Feedback Submitted',
        message: 'Course feedback submitted successfully. Complete Egyptian Space Agency feedback to complete all requirements.',
        type: 'success',
        relatedCourse: courseId,
      });
    } catch (notifErr) {
      console.error('[EVALUATION] Failed to dispatch notification:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: isAllFeedbackDone
        ? "Course feedback submitted successfully. All required feedback forms are now complete! Your certificate request can now continue through the Academy's review process."
        : "Course feedback submitted successfully. Please complete Egyptian Space Agency feedback to finish your requirements. Your certificate request can now continue through the Academy's review process.",
      data: evaluation,
      courseFeedbackCompleted: true,
      agencyFeedbackCompleted: isAgencyDone,
      feedbackCompleted: isAllFeedbackDone,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Submit Egyptian Space Agency / Agency Feedback survey.
 * POST /api/evaluations/agency
 */
async function submitAgencyEvaluation(req, res, next) {
  try {
    const { courseId, ratings, agencyRatings, comments, feedbackComments, recommendAgency } = req.body;
    const r = agencyRatings || ratings;
    if (!courseId) {
      throw new AppError('courseId is required.', 400);
    }

    if (!r || typeof r !== 'object') {
      throw new AppError('Agency survey ratings are required.', 400);
    }

    const {
      trainingEnvironment = 5,
      facilitiesAndLabs = 5,
      organizationAndStaff = 5,
      platformExperience = 5,
      overallSatisfaction = 5,
    } = r;

    const values = [trainingEnvironment, facilitiesAndLabs, organizationAndStaff, platformExperience, overallSatisfaction];
    for (const val of values) {
      const num = Number(val);
      if (isNaN(num) || num < 1 || num > 5) {
        throw new AppError('All agency survey criteria must be numbers between 1 and 5.', 400);
      }
    }

    // Verify enrollment
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: courseId,
      status: { $in: ['Confirmed', 'Active', 'Completed'] },
    });

    if (!enrollment) {
      throw new AppError('You must have an active or completed enrollment in this course to submit agency feedback.', 403);
    }

    const existing = await Evaluation.findOne({ student: req.user._id, course: courseId });
    const isCourseDone = Boolean(existing?.courseFeedbackCompleted || existing?.ratings?.content);

    const evaluation = await Evaluation.findOneAndUpdate(
      { student: req.user._id, course: courseId },
      {
        $set: {
          student: req.user._id,
          course: courseId,
          cohort: enrollment.cohort,
          enrollment: enrollment._id,
          agencyFeedback: {
            trainingEnvironment: Number(trainingEnvironment),
            facilitiesAndLabs: Number(facilitiesAndLabs),
            organizationAndStaff: Number(organizationAndStaff),
            platformExperience: Number(platformExperience),
            overallSatisfaction: Number(overallSatisfaction),
            recommendAgency: recommendAgency !== false,
            comments: String(feedbackComments || comments || '').trim(),
            submittedAt: new Date(),
          },
          agencyFeedbackCompleted: true,
          submittedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const isAllFeedbackDone = isCourseDone;

    // Sync Certificate feedback completion flags
    const cert = await Certificate.findOneAndUpdate(
      { student: req.user._id, course: courseId },
      {
        $set: {
          agencyFeedbackCompleted: true,
          ...(isAllFeedbackDone ? { feedbackCompleted: true } : {}),
        },
      },
      { new: true }
    );
    if (cert) {

      // If all feedback done and admin already created/issued certificate, notify student ready
      if (isAllFeedbackDone && cert.adminCreated && (cert.status === 'ISSUED' || cert.fileUrl)) {
        try {
          await Notification.create({
            recipient: req.user._id,
            title: 'Certificate Ready',
            message: 'Your certificate is now available.',
            type: 'success',
            relatedCourse: courseId,
          });
        } catch (notifErr) {
          console.error('[NOTIF ERROR]', notifErr.message);
        }
      }
    }

    // In-App Notification for Agency Feedback
    try {
      await Notification.create({
        recipient: req.user._id,
        title: 'Egyptian Space Agency Feedback Submitted',
        message: 'Agency feedback submitted successfully. Thank you for helping us improve Egyptian Space Agency training programs.',
        type: 'success',
        relatedCourse: courseId,
      });
    } catch (notifErr) {
      console.error('[EVALUATION] Failed to dispatch notification:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: isAllFeedbackDone
        ? 'Egyptian Space Agency feedback submitted successfully. All required feedback forms are now complete!'
        : 'Egyptian Space Agency feedback submitted successfully. Please complete Course feedback to finish your requirements.',
      data: evaluation,
      courseFeedbackCompleted: isCourseDone,
      agencyFeedbackCompleted: true,
      feedbackCompleted: isAllFeedbackDone,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed feedback status for a specific course.
 * GET /api/evaluations/status/:courseId
 */
async function getEvaluationStatusForCourse(req, res, next) {
  try {
    const evaluation = await Evaluation.findOne({
      student: req.user._id,
      course: req.params.courseId,
    });

    const courseDone = Boolean(evaluation?.courseFeedbackCompleted || evaluation?.ratings?.content);
    const agencyDone = Boolean(evaluation?.agencyFeedbackCompleted);

    res.json({
      success: true,
      data: {
        courseId: req.params.courseId,
        courseFeedbackCompleted: courseDone,
        agencyFeedbackCompleted: agencyDone,
        feedbackCompleted: courseDone && agencyDone,
        evaluation,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all evaluations submitted by current student.
 * GET /api/evaluations/my
 */
async function getMyEvaluations(req, res, next) {
  try {
    const evaluations = await Evaluation.find({ student: req.user._id })
      .populate('course', 'title category level')
      .populate('cohort', 'name startDate endDate')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: evaluations,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get evaluation for a specific course by current student.
 * GET /api/evaluations/course/:courseId
 */
async function getEvaluationForCourse(req, res, next) {
  try {
    const evaluation = await Evaluation.findOne({
      student: req.user._id,
      course: req.params.courseId,
    }).populate('course', 'title category level');

    res.json({
      success: true,
      data: evaluation || null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: List and aggregate evaluations across all courses.
 * GET /api/evaluations/admin
 */
async function adminListEvaluations(req, res, next) {
  try {
    const { courseId, cohortId } = req.query;
    const filter = {};
    if (courseId) filter.course = courseId;
    if (cohortId) filter.cohort = cohortId;

    const evaluations = await Evaluation.find(filter)
      .populate('student', 'fullName email')
      .populate('course', 'title code level')
      .populate('cohort', 'name')
      .sort({ createdAt: -1 });

    // Compute aggregated averages
    let avgContent = 0;
    let avgInstructor = 0;
    let avgLabs = 0;
    let avgOrg = 0;
    const count = evaluations.length;

    if (count > 0) {
      avgContent = (evaluations.reduce((acc, e) => acc + (e.ratings?.content || 0), 0) / count).toFixed(2);
      avgInstructor = (evaluations.reduce((acc, e) => acc + (e.ratings?.instructor || 0), 0) / count).toFixed(2);
      avgLabs = (evaluations.reduce((acc, e) => acc + (e.ratings?.labs || 0), 0) / count).toFixed(2);
      avgOrg = (evaluations.reduce((acc, e) => acc + (e.ratings?.organization || 0), 0) / count).toFixed(2);
    }

    res.json({
      success: true,
      data: {
        totalEvaluations: count,
        averages: {
          content: Number(avgContent),
          instructor: Number(avgInstructor),
          labs: Number(avgLabs),
          organization: Number(avgOrg),
          overall: count > 0 ? Number(((Number(avgContent) + Number(avgInstructor) + Number(avgLabs) + Number(avgOrg)) / 4).toFixed(2)) : 0,
        },
        evaluations,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitEvaluation,
  submitAgencyEvaluation,
  getEvaluationStatusForCourse,
  getMyEvaluations,
  getEvaluationForCourse,
  adminListEvaluations,
};
