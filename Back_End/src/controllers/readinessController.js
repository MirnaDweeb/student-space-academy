const ReadinessQuestion = require('../models/ReadinessQuestion');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const Course = require('../models/Course');
const Application = require('../models/Application');
const Invoice = require('../models/Invoice');
const { scoreAttempt } = require('../services/readinessService');
const { autoAcceptAndReserveSeat } = require('../services/admissionService');
const { notify } = require('../services/notificationService');
const { AppError } = require('../middleware/error');

/**
 * Resolve questions for a course:
 * 1. Course-specific questions if configured
 * 2. Shared default questions fallback
 */
async function getQuestionsForCourse(course) {
  // 1. Try to find course-specific custom questions
  let questions = await ReadinessQuestion.aggregate([
    { $match: { course: course._id, isDefault: { $ne: true } } },
    { $sample: { size: 12 } },
  ]);

  // Auto-ensure CrossFit readiness bank if accessing CrossFit course
  if (questions.length === 0 && (course.slug === 'crossfit-functional-fitness-program' || /crossfit/i.test(course.title))) {
    try {
      const { ensureCrossfitCourse } = require('../services/crossfitInitService');
      await ensureCrossfitCourse();
      questions = await ReadinessQuestion.aggregate([
        { $match: { course: course._id, isDefault: { $ne: true } } },
        { $sample: { size: 12 } },
      ]);
    } catch (seedErr) {
      console.error('[CROSSFIT SEED ERROR]', seedErr);
    }
  }

  // 2. Fallback to shared/default readiness question bank
  if (questions.length === 0) {
    try {
      const { ensureDefaultReadinessQuestions } = require('../services/defaultReadinessInitService');
      await ensureDefaultReadinessQuestions();

      questions = await ReadinessQuestion.aggregate([
        { $match: { $or: [{ course: null }, { isDefault: true }] } },
        { $sample: { size: 12 } },
      ]);
    } catch (defaultErr) {
      console.error('[DEFAULT READINESS ERROR]', defaultErr);
    }
  }

  // 3. Fallback to any default questions if aggregate returned empty
  if (questions.length === 0) {
    questions = await ReadinessQuestion.find({ isDefault: true }).limit(12);
  }

  return questions;
}

