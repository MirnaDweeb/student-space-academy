const path = require('path');
const fs = require('fs');
const Assessment = require('../models/Assessment');
const AssessmentResult = require('../models/AssessmentResult');
const StudentSubmission = require('../models/StudentSubmission');
const Enrollment = require('../models/Enrollment');
const Cohort = require('../models/Cohort');
const Course = require('../models/Course');
const TrainingSession = require('../models/TrainingSession');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/error');

/**
 * Creates an institutional notification safely without blocking main thread.
 */
async function sendNotification(recipientId, title, message, type = 'info', courseId = null) {
  try {
    await Notification.create({
      title,
      message,
      type,
      recipient: recipientId,
      relatedCourse: courseId || undefined,
    });
  } catch (err) {
    console.error('[ASSESSMENT] Failed to dispatch notification:', err.message);
  }
}

/**
 * Creates an assessment definition for a specific cohort.
 * Only instructors or administrators can create assessments.
 */
async function createAssessment(callerUser, data) {
  if (!['instructor', 'admin', 'superadmin'].includes(callerUser.role)) {
    throw new AppError('Only faculty instructors and administrators can define course assessments.', 403);
  }

  const {
    title,
    description,
    instructions,
    attachments,
    submissionType = 'file',
    allowLateSubmission = false,
    allowResubmission = false,
    availableDate,
    type,
    courseId,
    cohortId,
    sessionId,
    maxScore = 100,
    passingScore = 70,
    weight = 25,
    dueDate,
    assessmentDate,
    rubric,
    isMandatory = true,
  } = data;

  if (!title || !courseId || !cohortId) {
    throw new AppError('Title, Course ID, and Cohort ID are required to define an assessment.', 400);
  }

  if (maxScore <= 0) {
    throw new AppError('Maximum score must be greater than zero.', 400);
  }

  if (passingScore < 0 || passingScore > maxScore) {
    throw new AppError('Passing score must be between 0 and maximum score.', 400);
  }

  const [course, cohort] = await Promise.all([
    Course.findById(courseId),
    Cohort.findById(cohortId),
  ]);

  if (!course) throw new AppError('Course not found.', 404);
  if (!cohort) throw new AppError('Cohort not found.', 404);

  const assessment = await Assessment.create({
    title: title.trim(),
    description: description ? description.trim() : '',
    instructions: instructions ? instructions.trim() : '',
    attachments: Array.isArray(attachments) ? attachments : [],
    submissionType: ['file', 'text', 'both'].includes(submissionType) ? submissionType : 'file',
    allowLateSubmission: Boolean(allowLateSubmission),
    allowResubmission: Boolean(allowResubmission),
    availableDate: availableDate ? new Date(availableDate) : (assessmentDate ? new Date(assessmentDate) : new Date()),
    type: type || 'Technical Assessment',
    course: courseId,
    cohort: cohortId,
    session: sessionId || undefined,
    instructor: callerUser._id,
    instructorName: callerUser.fullName || 'EGSA Faculty',
    maxScore: Number(maxScore),
    passingScore: Number(passingScore),
    weight: Number(weight),
    dueDate: dueDate ? new Date(dueDate) : undefined,
    assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
    rubric: rubric || '',
    isMandatory: Boolean(isMandatory),
    status: 'Scheduled',
  });

  // Notify active enrolled students in this cohort
  try {
    const q = Enrollment.find({
      cohort: cohortId,
      status: { $in: ['Active', 'Confirmed'] },
    });
    const enrollments = q && typeof q.select === 'function' ? await q.select('student') : await q;

    if (Array.isArray(enrollments)) {
      for (const enr of enrollments) {
        if (enr?.student) {
          await sendNotification(
            enr.student,
            'New Assessment Available',
            `New assessment available: "${assessment.title}". Please review instructions and deadlines in My Training.`,
            'info',
            courseId
          );
        }
      }
    }
  } catch (notifErr) {
    console.error('[ASSESSMENT] Failed to notify cohort students:', notifErr.message);
  }

  return assessment;
}

/**
 * Updates an assessment definition.
 */
