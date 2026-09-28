const assessmentService = require('../services/assessmentService');

async function createAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.createAssessment(req.user, req.body);
    res.status(201).json({
      success: true,
      message: 'Assessment defined successfully.',
      data: assessment,
    });
  } catch (err) {
    next(err);
  }
}

async function updateAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.updateAssessment(req.params.id, req.user, req.body);
    res.json({
      success: true,
      message: 'Assessment updated successfully.',
      data: assessment,
    });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentById(req, res, next) {
  try {
    const data = await assessmentService.getAssessmentById(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listAssessments(req, res, next) {
  try {
    const assessments = await assessmentService.listAssessments(req.user, req.query);
    res.json({ success: true, data: assessments });
  } catch (err) {
    next(err);
  }
}

async function getCohortStudents(req, res, next) {
  try {
    const data = await assessmentService.getCohortStudentsForAssessment(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function recordEvaluation(req, res, next) {
  try {
    const result = await assessmentService.recordEvaluation(
      req.params.id,
      req.params.studentId,
      req.user,
      req.body
    );
    res.json({
      success: true,
      message: result.status === 'Draft' ? 'Evaluation draft saved.' : 'Evaluation recorded and finalized.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function finalizeEvaluation(req, res, next) {
  try {
    const result = await assessmentService.finalizeEvaluation(req.params.resultId, req.user);
    res.json({
      success: true,
      message: 'Evaluation finalized and locked.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function publishEvaluation(req, res, next) {
  try {
    const result = await assessmentService.publishEvaluation(req.params.resultId, req.user);
    res.json({
      success: true,
      message: 'Evaluation published to student.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getMyAssessments(req, res, next) {
  try {
    const data = await assessmentService.getStudentAssessments(req.user._id, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOverviewStats(req, res, next) {
  try {
    const stats = await assessmentService.getOverviewStats(req.user);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

async function submitAssessment(req, res, next) {
  try {
    const submission = await assessmentService.submitAssessment(
      req.params.id,
      req.user,
      req.body,
      req.file
    );
    res.status(201).json({
      success: true,
      message: 'Assessment submitted successfully.',
      data: submission,
    });
  } catch (err) {
    next(err);
  }
}

async function downloadAttachment(req, res, next) {
  try {
    await assessmentService.downloadAttachment(
      req.params.id,
      req.params.filename,
      req.user,
      res,
      req.query.view === 'true'
    );
  } catch (err) {
    next(err);
  }
}

async function downloadSubmissionFile(req, res, next) {
  try {
    await assessmentService.downloadSubmissionFile(
      req.params.submissionId,
      req.user,
      res,
      req.query.view === 'true'
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAssessment,
  updateAssessment,
  getAssessmentById,
  listAssessments,
  getCohortStudents,
  recordEvaluation,
  finalizeEvaluation,
  publishEvaluation,
  getMyAssessments,
  submitAssessment,
  downloadAttachment,
  downloadSubmissionFile,
  getOverviewStats,
};
