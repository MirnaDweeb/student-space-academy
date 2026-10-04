const ReadinessQuestion = require('../models/ReadinessQuestion');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const Course = require('../models/Course');
const Application = require('../models/Application');
const { scoreAttempt } = require('../services/readinessService');
const { notify } = require('../services/notificationService');
const { AppError } = require('../middleware/error');

async function startAssessment(req, res, next) {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const questions = await ReadinessQuestion.aggregate([
      { $match: { course: course._id } },
      { $sample: { size: 10 } },
    ]);

    if (questions.length === 0) throw new AppError('No readiness questions configured for this course yet.', 400);

    const attempt = await ReadinessAttempt.create({
      student: req.user._id,
      course: course._id,
      questions: questions.map((q) => q._id),
      status: 'InProgress',
    });

    const questionsForClient = questions.map((q) => ({
      id: q._id,
      question: q.question,
      options: q.options,
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    res.status(201).json({ success: true, data: { attemptId: attempt._id, questions: questionsForClient } });
  } catch (err) {
    next(err);
  }
}

async function submitAssessment(req, res, next) {
  try {
    const { answers } = req.body; // [{ questionId, selectedIndex }]
    const attempt = await ReadinessAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
    }).populate('questions');

    if (!attempt) throw new AppError('Assessment attempt not found.', 404);
    if (attempt.status === 'Submitted') throw new AppError('Assessment already submitted.', 400);

    const course = await Course.findById(attempt.course);

    attempt.answers = attempt.questions.map((q) => {
      const given = answers.find((a) => a.questionId === q._id.toString());
      const selectedIndex = given ? given.selectedIndex : -1;
      return {
        question: q._id,
        selectedIndex,
        isCorrect: selectedIndex === q.correctAnswerIndex,
      };
    });

    const { score, knowledgeGaps, outcome, recommendedCourse } = await scoreAttempt(attempt, course);

    attempt.score = score;
    attempt.knowledgeGaps = knowledgeGaps;
    attempt.outcome = outcome;
    attempt.recommendedCourse = recommendedCourse ? recommendedCourse._id : undefined;
    attempt.status = 'Submitted';
    attempt.submittedAt = new Date();
    await attempt.save();

    // Link and update active application for this student & course
    const linkedApp = await Application.findOne({
      student: req.user._id,
      course: course._id,
      status: { $in: ['Submitted', 'Readiness Required', 'Under Review', 'Manual Review'] },
    }).sort({ createdAt: -1 });

    if (linkedApp) {
      linkedApp.readinessAttempt = attempt._id;
      linkedApp.statusHistory = linkedApp.statusHistory || [];

      if (outcome === 'READY' || outcome === 'CONDITIONALLY_READY') {
        linkedApp.eligibilityStatus = 'Eligible';
        linkedApp.status = 'Under Review';
        linkedApp.statusHistory.push({
          status: 'Under Review',
          note: `Readiness assessment completed with score ${score}% (${outcome}). Application submitted for Academic Review.`,
          changedAt: new Date(),
        });
        await linkedApp.save();

        try {
          await notify({
            recipient: req.user._id,
            title: 'Eligibility Completed',
            message: 'Your application has passed the readiness/eligibility stage.',
            type: 'success',
            relatedCourse: course._id,
            relatedApplication: linkedApp._id,
          });
        } catch (_) {}
      } else if (outcome === 'FOUNDATION_REQUIRED') {
        linkedApp.eligibilityStatus = 'Not Eligible';
        linkedApp.status = 'Foundation Recommended';
        linkedApp.statusHistory.push({
          status: 'Foundation Recommended',
          note: `Readiness assessment score ${score}% (${outcome}). Foundational course recommended.`,
          changedAt: new Date(),
        });
        await linkedApp.save();
      } else {
        // MANUAL_REVIEW
        linkedApp.eligibilityStatus = 'In Progress';
        linkedApp.status = 'Under Review';
        linkedApp.statusHistory.push({
          status: 'Under Review',
          note: `Readiness assessment completed with score ${score}% (${outcome}). Academic Board Review required.`,
          changedAt: new Date(),
        });
        await linkedApp.save();
      }
    }

    await notify({
      recipient: req.user._id,
      title: 'Readiness Assessment Result',
      message: `You scored ${score}% on ${course.title}. Outcome: ${outcome.replace(/_/g, ' ')}.`,
      type: outcome === 'READY' ? 'success' : 'warning',
      relatedCourse: course._id,
    });

    res.json({ success: true, data: { attemptId: attempt._id, score, outcome, knowledgeGaps } });
  } catch (err) {
    next(err);
  }
}