async function updateAssessment(assessmentId, callerUser, updates) {
  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) throw new AppError('Assessment not found.', 404);

  const isAdmin = ['admin', 'superadmin'].includes(callerUser.role);
  const isAssignedInstructor = String(assessment.instructor) === String(callerUser._id);

  if (!isAdmin && !isAssignedInstructor) {
    throw new AppError('You do not have permission to modify this assessment definition.', 403);
  }

  if (updates.title) assessment.title = updates.title.trim();
  if (updates.description !== undefined) assessment.description = updates.description.trim();
  if (updates.instructions !== undefined) assessment.instructions = updates.instructions.trim();
  if (updates.attachments !== undefined) assessment.attachments = updates.attachments;
  if (updates.submissionType) assessment.submissionType = updates.submissionType;
  if (updates.allowLateSubmission !== undefined) assessment.allowLateSubmission = Boolean(updates.allowLateSubmission);
  if (updates.allowResubmission !== undefined) assessment.allowResubmission = Boolean(updates.allowResubmission);
  if (updates.availableDate) assessment.availableDate = new Date(updates.availableDate);
  if (updates.type) assessment.type = updates.type;
  if (updates.maxScore !== undefined) {
    if (updates.maxScore <= 0) throw new AppError('Maximum score must be greater than zero.', 400);
    assessment.maxScore = Number(updates.maxScore);
  }
  if (updates.passingScore !== undefined) {
    if (updates.passingScore < 0 || updates.passingScore > assessment.maxScore) {
      throw new AppError('Passing score must be between 0 and maximum score.', 400);
    }
    assessment.passingScore = Number(updates.passingScore);
  }
  if (updates.weight !== undefined) assessment.weight = Number(updates.weight);
  if (updates.dueDate) assessment.dueDate = new Date(updates.dueDate);
  if (updates.assessmentDate) assessment.assessmentDate = new Date(updates.assessmentDate);
  if (updates.status) assessment.status = updates.status;
  if (updates.rubric !== undefined) assessment.rubric = updates.rubric;

  await assessment.save();
  return assessment;
}

/**
 * Retrieves assessment details by ID with role-based filtering.
 */
async function getAssessmentById(assessmentId, callerUser) {
  const assessment = await Assessment.findById(assessmentId)
    .populate('course', 'title code category level instructor')
    .populate('cohort', 'name cohortCode startDate endDate status')
    .populate('session', 'title sessionNumber date location');

  if (!assessment) throw new AppError('Assessment not found.', 404);

  const isStaff = ['instructor', 'admin', 'superadmin'].includes(callerUser.role);

  if (isStaff) {
    const results = await AssessmentResult.find({ assessment: assessmentId })
      .populate('student', 'fullName email nationalId')
      .sort({ createdAt: -1 });

    const totalEvaluated = results.filter((r) => r.status === 'Published' || r.status === 'Finalized').length;
    const pendingDrafts = results.filter((r) => r.status === 'Draft').length;

    return {
      assessment,
      results,
      stats: {
        totalEvaluated,
        pendingDrafts,
        totalResults: results.length,
      },
    };
  }

  // Student view: Verify enrollment in cohort
  const cohortId = assessment.cohort?._id || assessment.cohort;
  const enrollment = await Enrollment.findOne({
    student: callerUser._id,
    cohort: cohortId,
    status: { $in: ['Active', 'Confirmed', 'Completed'] },
  });

  if (!enrollment) {
    throw new AppError('You are not authorized to view this assessment. Cohort enrollment required.', 403);
  }

  // Find student's submission
  const studentSubmission = await StudentSubmission.findOne({
    assessment: assessmentId,
    student: callerUser._id,
  });

  // Find student's official evaluation result
  const studentResult = await AssessmentResult.findOne({
    assessment: assessmentId,
    student: callerUser._id,
  }).populate('instructor', 'fullName email');

  const isPublished = studentResult && studentResult.status === 'Published';
  const now = new Date();
  const dueDate = assessment.dueDate || assessment.assessmentDate;
  const isDeadlinePassed = dueDate ? now > new Date(dueDate) : false;
  const canSubmit = (!studentSubmission || assessment.allowResubmission) && (!isDeadlinePassed || assessment.allowLateSubmission);

  return {
    assessment: {
      _id: assessment._id,
      id: assessment._id,
      title: assessment.title,
      description: assessment.description,
      instructions: assessment.instructions || '',
      type: assessment.type,
      course: assessment.course,
      cohort: assessment.cohort,
      session: assessment.session,
      instructorName: assessment.instructorName || 'EGSA Faculty',
      maxScore: assessment.maxScore,
      passingScore: assessment.passingScore,
      weight: assessment.weight,
      dueDate,
      availableDate: assessment.availableDate || assessment.createdAt,
      submissionType: assessment.submissionType || 'file',
      allowLateSubmission: Boolean(assessment.allowLateSubmission),
      allowResubmission: Boolean(assessment.allowResubmission),
      status: assessment.status,
      rubric: assessment.rubric,
      isDeadlinePassed,
      canSubmit,
      attachments: (assessment.attachments || []).map((att) => ({
        fileName: att.fileName,
        originalName: att.originalName,
        fileUrl: att.fileUrl,
        downloadUrl: `/api/assessments/${assessment._id}/attachment/${encodeURIComponent(att.fileName)}`,
        viewUrl: `/api/assessments/${assessment._id}/attachment/${encodeURIComponent(att.fileName)}?view=true`,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        uploadedAt: att.uploadedAt,
      })),
    },
    submission: studentSubmission
      ? {
          _id: studentSubmission._id,
          id: studentSubmission._id,
          submissionType: studentSubmission.submissionType,
          textAnswer: studentSubmission.textAnswer,
          file: studentSubmission.file
            ? {
                fileName: studentSubmission.file.fileName,
                originalName: studentSubmission.file.originalName,
                fileUrl: studentSubmission.file.fileUrl,
                downloadUrl: `/api/assessments/submissions/${studentSubmission._id}/file`,
                viewUrl: `/api/assessments/submissions/${studentSubmission._id}/file?view=true`,
                mimeType: studentSubmission.file.mimeType,
                sizeBytes: studentSubmission.file.sizeBytes,
                uploadedAt: studentSubmission.file.uploadedAt,
              }
            : null,
          submittedAt: studentSubmission.submittedAt,
          isLate: studentSubmission.isLate,
          version: studentSubmission.version,
          status: studentSubmission.status,
          history: (studentSubmission.history || []).map((h) => ({
            version: h.version,
            submittedAt: h.submittedAt,
            isLate: h.isLate,
            originalName: h.file?.originalName,
            textAnswerSnippet: h.textAnswer ? h.textAnswer.slice(0, 100) : '',
          })),
        }
      : null,
    result: isPublished
      ? {
          score: studentResult.score,
          maxScore: studentResult.maxScore,
          percentage: studentResult.percentage,
          resultLabel: studentResult.resultLabel,
          feedback: studentResult.feedback,
          strengths: studentResult.strengths,
          improvementAreas: studentResult.improvementAreas,
          evaluatedAt: studentResult.evaluatedAt,
          instructorName: studentResult.instructor?.fullName || assessment.instructorName || 'EGSA Faculty',
          status: 'Evaluated',
        }
      : null,
    submissionStatus: studentSubmission ? 'Submitted' : 'Not Submitted',
    evaluationStatus: isPublished ? 'Evaluated' : (studentSubmission ? 'Pending' : 'Not Evaluated'),
  };
}

