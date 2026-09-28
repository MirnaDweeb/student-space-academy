import React, { useState, useEffect } from 'react';
import { portalAssessmentService } from '../../services/studentPortalServices';

export default function InstructorAssessmentModal({ isOpen, onClose, onRefreshData }) {
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [assessmentData, setAssessmentData] = useState(null);
  const [roster, setRoster] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Evaluation Form State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [evalForm, setEvalForm] = useState({
    score: '',
    feedback: '',
    strengths: '',
    improvementAreas: '',
    instructorNote: '',
    reason: '',
  });
  const [evalSubmitting, setEvalSubmitting] = useState(false);

  // Load all assessments
  const loadAssessmentsList = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await portalAssessmentService.listAssessments();
      setAssessments(list || []);
      if (list && list.length > 0) {
        setSelectedAssessmentId(list[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load assessments list.');
    } finally {
      setLoading(false);
    }
  };

  // Load student roster when selected assessment changes
  const loadRoster = async (assessId) => {
    if (!assessId) return;
    setRosterLoading(true);
    setError('');
    try {
      const data = await portalAssessmentService.getCohortStudents(assessId);
      setAssessmentData(data.assessment);
      setRoster(data.roster || []);
      setSummary(data.summary || {});
    } catch (err) {
      setError(err.message || 'Failed to load cohort roster.');
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAssessmentsList();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedAssessmentId) {
      loadRoster(selectedAssessmentId);
    }
  }, [selectedAssessmentId]);

  if (!isOpen) return null;

  const handleOpenEvaluation = (studentItem) => {
    setSelectedStudent(studentItem);
    const existing = studentItem.evaluation;
    if (existing) {
      setEvalForm({
        score: existing.score != null ? existing.score : '',
        feedback: existing.feedback || '',
        strengths: existing.strengths || '',
        improvementAreas: existing.improvementAreas || '',
        instructorNote: existing.instructorNote || '',
        reason: '',
      });
    } else {
      setEvalForm({
        score: '',
        feedback: '',
        strengths: '',
        improvementAreas: '',
        instructorNote: '',
        reason: '',
      });
    }
  };

  const handleSaveEvaluation = async (actionType) => {
    if (!selectedStudent?.student?._id || !selectedAssessmentId) return;

    if (evalForm.score === '' || isNaN(evalForm.score)) {
      setError('Please provide a valid numeric score.');
      return;
    }

    const numScore = Number(evalForm.score);
    const maxScore = assessmentData?.maxScore || 100;
    if (numScore < 0 || numScore > maxScore) {
      setError(`Score must be between 0 and ${maxScore}.`);
      return;
    }

    const isLocked = selectedStudent.evaluation?.status === 'Finalized' || selectedStudent.evaluation?.status === 'Published';
    if (isLocked && !evalForm.reason.trim()) {
      setError('An official explanation/reason is required to modify a finalized evaluation.');
      return;
    }

    setEvalSubmitting(true);
    setError('');

    try {
      // 1. Record score / draft / finalized
      const saveAsDraft = actionType === 'draft';
      const recordRes = await portalAssessmentService.recordEvaluation(
        selectedAssessmentId,
        selectedStudent.student._id,
        {
          score: numScore,
          feedback: evalForm.feedback,
          strengths: evalForm.strengths,
          improvementAreas: evalForm.improvementAreas,
          instructorNote: evalForm.instructorNote,
          saveAsDraft,
          reason: evalForm.reason,
        }
      );

      const resultRecord = recordRes.data;

      // 2. If actionType is publish, call publish endpoint
      if (actionType === 'publish' && resultRecord?._id) {
        await portalAssessmentService.publishEvaluation(resultRecord._id);
        setSuccessMsg(`Evaluation for ${selectedStudent.student.fullName} published to student portal.`);
      } else if (actionType === 'finalize' && resultRecord?._id) {
        await portalAssessmentService.finalizeEvaluation(resultRecord._id);
        setSuccessMsg(`Evaluation for ${selectedStudent.student.fullName} finalized and locked.`);
      } else {
        setSuccessMsg(`Draft evaluation saved for ${selectedStudent.student.fullName}.`);
      }

      setSelectedStudent(null);
      await loadRoster(selectedAssessmentId);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save evaluation.');
    } finally {
      setEvalSubmitting(false);
    }
  };

  const currentScore = Number(evalForm.score);
  const maxScore = assessmentData?.maxScore || 100;
  const computedPercent = !isNaN(currentScore) && currentScore >= 0 ? Math.round((currentScore / maxScore) * 1000) / 10 : null;
  const isPassing = computedPercent != null && assessmentData?.passingScore != null ? currentScore >= assessmentData.passingScore : null;

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(5, 12, 28, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-fullscreen-xl-down modal-xl modal-dialog-centered" style={{ maxWidth: '96vw', height: '94vh' }}>
        <div className="modal-content border-0 shadow-lg text-dark d-flex flex-column h-100" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          
          {/* Header */}
          <div className="modal-header bg-dark text-white px-4 py-3 d-flex align-items-center justify-content-between border-0">
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-3"
                style={{
                  width: '42px',
                  height: '42px',
                  backgroundColor: 'rgba(212, 184, 124, 0.15)',
                  color: '#D4B87C',
                  border: '1px solid rgba(212, 184, 124, 0.3)',
                }}
              >
                <i className="fa-solid fa-chalkboard-user fa-lg"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-white mb-0 d-flex align-items-center gap-2">
                  Faculty Assessment & Evaluation Workspace
                  <span className="badge bg-primary text-uppercase fs-8" style={{ letterSpacing: '0.5px' }}>Faculty Board</span>
                </h5>
                <p className="text-secondary mb-0 small" style={{ fontSize: '0.78rem' }}>
                  Evaluate enrolled cadet coursework, enter verified scores, provide structured growth feedback, and publish academic records.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px' }}
              onClick={onClose}
              disabled={evalSubmitting}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="alert alert-danger mx-4 mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="alert alert-success mx-4 mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-check flex-shrink-0"></i>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Main 2-Column Workspace */}
          <div className="modal-body p-0 d-flex flex-column flex-lg-row flex-grow-1 overflow-hidden">
            
            {/* COLUMN 1: Assessment Selector & Summary */}
            <div
              className="border-end d-flex flex-column bg-light"
              style={{ width: '100%', maxWidth: '360px', minWidth: '300px', height: '100%' }}
            >
              <div className="p-3 border-bottom bg-white">
                <label className="form-label text-muted small fw-bold text-uppercase mb-2" style={{ fontSize: '0.7rem' }}>
                  Select Assessment Milestone
                </label>
                <select
                  className="form-select form-select-sm"
                  value={selectedAssessmentId}
                  onChange={(e) => setSelectedAssessmentId(e.target.value)}
                  disabled={loading}
                >
                  {assessments.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.title} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assessment Spec Card */}
              {assessmentData && (
                <div className="p-3 bg-white border-bottom small">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="badge bg-primary fs-8">{assessmentData.type}</span>
                    <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                      Weight: {assessmentData.weight}%
                    </span>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">{assessmentData.title}</h6>
                  <p className="text-secondary small mb-2">{assessmentData.description}</p>
                  
                  <div className="d-flex justify-content-between text-muted pt-2 border-top" style={{ fontSize: '0.73rem' }}>
                    <span>Max Score: <strong>{assessmentData.maxScore}</strong></span>
                    <span>Passing: <strong>{assessmentData.passingScore || 70}%</strong></span>
                    <span>Status: <strong className="text-primary">{assessmentData.status}</strong></span>
                  </div>
                </div>
              )}

              {/* Roster Metric Counters */}
              <div className="p-3 bg-light d-flex flex-column gap-2 flex-grow-1 overflow-auto">
                <label className="text-muted small fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>
                  Evaluation Progress
                </label>
                <div className="row g-2 text-center">
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <span className="text-muted d-block small" style={{ fontSize: '0.68rem' }}>ENROLLED</span>
                      <strong className="text-dark fs-6">{summary.totalStudents || 0}</strong>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <span className="text-muted d-block small" style={{ fontSize: '0.68rem' }}>EVALUATED</span>
                      <strong className="text-success fs-6">{summary.evaluatedCount || 0}</strong>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <span className="text-muted d-block small" style={{ fontSize: '0.68rem' }}>DRAFTS</span>
                      <strong className="text-warning fs-6">{summary.draftCount || 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-white rounded-3 border">
                  <span className="fw-bold text-dark small d-block mb-1">Academic Integrity Policy</span>
                  <p className="text-muted mb-0" style={{ fontSize: '0.73rem' }}>
                    Evaluations entered in this portal become official institutional training records. Once published, results are locked and revisions require a logged administrative reason.
                  </p>
                </div>
              </div>
            </div>

            {/* COLUMN 2: Student Cohort Roster Table */}
            <div className="flex-grow-1 d-flex flex-column bg-white overflow-hidden">
              <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-light">
                <h6 className="fw-bold text-dark mb-0">
                  Enrolled Cadet Roster &bull; {assessmentData?.cohort?.name || 'Cohort'}
                </h6>
                <span className="badge bg-secondary">
                  {roster.length} Cadet{roster.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex-grow-1 overflow-auto p-3">
                {rosterLoading ? (
                  <div className="text-center py-5 text-muted small">
                    <i className="fa-solid fa-spinner fa-spin fa-2x mb-2 text-primary"></i>
                    <div>Loading cohort student roster...</div>
                  </div>
                ) : roster.length === 0 ? (
                  <div className="text-center py-5 text-muted small">
                    <i className="fa-solid fa-users-slash fa-2x mb-2 opacity-50"></i>
                    <div>No enrolled students found for this assessment cohort.</div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light small text-uppercase" style={{ fontSize: '0.7rem' }}>
                        <tr>
                          <th>Cadet Student</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Outcome</th>
                          <th>Evaluator</th>
                          <th className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody className="small">
                        {roster.map((r) => {
                          const evalObj = r.evaluation;
                          const isEvaluated = r.status === 'Published' || r.status === 'Finalized';
                          const isDraft = r.status === 'Draft';
                          const isPassed = evalObj?.resultLabel === 'Passed';

                          return (
                            <tr key={r.enrollmentId}>
                              <td>
                                <div className="fw-bold text-dark">{r.student?.fullName || 'Cadet'}</div>
                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                  {r.student?.email} {r.student?.nationalId && `· ID: ${r.student.nationalId}`}
                                </div>
                              </td>

                              <td>
                                {isEvaluated ? (
                                  <span className={`badge ${evalObj?.status === 'Published' ? 'bg-success' : 'bg-info text-dark'} px-2 py-1`}>
                                    <i className={`fa-solid ${evalObj?.status === 'Published' ? 'fa-globe' : 'fa-lock'} me-1`}></i>
                                    {evalObj?.status === 'Published' ? 'Published' : 'Finalized'}
                                  </span>
                                ) : isDraft ? (
                                  <span className="badge bg-warning text-dark px-2 py-1">
                                    <i className="fa-solid fa-pencil me-1"></i> Draft Saved
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary px-2 py-1">
                                    <i className="fa-solid fa-hourglass-start me-1"></i> Not Evaluated
                                  </span>
                                )}
                              </td>

                              <td>
                                {evalObj?.score != null ? (
                                  <strong className="text-dark">
                                    {evalObj.score} / {evalObj.maxScore} <span className="text-muted fw-normal">({evalObj.percentage}%)</span>
                                  </strong>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>

                              <td>
                                {evalObj?.resultLabel ? (
                                  <span className={`fw-semibold ${isPassed ? 'text-success' : 'text-danger'}`}>
                                    <i className={`fa-solid ${isPassed ? 'fa-circle-check' : 'fa-circle-xmark'} me-1`}></i>
                                    {evalObj.resultLabel}
                                  </span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>

                              <td className="text-muted" style={{ fontSize: '0.75rem' }}>
                                {evalObj?.instructorName || '—'}
                              </td>

                              <td className="text-end">
                                <button
                                  type="button"
                                  className={`btn btn-sm ${isEvaluated ? 'btn-outline-primary' : isDraft ? 'btn-warning text-dark' : 'btn-primary'} fw-semibold px-3`}
                                  onClick={() => handleOpenEvaluation(r)}
                                >
                                  {isEvaluated ? 'Inspect / Revise' : isDraft ? 'Resume Draft' : 'Evaluate'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer bg-light px-4 py-2 border-top d-flex justify-content-between">
            <span className="text-muted small">
              Official Faculty Examination Portal &bull; Egyptian Space Agency (EGSA)
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close Workspace
            </button>
          </div>

        </div>
      </div>

      {/* POPUP SUB-MODAL FOR EVALUATING A SPECIFIC STUDENT */}
      {selectedStudent && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1070 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-dark text-white">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-graduation-cap text-warning fa-lg"></i>
                  <div>
                    <h6 className="modal-title fw-bold mb-0">
                      Record Academic Evaluation &bull; {selectedStudent.student?.fullName}
                    </h6>
                    <small className="text-secondary">{assessmentData?.title}</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light rounded-circle"
                  onClick={() => setSelectedStudent(null)}
                  disabled={evalSubmitting}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body p-4 bg-light d-flex flex-column gap-3">
                {/* Notice if modifying a finalized record */}
                {(selectedStudent.evaluation?.status === 'Finalized' || selectedStudent.evaluation?.status === 'Published') && (
                  <div className="alert alert-warning py-2 small mb-0 d-flex align-items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-warning fs-5 flex-shrink-0"></i>
                    <div>
                      <strong>Official Record Lock:</strong> This evaluation was finalized on{' '}
                      {new Date(selectedStudent.evaluation.finalizedAt || selectedStudent.evaluation.updatedAt).toLocaleDateString()}.
                      Revisions will be recorded in the institutional audit trail.
                    </div>
                  </div>
                )}

                {/* Score Input Card */}
                <div className="bg-white p-3 rounded-3 border">
                  <div className="row g-3 align-items-center">
                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-bold text-dark mb-1">
                        Evaluation Score (0 - {maxScore}) *
                      </label>
                      <div className="input-group">
                        <input
                          type="number"
                          className="form-control fw-bold"
                          min="0"
                          max={maxScore}
                          placeholder="e.g. 88"
                          value={evalForm.score}
                          onChange={(e) => setEvalForm({ ...evalForm, score: e.target.value })}
                          required
                        />
                        <span className="input-group-text bg-light text-muted">/ {maxScore}</span>
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <div className="p-2 px-3 rounded-3 bg-light border d-flex justify-content-between align-items-center">
                        <div>
                          <span className="text-muted d-block small" style={{ fontSize: '0.7rem' }}>CALCULATED ACCURACY</span>
                          <strong className="fs-5 text-dark">
                            {computedPercent != null ? `${computedPercent}%` : '—'}
                          </strong>
                        </div>

                        <div>
                          <span className="text-muted d-block small" style={{ fontSize: '0.7rem' }}>OUTCOME</span>
                          {isPassing != null ? (
                            <span className={`badge ${isPassing ? 'bg-success' : 'bg-danger'} px-2 py-1`}>
                              {isPassing ? 'Passed' : 'Failed'}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Qualitative Feedback Fields */}
                <div className="bg-white p-3 rounded-3 border d-flex flex-column gap-3">
                  <div>
                    <label className="form-label small fw-bold text-dark mb-1 d-flex align-items-center gap-1">
                      <i className="fa-solid fa-comment-dots text-primary"></i>
                      Official Feedback to Cadet (Student-Visible)
                    </label>
                    <textarea
                      className="form-control small"
                      rows="3"
                      placeholder="Explain performance highlights, engineering methodology, and adherence to aerospace standards..."
                      value={evalForm.feedback}
                      onChange={(e) => setEvalForm({ ...evalForm, feedback: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold text-success mb-1 d-flex align-items-center gap-1">
                        <i className="fa-solid fa-circle-check"></i>
                        Key Demonstrated Strengths
                      </label>
                      <textarea
                        className="form-control small"
                        rows="2"
                        placeholder="e.g. Excellent schematic layout, clean differential routing..."
                        value={evalForm.strengths}
                        onChange={(e) => setEvalForm({ ...evalForm, strengths: e.target.value })}
                      ></textarea>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-bold text-warning mb-1 d-flex align-items-center gap-1">
                        <i className="fa-solid fa-lightbulb"></i>
                        Areas for Technical Growth
                      </label>
                      <textarea
                        className="form-control small"
                        rows="2"
                        placeholder="e.g. Review trace isolation clearances near power stage..."
                        value={evalForm.improvementAreas}
                        onChange={(e) => setEvalForm({ ...evalForm, improvementAreas: e.target.value })}
                      ></textarea>
                    </div>
                  </div>
                </div>

                {/* Confidential Internal Faculty Note */}
                <div className="bg-white p-3 rounded-3 border border-secondary border-opacity-25">
                  <label className="form-label small fw-bold text-dark mb-1 d-flex align-items-center justify-content-between">
                    <span>
                      <i className="fa-solid fa-user-shield text-danger me-1"></i>
                      Internal Faculty Note (Confidential &bull; Not Visible to Cadet)
                    </span>
                    <span className="badge bg-light text-muted border">Private</span>
                  </label>
                  <textarea
                    className="form-control small"
                    rows="2"
                    placeholder="Private remarks for course instructor, laboratory proctors, and Academic Affairs..."
                    value={evalForm.instructorNote}
                    onChange={(e) => setEvalForm({ ...evalForm, instructorNote: e.target.value })}
                  ></textarea>
                </div>

                {/* If modifying locked record: require revision reason */}
                {(selectedStudent.evaluation?.status === 'Finalized' || selectedStudent.evaluation?.status === 'Published') && (
                  <div className="bg-white p-3 rounded-3 border border-warning">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Administrative Correction Reason (Mandatory for Audit Trail) *
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Grade re-evaluated after regrade request on lab test telemetry..."
                      value={evalForm.reason}
                      onChange={(e) => setEvalForm({ ...evalForm, reason: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="modal-footer bg-light d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setSelectedStudent(null)}
                  disabled={evalSubmitting}
                >
                  Cancel
                </button>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark fw-semibold"
                    onClick={() => handleSaveEvaluation('draft')}
                    disabled={evalSubmitting}
                  >
                    Save as Draft
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-primary fw-semibold"
                    onClick={() => handleSaveEvaluation('finalize')}
                    disabled={evalSubmitting}
                  >
                    Finalize Evaluation
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-success fw-bold shadow-sm"
                    onClick={() => handleSaveEvaluation('publish')}
                    disabled={evalSubmitting}
                  >
                    <i className="fa-solid fa-globe me-1"></i> Publish to Cadet
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