async function getResult(req, res, next) {
  try {
    const attempt = await ReadinessAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
    })
      .populate('course', 'title level')
      .populate('recommendedCourse', 'title slug level');

    if (!attempt) throw new AppError('Assessment attempt not found.', 404);
    if (attempt.status !== 'Submitted') throw new AppError('Assessment not yet submitted.', 400);

    res.json({ success: true, data: attempt });
  } catch (err) {
    next(err);
  }
}

/**
 * ADMIN: Create a single readiness question for a course
 */
async function adminCreateQuestion(req, res, next) {
  try {
    const { courseId, question, options, correctAnswerIndex, topic, difficulty = 'Medium' } = req.body;
    if (!courseId) throw new AppError('Course ID is required.', 400);
    if (!question || !String(question).trim()) throw new AppError('Question text is required.', 400);
    if (!Array.isArray(options) || options.length < 2) {
      throw new AppError('At least two options are required.', 400);
    }
    if (typeof correctAnswerIndex !== 'number' || correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
      throw new AppError('Valid correctAnswerIndex within options range is required.', 400);
    }
    if (!topic || !String(topic).trim()) throw new AppError('Topic is required.', 400);

    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const created = await ReadinessQuestion.create({
      course: course._id,
      question: question.trim(),
      options: options.map((opt) => String(opt).trim()),
      correctAnswerIndex,
      topic: topic.trim(),
      difficulty,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

/**
 * ADMIN: Bulk create readiness questions for a course
 */
async function adminBulkCreateQuestions(req, res, next) {
  try {
    const { courseId, questions } = req.body;
    if (!courseId) throw new AppError('Course ID is required.', 400);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new AppError('An array of questions is required.', 400);
    }

    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const docs = questions.map((q) => {
      if (!q.question || !Array.isArray(q.options) || typeof q.correctAnswerIndex !== 'number' || !q.topic) {
        throw new AppError('Each question must have question, options, correctAnswerIndex, and topic.', 400);
      }
      return {
        course: course._id,
        question: q.question.trim(),
        options: q.options.map((opt) => String(opt).trim()),
        correctAnswerIndex: q.correctAnswerIndex,
        topic: q.topic.trim(),
        difficulty: q.difficulty || 'Medium',
      };
    });

    const inserted = await ReadinessQuestion.insertMany(docs);
    res.status(201).json({ success: true, count: inserted.length, data: inserted });
  } catch (err) {
    next(err);
  }
}

/**
 * ADMIN: List readiness questions (filtered by courseId)
 */
async function adminListQuestions(req, res, next) {
  try {
    const filter = {};
    if (req.query.courseId) {
      filter.course = req.query.courseId;
    }
    const questions = await ReadinessQuestion.find(filter)
      .populate('course', 'title code slug level')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: questions });
  } catch (err) {
    next(err);
  }
}

/**
 * ADMIN: Delete a readiness question
 */
async function adminDeleteQuestion(req, res, next) {
  try {
    const { questionId } = req.params;
    const deleted = await ReadinessQuestion.findByIdAndDelete(questionId);
    if (!deleted) throw new AppError('Question not found.', 404);

    res.json({ success: true, message: 'Readiness question deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startAssessment,
  submitAssessment,
  getResult,
  adminCreateQuestion,
  adminBulkCreateQuestions,
  adminListQuestions,
  adminDeleteQuestion,
};