/**
 * Lists assessments filterable by course, cohort, and status.
 */
async function listAssessments(callerUser, query = {}) {
  const filter = {};
  if (query.courseId) filter.course = query.courseId;
  if (query.cohortId) filter.cohort = query.cohortId;
  if (query.status && query.status !== 'ALL') filter.status = query.status;
  if (query.type) filter.type = query.type;

  const isStaff = ['instructor', 'admin', 'superadmin'].includes(callerUser.role);

  if (!isStaff) {
    // If student, list only assessments belonging to cohorts they are enrolled in
    const enrollments = await Enrollment.find({
      student: callerUser._id,
      status: { $in: ['Active', 'Confirmed', 'Completed'] },
    }).select('cohort course');

    const cohortIds = enrollments.map((e) => e.cohort).filter(Boolean);
    filter.cohort = { $in: cohortIds };
  }

  const assessments = await Assessment.find(filter)
    .populate('course', 'title code category level')
    .populate('cohort', 'name cohortCode startDate endDate status')
    .populate('session', 'title sessionNumber date')
    .sort({ dueDate: 1, assessmentDate: 1, createdAt: -1 });

  return assessments;
}

/**
 * Returns roster of students enrolled in the assessment's cohort with their current evaluation state.
 * Accessible to assigned instructor and admin only.
 */