async function startAssessment(req, res, next) {
  try {
    const courseId = req.body?.courseId || req.query?.courseId;
    if (!courseId) throw new AppError('Course ID is required.', 400);

    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const retake = req.body?.retake === true || req.query?.retake === 'true';

    // Requirement 9: Prevent duplicate active attempts (resume if in-progress)
    if (!retake && typeof ReadinessAttempt.findOne === 'function') {
      try {
        const query = ReadinessAttempt.findOne({
          student: req.user?._id,
          course: course._id,
          status: 'InProgress',
        });
        const existingAttempt = query && typeof query.populate === 'function'
          ? await query.populate('questions')
          : (query && typeof query.then === 'function' ? await query : null);

        if (existingAttempt && Array.isArray(existingAttempt.questions) && existingAttempt.questions.length > 0) {
          const validQuestions = existingAttempt.questions.filter((q) => q && q.question);
          if (validQuestions.length > 0) {
            const questionsForClient = validQuestions.map((q) => ({
              id: q._id,
              question: q.question,
              options: q.options,
              topic: q.topic,
              difficulty: q.difficulty,
            }));

            return res.status(200).json({
              success: true,
              data: {
                attemptId: existingAttempt._id,
                questions: questionsForClient,
                resumed: true,
                answers: existingAttempt.answers || [],
                course: {
                  id: course._id,
                  title: course.title,
                  slug: course.slug,
                },
              },
            });
          }
        }
      } catch (_) {
        // Fallback safely to create a new attempt if mock doesn't support query chaining
      }
    }

    const questions = await getQuestionsForCourse(course);

    if (questions.length === 0) {
      throw new AppError('Unable to load readiness assessment questions at this time.', 500);
    }

    const attempt = await ReadinessAttempt.create({
      student: req.user._id,
      course: course._id,
      questions: questions.map((q) => q._id),
      status: 'InProgress',
    });

    // Strip correctAnswerIndex before sending to student
    const questionsForClient = questions.map((q) => ({
      id: q._id,
      question: q.question,
      options: q.options,
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    res.status(201).json({
      success: true,
      data: {
        attemptId: attempt._id,
        questions: questionsForClient,
        resumed: false,
        course: {
          id: course._id,
          title: course.title,
          slug: course.slug,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getAttempt(req, res, next) {
  try {
    const attempt = await ReadinessAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
    })
      .populate('course', 'title slug level category price currency')
      .populate('questions');

    if (!attempt) throw new AppError('Assessment attempt not found.', 404);

    const validQuestions = (attempt.questions || []).filter((q) => q && q.question);
    const questionsForClient = validQuestions.map((q) => ({
      id: q._id,
      question: q.question,
      options: q.options,
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        course: attempt.course,
        status: attempt.status,
        score: attempt.score,
        outcome: attempt.outcome,
        questions: questionsForClient,
        answers: attempt.answers || [],
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentStatus(req, res, next) {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const inProgressAttempt = await ReadinessAttempt.findOne({
      student: req.user._id,
      course: course._id,
      status: 'InProgress',
    }).sort({ createdAt: -1 });

    const latestSubmittedAttempt = await ReadinessAttempt.findOne({
      student: req.user._id,
      course: course._id,
      status: 'Submitted',
    }).sort({ submittedAt: -1 });

    const hasCustomQuestions = !!(await ReadinessQuestion.exists({
      course: course._id,
      isDefault: { $ne: true },
    }));

    res.json({
      success: true,
      data: {
        course: {
          id: course._id,
          title: course.title,
          slug: course.slug,
        },
        hasCustomQuestions,
        hasAssessment: true,
        inProgressAttemptId: inProgressAttempt ? inProgressAttempt._id : null,
        latestSubmittedAttemptId: latestSubmittedAttempt ? latestSubmittedAttempt._id : null,
        latestOutcome: latestSubmittedAttempt ? latestSubmittedAttempt.outcome : null,
        latestScore: latestSubmittedAttempt ? latestSubmittedAttempt.score : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function submitAssessment(req, res, next) {
  try {
    const { answers } = req.body; // [{ questionId, selectedIndex }]
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      throw new AppError('Assessment submission must contain an array of answers.', 400);
    }

    const attempt = await ReadinessAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
    }).populate('questions');

    if (!attempt) throw new AppError('Assessment attempt not found.', 404);
    if (attempt.status === 'Submitted') throw new AppError('Assessment already submitted.', 400);

    const course = await Course.findById(attempt.course);
    if (!course) throw new AppError('Course not found.', 404);

    attempt.answers = attempt.questions.map((q) => {
      const given = answers.find((a) => a && (a.questionId === q._id.toString() || a.questionId === q._id));
      const selectedIndex = given && typeof given.selectedIndex === 'number'
        ? given.selectedIndex
        : (given && typeof given.selectedAnswerIndex === 'number' ? given.selectedAnswerIndex : -1);
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

    // Retrieve Student Profile and evaluate prerequisite fit check snapshot
    let fitSnapshot = null;
    try {
      const StudentProfile = require('../models/StudentProfile');
      const { checkCourseFit } = require('../services/eligibilityService');
      const profile = await StudentProfile.findOne({ user: req.user._id });
      if (profile) {
        fitSnapshot = await checkCourseFit(profile, course);
      }
    } catch (_) {}

    const isDirectPermitted = course.directEnrollmentPermitted !== false;
    const isPrereqEligible = fitSnapshot ? fitSnapshot.result === 'Eligible' : true;
    const resolvedEligibility = (isDirectPermitted && isPrereqEligible) ? 'Eligible' : 'Not Eligible';

    // Link and update active application for this student & course
    let linkedApp = await Application.findOne({
      student: req.user._id,
      course: course._id,
      status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected', 'Confirmed', 'Completed'] },
    }).sort({ createdAt: -1 });

    let admissionResult = null;

    if (['READY', 'ELIGIBLE', 'CONDITIONALLY_READY'].includes(outcome)) {
      if (!linkedApp) {
        linkedApp = await Application.create({
          student: req.user._id,
          course: course._id,
          readinessAttempt: attempt._id,
          status: 'Submitted',
          eligibilityStatus: 'Eligible',
          fitResultSnapshot: fitSnapshot || undefined,
          statusHistory: [{ status: 'Submitted', note: `Readiness completed with score ${score}% (${outcome}).` }],
          submittedAt: new Date(),
        });
      } else {
        linkedApp.readinessAttempt = attempt._id;
        linkedApp.eligibilityStatus = 'Eligible';
        if (fitSnapshot && !linkedApp.fitResultSnapshot) linkedApp.fitResultSnapshot = fitSnapshot;
        await linkedApp.save();
      }

      // Automatically accept, atomically reserve seat, and issue payable invoice
      admissionResult = await autoAcceptAndReserveSeat({
        application: linkedApp,
        studentId: req.user._id,
        courseId: course._id,
      });

      if (admissionResult?.application) {
        linkedApp = admissionResult.application;
      }
    } else if (['FOUNDATION_REQUIRED', 'FOUNDATION_RECOMMENDED'].includes(outcome)) {
      if (!linkedApp) {
        linkedApp = await Application.create({
          student: req.user._id,
          course: course._id,
          readinessAttempt: attempt._id,
          status: 'Foundation Recommended',
          eligibilityStatus: resolvedEligibility,
          fitResultSnapshot: fitSnapshot || undefined,
          statusHistory: [{
            status: 'Foundation Recommended',
            note: `Readiness assessment score ${score}% (${outcome}). Foundational conditioning recommended.`,
            changedAt: new Date(),
          }],
          submittedAt: new Date(),
        });
      } else {
        linkedApp.readinessAttempt = attempt._id;
        linkedApp.eligibilityStatus = resolvedEligibility;
        linkedApp.status = 'Foundation Recommended';
        if (fitSnapshot && !linkedApp.fitResultSnapshot) linkedApp.fitResultSnapshot = fitSnapshot;
        linkedApp.statusHistory = linkedApp.statusHistory || [];
        linkedApp.statusHistory.push({
          status: 'Foundation Recommended',
          note: `Readiness assessment score ${score}% (${outcome}). Foundational conditioning recommended.`,
          changedAt: new Date(),
        });
        await linkedApp.save();
      }
    } else {
      // MANUAL_REVIEW
      if (!linkedApp) {
        linkedApp = await Application.create({
          student: req.user._id,
          course: course._id,
          readinessAttempt: attempt._id,
          status: 'Manual Review',
          eligibilityStatus: 'In Progress',
          statusHistory: [{
            status: 'Manual Review',
            note: `Readiness assessment score ${score}% (${outcome}). Academic Committee review required.`,
            changedAt: new Date(),
          }],
          submittedAt: new Date(),
        });
      } else {
        linkedApp.readinessAttempt = attempt._id;
        linkedApp.eligibilityStatus = 'In Progress';
        linkedApp.status = 'Manual Review';
        linkedApp.statusHistory = linkedApp.statusHistory || [];
        linkedApp.statusHistory.push({
          status: 'Manual Review',
          note: `Readiness assessment score ${score}% (${outcome}). Academic Committee review required.`,
          changedAt: new Date(),
        });
        await linkedApp.save();
      }
    }

    await notify({
      recipient: req.user._id,
      title: 'Readiness Assessment Result',
      message: `You scored ${score}% on ${course.title}. Outcome: ${outcome.replace(/_/g, ' ')}.`,
      type: ['READY', 'ELIGIBLE'].includes(outcome) ? 'success' : 'warning',
      relatedCourse: course._id,
    });

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        score,
        outcome,
        knowledgeGaps,
        linkedApplicationId: linkedApp ? linkedApp._id : null,
        applicationStatus: linkedApp ? linkedApp.status : null,
        invoiceId: admissionResult?.invoice ? admissionResult.invoice._id : null,
        waitlisted: admissionResult?.waitlisted || (linkedApp?.status === 'Waitlisted'),
        waitlistPosition: admissionResult?.waitlistPosition || linkedApp?.waitlistPosition,
      },
    });
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
      .populate('course', 'title slug level price currency duration deliveryMode')
      .populate('recommendedCourse', 'title slug level');

    if (!attempt) throw new AppError('Assessment attempt not found.', 404);
    if (attempt.status !== 'Submitted') throw new AppError('Assessment not yet submitted.', 400);

    // Look up linked active application and invoice
    let linkedApp = null;
    let invoice = null;
    if (attempt.course?._id) {
      linkedApp = await Application.findOne({
        student: req.user._id,
        course: attempt.course._id,
        status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected'] },
      }).sort({ createdAt: -1 });

      if (linkedApp) {
        if (!linkedApp.readinessAttempt) {
          linkedApp.readinessAttempt = attempt._id;
          await linkedApp.save();
        }

        // Self-heal eligible applications previously stuck in Under Review
        if (linkedApp.eligibilityStatus === 'Eligible' && ['Under Review', 'Submitted'].includes(linkedApp.status)) {
          const healed = await autoAcceptAndReserveSeat({
            application: linkedApp,
            studentId: req.user._id,
            courseId: attempt.course._id,
          });
          if (healed?.application) linkedApp = healed.application;
        }

        invoice = await Invoice.findOne({ application: linkedApp._id, student: req.user._id });
      }
    }

    res.json({
      success: true,
      data: {
        ...attempt.toObject(),
        application: linkedApp || null,
        invoice: invoice || null,
      },
    });
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
  getAttempt,
  getAssessmentStatus,
  submitAssessment,
  getResult,
  adminCreateQuestion,
  adminBulkCreateQuestions,
  adminListQuestions,
  adminDeleteQuestion,
};
