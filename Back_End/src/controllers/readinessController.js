const ReadinessQuestion = require('../models/ReadinessQuestion');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const Course = require('../models/Course');
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

module.exports = { startAssessment, submitAssessment, getResult };