async function getCohortStudentsForAssessment(assessmentId, callerUser) {
  if (!['instructor', 'admin', 'superadmin'].includes(callerUser.role)) {
    throw new AppError('Only faculty instructors and administrators can inspect student assessment rosters.', 403);
  }

  const assessment = await Assessment.findById(assessmentId)
    .populate('course', 'title code')
    .populate('cohort', 'name cohortCode');

  if (!assessment) throw new AppError('Assessment not found.', 404);

  // Find all active enrollments for this cohort
  const enrollments = await Enrollment.find({
    cohort: assessment.cohort._id,
    status: { $in: ['Active', 'Confirmed', 'Completed'] },
  }).populate('student', 'fullName email phone nationalId');

  // Find all existing evaluation results for this assessment
  const existingResults = await AssessmentResult.find({
    assessment: assessmentId,
  }).populate('instructor', 'fullName email');

  const resultMap = new Map();
  existingResults.forEach((r) => {
    resultMap.set(String(r.student._id || r.student), r);
  });

  const studentRoster = enrollments.map((enr) => {
    const studentUser = enr.student;
    const result = studentUser ? resultMap.get(String(studentUser._id)) : null;

    return {
      enrollmentId: enr._id,
      student: studentUser
        ? {
            _id: studentUser._id,
            fullName: studentUser.fullName,
            email: studentUser.email,
            phone: studentUser.phone,
            nationalId: studentUser.nationalId,
          }
        : null,
      evaluation: result
        ? {
            _id: result._id,
            score: result.score,
            maxScore: result.maxScore,
            percentage: result.percentage,
            resultLabel: result.resultLabel,
            status: result.status,
            feedback: result.feedback,
            strengths: result.strengths,
            improvementAreas: result.improvementAreas,
            instructorNote: result.instructorNote,
            evaluatedAt: result.evaluatedAt,
            finalizedAt: result.finalizedAt,
            publishedAt: result.publishedAt,
            instructorName: result.instructor?.fullName || 'EGSA Faculty',
            auditTrail: result.auditTrail,
          }
        : null,
      status: result ? result.status : 'Not_Evaluated',
    };
  });

  return {
    assessment,
    roster: studentRoster,
    summary: {
      totalStudents: studentRoster.length,
      evaluatedCount: studentRoster.filter((s) => s.status === 'Published' || s.status === 'Finalized').length,
      draftCount: studentRoster.filter((s) => s.status === 'Draft').length,
      notEvaluatedCount: studentRoster.filter((s) => s.status === 'Not_Evaluated').length,
    },
  };
}

/**
 * Records or updates a student's evaluation result.
 * Supports Save as Draft vs Finalize directly.
 */
async function recordEvaluation(assessmentId, studentId, instructorUser, data) {
  if (!['instructor', 'admin', 'superadmin'].includes(instructorUser.role)) {
    throw new AppError('Only faculty instructors and administrators can evaluate students.', 403);
  }

  const { score, feedback = '', strengths = '', improvementAreas = '', instructorNote = '', saveAsDraft = true, reason = '' } = data;

  if (score === undefined || score === null || isNaN(score)) {
    throw new AppError('Valid numeric score is required.', 400);
  }

  const numericScore = Number(score);

  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) throw new AppError('Assessment not found.', 404);

  if (numericScore < 0 || numericScore > assessment.maxScore) {
    throw new AppError(`Score must be between 0 and maximum score (${assessment.maxScore}).`, 400);
  }

  // Verify student enrollment in the assessment's cohort
  const enrollment = await Enrollment.findOne({
    student: studentId,
    cohort: assessment.cohort,
    status: { $in: ['Active', 'Confirmed', 'Completed'] },
  });

  if (!enrollment) {
    throw new AppError('Student is not an active enrolled member of this assessment cohort.', 400);
  }

  const percentage = Math.round((numericScore / assessment.maxScore) * 1000) / 10;
  let resultLabel = 'Pending';
  if (assessment.passingScore !== undefined && assessment.passingScore !== null) {
    resultLabel = numericScore >= assessment.passingScore ? 'Passed' : 'Failed';
  }

  const status = saveAsDraft ? 'Draft' : 'Finalized';
  const now = new Date();

  let existingResult = await AssessmentResult.findOne({
    assessment: assessmentId,
    student: studentId,
  });

  const isAdmin = ['admin', 'superadmin'].includes(instructorUser.role);

  if (existingResult) {
    const isLocked = existingResult.status === 'Finalized' || existingResult.status === 'Published';

    // If locked and not admin, require reason or restrict
    if (isLocked && !isAdmin && !reason) {
      throw new AppError('This evaluation has already been finalized. An official explanation/reason is required to modify it.', 400);
    }

    const previousScore = existingResult.score;
    const previousStatus = existingResult.status;

    existingResult.score = numericScore;
    existingResult.maxScore = assessment.maxScore;
    existingResult.percentage = percentage;
    existingResult.resultLabel = resultLabel;
    existingResult.feedback = feedback.trim();
    existingResult.strengths = strengths.trim();
    existingResult.improvementAreas = improvementAreas.trim();
    existingResult.instructorNote = instructorNote.trim();
    existingResult.instructor = instructorUser._id;
    existingResult.evaluatedAt = now;

    if (!saveAsDraft && existingResult.status === 'Draft') {
      existingResult.status = 'Finalized';
      existingResult.finalizedAt = now;
      existingResult.finalizedBy = instructorUser._id;
    }

    // Record audit trail if state changed or locked record was modified
    if (isLocked || previousScore !== numericScore) {
      existingResult.auditTrail.push({
        action: isAdmin && isLocked ? 'Admin_Override' : 'Updated_Draft',
        previousScore,
        newScore: numericScore,
        previousStatus,
        newStatus: existingResult.status,
        changedBy: instructorUser._id,
        changedAt: now,
        reason: reason || 'Instructor updated score and feedback.',
      });
    }

    await existingResult.save();
    return existingResult;
  }

  // Create new result
  const newResult = await AssessmentResult.create({
    assessment: assessmentId,
    student: studentId,
    enrollment: enrollment._id,
    instructor: instructorUser._id,
    course: assessment.course,
    cohort: assessment.cohort,
    score: numericScore,
    maxScore: assessment.maxScore,
    percentage,
    status,
    resultLabel,
    feedback: feedback.trim(),
    strengths: strengths.trim(),
    improvementAreas: improvementAreas.trim(),
    instructorNote: instructorNote.trim(),
    evaluatedAt: now,
    finalizedAt: !saveAsDraft ? now : undefined,
    finalizedBy: !saveAsDraft ? instructorUser._id : undefined,
    auditTrail: [
      {
        action: saveAsDraft ? 'Created_Draft' : 'Finalized',
        newScore: numericScore,
        newStatus: status,
        changedBy: instructorUser._id,
        changedAt: now,
        reason: saveAsDraft ? 'Initial evaluation draft saved.' : 'Initial evaluation finalized.',
      },
    ],
  });

  return newResult;
}

/**
 * Finalizes an evaluation result, locking it.
 */
async function finalizeEvaluation(resultId, callerUser) {
  if (!['instructor', 'admin', 'superadmin'].includes(callerUser.role)) {
    throw new AppError('Only faculty instructors and administrators can finalize evaluations.', 403);
  }

  const result = await AssessmentResult.findById(resultId);
  if (!result) throw new AppError('Assessment result record not found.', 404);

  if (result.status === 'Finalized' || result.status === 'Published') {
    return result; // already finalized
  }

  const now = new Date();
  const previousStatus = result.status;
  result.status = 'Finalized';
  result.finalizedAt = now;
  result.finalizedBy = callerUser._id;

  result.auditTrail.push({
    action: 'Finalized',
    previousScore: result.score,
    newScore: result.score,
    previousStatus,
    newStatus: 'Finalized',
    changedBy: callerUser._id,
    changedAt: now,
    reason: 'Instructor finalized evaluation record.',
  });

  await result.save();
  return result;
}

/**
 * Publishes an evaluation result, making it visible to the student and dispatching notification.
 */
async function publishEvaluation(resultId, callerUser) {
  if (!['instructor', 'admin', 'superadmin'].includes(callerUser.role)) {
    throw new AppError('Only faculty instructors and administrators can publish evaluations.', 403);
  }

  const result = await AssessmentResult.findById(resultId)
    .populate('assessment', 'title course maxScore passingScore')
    .populate('student', 'fullName email');

  if (!result) throw new AppError('Assessment result record not found.', 404);

  const now = new Date();
  const previousStatus = result.status;

  result.status = 'Published';
  result.publishedAt = now;
  result.publishedBy = callerUser._id;
  if (!result.finalizedAt) {
    result.finalizedAt = now;
    result.finalizedBy = callerUser._id;
  }

  result.auditTrail.push({
    action: 'Published',
    previousScore: result.score,
    newScore: result.score,
    previousStatus,
    newStatus: 'Published',
    changedBy: callerUser._id,
    changedAt: now,
    reason: 'Instructor authorized official publication of evaluation to student.',
  });

  await result.save();

  // Notify student
  await sendNotification(
    result.student._id,
    'Official Assessment Evaluation Available',
    `Your evaluation for "${result.assessment?.title || 'Course Assessment'}" has been published by your instructor. Outcome: ${result.resultLabel} (${result.percentage}%).`,
    result.resultLabel === 'Passed' ? 'success' : 'info',
    result.course
  );

  return result;
}

/**
 * Retrieves the student's complete assessment record across enrolled courses.
 * Grouped into: Upcoming, Submitted, Evaluated.
 * Enforces privacy: internal instructor notes and unfinalized drafts are NEVER exposed.
 */
async function getStudentAssessments(studentId, query = {}) {
  // Find all active/confirmed/completed enrollments
  const enrollments = await Enrollment.find({
    student: studentId,
    status: { $in: ['Active', 'Confirmed', 'Completed'] },
  })
    .populate('course', 'title code category level instructor')
    .populate('cohort', 'name cohortCode startDate endDate status');

  const cohortIds = enrollments.map((e) => e.cohort?._id).filter(Boolean);

  if (cohortIds.length === 0) {
    return {
      assessments: [],
      sections: {
        upcoming: [],
        submitted: [],
        evaluated: [],
      },
      summary: {
        totalAssessments: 0,
        completedCount: 0,
        pendingCount: 0,
        upcomingCount: 0,
        averagePercentage: null,
      },
    };
  }

  // Find all assessments for these cohorts
  const assessmentFilter = { cohort: { $in: cohortIds } };
  if (query.courseId) assessmentFilter.course = query.courseId;

  const assessments = await Assessment.find(assessmentFilter)
    .populate('course', 'title code category level')
    .populate('cohort', 'name cohortCode')
    .populate('session', 'title sessionNumber date')
    .sort({ dueDate: 1, assessmentDate: 1, createdAt: 1 });

  // Find all submissions for this student
  const submissions = await StudentSubmission.find({
    student: studentId,
    cohort: { $in: cohortIds },
  });

  const submissionMap = new Map();
  submissions.forEach((s) => {
    submissionMap.set(String(s.assessment), s);
  });

  // Find all evaluation results for this student
  const results = await AssessmentResult.find({
    student: studentId,
    cohort: { $in: cohortIds },
  }).populate('instructor', 'fullName email');

  const resultMap = new Map();
  results.forEach((r) => {
    resultMap.set(String(r.assessment), r);
  });

  const now = new Date();

  const formattedAssessments = assessments.map((a) => {
    const s = submissionMap.get(String(a._id));
    const r = resultMap.get(String(a._id));
    const isPublished = r && r.status === 'Published';
    const isSubmitted = Boolean(s);
    const dueDate = a.dueDate || a.assessmentDate;
    const isDeadlinePassed = dueDate ? now > new Date(dueDate) : false;

    const isEvaluatedButNotPublished = r && (r.status === 'Draft' || r.status === 'Finalized');

    let studentStatus = 'Upcoming';
    let submissionStatus = 'Not Submitted';
    let evaluationStatus = 'Not Evaluated';

    if (isPublished) {
      studentStatus = 'Evaluated';
      submissionStatus = 'Submitted';
      evaluationStatus = 'Evaluated';
    } else if (isSubmitted) {
      studentStatus = 'Submitted';
      submissionStatus = 'Submitted';
      evaluationStatus = 'Pending';
    } else if (isEvaluatedButNotPublished) {
      studentStatus = 'Pending Evaluation';
      submissionStatus = 'Submitted';
      evaluationStatus = 'Pending';
    } else {
      studentStatus = 'Upcoming';
      submissionStatus = 'Not Submitted';
      evaluationStatus = 'Scheduled';
    }

    return {
      _id: a._id,
      id: a._id,
      assessmentId: a._id,
      title: a.title,
      description: a.description,
      instructions: a.instructions || '',
      type: a.type,
      course: a.course,
      cohort: a.cohort,
      courseId: a.course?._id,
      courseTitle: a.course?.title,
      courseCode: a.course?.code,
      cohortId: a.cohort?._id,
      cohortName: a.cohort?.name,
      sessionTitle: a.session?.title,
      sessionDate: a.session?.date,
      dueDate,
      availableDate: a.availableDate || a.createdAt,
      maxScore: a.maxScore,
      passingScore: a.passingScore,
      weight: a.weight,
      isMandatory: a.isMandatory !== false,
      instructorName: (isPublished && r.instructor?.fullName) || a.instructorName || 'EGSA Faculty',
      submissionType: a.submissionType || 'file',
      allowLateSubmission: Boolean(a.allowLateSubmission),
      allowResubmission: Boolean(a.allowResubmission),
      isDeadlinePassed,
      attachmentsCount: (a.attachments || []).length,

      // Submission status fields
      isSubmitted,
      submissionStatus,
      evaluationStatus,
      status: studentStatus,
      rawStatus: studentStatus,
      submittedAt: s?.submittedAt || (isPublished ? r.evaluatedAt : null),
      submittedFile: s?.file?.originalName || null,
      submissionVersion: s?.version || null,
      isLate: s?.isLate || false,

      // Results safely protected: only exposed if status === 'Published'
      score: isPublished ? r.score : null,
      percentage: isPublished ? r.percentage : null,
      resultLabel: isPublished ? r.resultLabel : (isSubmitted ? 'Pending' : null),
      feedback: isPublished ? r.feedback : null,
      strengths: isPublished ? r.strengths : null,
      improvementAreas: isPublished ? r.improvementAreas : null,
      evaluatedAt: isPublished ? r.evaluatedAt : null,
    };
  });

  const evaluatedItems = formattedAssessments.filter((a) => a.status === 'Evaluated');
  const submittedItems = formattedAssessments.filter((a) => a.status === 'Submitted' || a.status === 'Pending Evaluation');
  const upcomingItems = formattedAssessments.filter((a) => a.status === 'Upcoming');

  const sumPercentage = evaluatedItems.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
  const averagePercentage = evaluatedItems.length > 0 ? Math.round(sumPercentage / evaluatedItems.length) : null;

  return {
    assessments: formattedAssessments,
    sections: {
      upcoming: upcomingItems,
      submitted: submittedItems,
      evaluated: evaluatedItems,
    },
    summary: {
      totalAssessments: formattedAssessments.length,
      completedCount: evaluatedItems.length,
      pendingCount: submittedItems.length,
      upcomingCount: upcomingItems.length,
      averagePercentage,
    },
  };
}

/**
 * Submits student work for an assessment.
 * Validates authenticated student enrollment, configured deadlines, and resubmission rules.
 */
async function submitAssessment(assessmentId, studentUser, data = {}, file = null) {
  if (studentUser.role !== 'student' && studentUser.role !== 'admin' && studentUser.role !== 'superadmin') {
    throw new AppError('Only students can submit assessments.', 403);
  }

  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) throw new AppError('Assessment not found.', 404);

  if (assessment.status === 'Cancelled') {
    throw new AppError('This assessment has been cancelled.', 400);
  }

  // Verify student enrollment in the assessment's cohort
  const cohortId = assessment.cohort?._id || assessment.cohort;
  const enrollment = await Enrollment.findOne({
    student: studentUser._id,
    cohort: cohortId,
    status: { $in: ['Active', 'Confirmed', 'Completed'] },
  });

  if (!enrollment) {
    throw new AppError('You are not an active enrolled member of this assessment cohort.', 403);
  }

  const now = new Date();
  let isLate = false;
  const dueDate = assessment.dueDate || assessment.assessmentDate;
  if (dueDate && now > new Date(dueDate)) {
    if (!assessment.allowLateSubmission) {
      throw new AppError('Submission deadline has passed. Late submissions are not accepted for this assessment.', 400);
    }
    isLate = true;
  }

  const submissionType = assessment.submissionType || 'file';
  const textAnswer = (data.textAnswer || '').trim();

  // Validate inputs
  if (submissionType === 'file' && !file) {
    throw new AppError('Please select a file to upload for this assessment.', 400);
  }
  if (submissionType === 'text' && !textAnswer) {
    throw new AppError('Please provide your written answer for this assessment.', 400);
  }
  if (submissionType === 'both') {
    if (!file && !textAnswer) {
      throw new AppError('Please provide a file upload and/or written response for this assessment.', 400);
    }
  }

  const filePayload = file
    ? {
        fileName: file.filename,
        originalName: file.originalname,
        fileUrl: `/uploads/assessments/${file.filename}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedAt: now,
      }
    : null;

  // Check existing submission
  let existing = await StudentSubmission.findOne({
    assessment: assessmentId,
    student: studentUser._id,
  });

  if (existing) {
    if (!assessment.allowResubmission) {
      throw new AppError('Resubmission is not permitted for this assessment.', 400);
    }

    const existingResult = await AssessmentResult.findOne({
      assessment: assessmentId,
      student: studentUser._id,
      status: { $in: ['Finalized', 'Published'] },
    });
    if (existingResult) {
      throw new AppError('This assessment has already been evaluated and finalized. Resubmission is closed.', 400);
    }

    // Save previous version in history
    existing.history.push({
      version: existing.version,
      file: existing.file,
      textAnswer: existing.textAnswer,
      submittedAt: existing.submittedAt,
      isLate: existing.isLate,
    });

    existing.version += 1;
    if (filePayload) existing.file = filePayload;
    if (textAnswer || submissionType === 'text') existing.textAnswer = textAnswer;
    existing.submittedAt = now;
    existing.isLate = isLate;
    existing.status = 'Resubmitted';
    await existing.save();

    await sendNotification(
      studentUser._id,
      'Assessment Resubmission Received',
      `Your new version (v${existing.version}) for "${assessment.title}" has been successfully submitted.`,
      'info',
      assessment.course
    );

    return existing;
  }

  // Create new submission
  const newSubmission = await StudentSubmission.create({
    assessment: assessmentId,
    student: studentUser._id,
    course: assessment.course,
    cohort: assessment.cohort,
    enrollment: enrollment._id,
    submissionType,
    textAnswer,
    file: filePayload || undefined,
    submittedAt: now,
    isLate,
    version: 1,
    status: 'Submitted',
    history: [],
  });

  await sendNotification(
    studentUser._id,
    'Assessment Submitted',
    `Your assessment submission for "${assessment.title}" has been successfully received.`,
    'success',
    assessment.course
  );

  return newSubmission;
}

/**
 * Downloads or views an assessment instructor attachment safely.
 */
async function downloadAttachment(assessmentId, filename, callerUser, res, isViewMode = false) {
  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) throw new AppError('Assessment not found.', 404);

  const isStaff = ['instructor', 'admin', 'superadmin'].includes(callerUser.role);
  if (!isStaff) {
    const enrollment = await Enrollment.findOne({
      student: callerUser._id,
      cohort: assessment.cohort,
      status: { $in: ['Active', 'Confirmed', 'Completed'] },
    });
    if (!enrollment) {
      throw new AppError('You do not have permission to access attachments for this cohort.', 403);
    }
  }

  const att = (assessment.attachments || []).find((a) => a.fileName === filename);
  if (!att) {
    throw new AppError('Attachment not found in this assessment.', 404);
  }

  const possiblePaths = [
    path.join(__dirname, '../../uploads/assessments', att.fileName),
    path.join(__dirname, '../../uploads/media', att.fileName),
    path.join(__dirname, '../../uploads', att.fileName),
  ];

  const filePath = possiblePaths.find((p) => fs.existsSync(p));
  if (!filePath) {
    throw new AppError('Attachment file is not currently available on the server.', 404);
  }

  if (isViewMode) {
    return res.sendFile(filePath);
  }
  return res.download(filePath, att.originalName || att.fileName);
}

/**
 * Downloads or views student submission file safely.
 */
async function downloadSubmissionFile(submissionId, callerUser, res, isViewMode = false) {
  const submission = await StudentSubmission.findById(submissionId).populate('assessment');
  if (!submission || !submission.file?.fileName) {
    throw new AppError('Submission file not found.', 404);
  }

  const isOwner = String(submission.student) === String(callerUser._id);
  const isStaff = ['instructor', 'admin', 'superadmin'].includes(callerUser.role);

  if (!isOwner && !isStaff) {
    throw new AppError('You do not have permission to access this student submission.', 403);
  }

  const filePath = path.join(__dirname, '../../uploads/assessments', submission.file.fileName);

  if (!fs.existsSync(filePath)) {
    throw new AppError('Submission file is not currently available on the server.', 404);
  }

  if (isViewMode) {
    return res.sendFile(filePath);
  }
  return res.download(filePath, submission.file.originalName || submission.file.fileName);
}

/**
 * Returns faculty overview metrics for instructor and admin dashboards.
 */
async function getOverviewStats(callerUser) {
  const isStaff = ['instructor', 'admin', 'superadmin'].includes(callerUser.role);
  if (!isStaff) throw new AppError('Unauthorized.', 403);

  const filter = {};
  if (callerUser.role === 'instructor') {
    filter.instructor = callerUser._id;
  }

  const [totalAssessments, allResults] = await Promise.all([
    Assessment.countDocuments(filter),
    AssessmentResult.find(filter).select('status score percentage'),
  ]);

  const completed = allResults.filter((r) => r.status === 'Published').length;
  const finalized = allResults.filter((r) => r.status === 'Finalized').length;
  const drafts = allResults.filter((r) => r.status === 'Draft').length;

  return {
    totalAssessments,
    totalEvaluations: allResults.length,
    completedCount: completed,
    finalizedCount: finalized,
    draftCount: drafts,
  };
}

module.exports = {
  createAssessment,
  updateAssessment,
  getAssessmentById,
  listAssessments,
  getCohortStudentsForAssessment,
  recordEvaluation,
  finalizeEvaluation,
  publishEvaluation,
  getStudentAssessments,
  submitAssessment,
  downloadAttachment,
  downloadSubmissionFile,
  getOverviewStats,
};
