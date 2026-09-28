import React from 'react';

/**
 * AssessmentDetailModal
 * Institutional transcript modal presenting official evaluation scores,
 * qualitative faculty feedback, demonstrated strengths, and growth recommendations.
 */
export default function AssessmentDetailModal({ isOpen, onClose, assessment }) {
  if (!isOpen || !assessment) return null;

  const isEvaluated = assessment.rawStatus === 'Evaluated' || assessment.status === 'Completed' || assessment.status === 'Failed';
  const isPending = assessment.rawStatus === 'Pending Evaluation' || assessment.status === 'Submitted';
  const isPassed = assessment.resultLabel === 'Passed' || (assessment.score != null && assessment.score >= (assessment.passingScore || 70));

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(5, 12, 28, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div
          className="modal-content border-0 shadow-lg text-dark overflow-hidden"
          style={{ borderRadius: '16px' }}
        >
          {/* Header */}
          <div className="modal-header bg-dark text-white px-4 py-3 d-flex align-items-center justify-content-between border-0">
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-3"
                style={{
                  width: '42px',
                  height: '42px',
                  backgroundColor: 'rgba(58, 105, 133, 0.25)',
                  color: '#52829F',
                  border: '1px solid rgba(82, 130, 159, 0.4)',
                }}
              >
                <i className="fa-solid fa-file-shield fa-lg"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-white mb-0 d-flex align-items-center gap-2">
                  Institutional Assessment Transcript
                  <span className="badge bg-secondary text-uppercase fs-8" style={{ letterSpacing: '0.5px' }}>
                    {assessment.type || 'Evaluation'}
                  </span>
                </h5>
                <p className="text-secondary mb-0 small" style={{ fontSize: '0.78rem' }}>
                  {assessment.courseTitle || 'EGSA Space Academy Curriculum'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px' }}
              onClick={onClose}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Body */}
          <div className="modal-body p-4 bg-light d-flex flex-column gap-3">
            
            {/* Assessment Title & Metadata Strip */}
            <div className="bg-white p-3 rounded-3 border shadow-sm">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <h5 className="fw-bold text-dark mb-1">{assessment.title}</h5>
                  <div className="text-muted small">
                    <i className="fa-solid fa-graduation-cap me-1 text-primary"></i>
                    {assessment.courseTitle}
                    {assessment.cohortName && <span className="ms-2 badge bg-light text-dark border">{assessment.cohortName}</span>}
                  </div>
                </div>

                <div>
                  {isEvaluated ? (
                    <span className={`badge ${isPassed ? 'bg-success' : 'bg-danger'} px-3 py-2 fs-7`}>
                      <i className={`fa-solid ${isPassed ? 'fa-circle-check' : 'fa-circle-xmark'} me-1`}></i>
                      {assessment.resultLabel || (isPassed ? 'Passed' : 'Failed')}
                    </span>
                  ) : isPending ? (
                    <span className="badge bg-warning text-dark px-3 py-2 fs-7">
                      <i className="fa-solid fa-hourglass-half me-1"></i>
                      Pending Faculty Evaluation
                    </span>
                  ) : (
                    <span className="badge bg-secondary px-3 py-2 fs-7">
                      <i className="fa-solid fa-calendar-day me-1"></i>
                      Upcoming Milestone
                    </span>
                  )}
                </div>
              </div>

              {assessment.description && (
                <p className="text-secondary small mb-2">{assessment.description}</p>
              )}

              <div className="d-flex flex-wrap gap-3 pt-2 border-top text-muted small" style={{ fontSize: '0.75rem' }}>
                <span>
                  <i className="fa-solid fa-user-tie me-1 text-primary"></i>
                  Evaluator: <strong>{assessment.instructorName || 'EGSA Faculty Board'}</strong>
                </span>
                {assessment.sessionTitle && (
                  <span>
                    <i className="fa-solid fa-flask me-1 text-secondary"></i>
                    Session: {assessment.sessionTitle}
                  </span>
                )}
                <span>
                  <i className="fa-solid fa-weight-hanging me-1 text-warning"></i>
                  Weight: {assessment.weight}
                </span>
                <span>
                  <i className="fa-solid fa-bullseye me-1 text-danger"></i>
                  Passing Minimum: {assessment.passingScore || 70}%
                </span>
              </div>
            </div>

            {/* EVALUATED STATE: SCORE CARD & QUALITATIVE RUBRIC FEEDBACK */}
            {isEvaluated && (
              <div className="d-flex flex-column gap-3">
                {/* Official Score Display */}
                <div
                  className="p-4 rounded-3 text-white d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3 shadow-sm"
                  style={{ background: isPassed ? 'linear-gradient(135deg, #166067 0%, #1e3a4e 100%)' : 'linear-gradient(135deg, #8b1e1e 0%, #3e1616 100%)' }}
                >
                  <div>
                    <span className="badge bg-light text-dark text-uppercase fw-bold mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                      Official Certified Result
                    </span>
                    <h3 className="fw-bold mb-0">
                      {assessment.score} <span className="fs-5 text-light text-opacity-75">/ {assessment.maxScore}</span>
                    </h3>
                    <div className="text-light text-opacity-75 small">
                      Computed Accuracy: <strong>{assessment.percentage}%</strong>
                    </div>
                  </div>

                  <div className="text-sm-end border-sm-start ps-sm-4 border-light border-opacity-25">
                    <div className="fs-4 fw-bold mb-1 d-flex align-items-center justify-content-sm-end gap-2">
                      <i className={`fa-solid ${isPassed ? 'fa-award text-warning' : 'fa-circle-exclamation'}`}></i>
                      <span>{assessment.resultLabel || (isPassed ? 'Milestone Passed' : 'Below Target')}</span>
                    </div>
                    <span className="small text-light text-opacity-75">
                      Evaluated on: {assessment.submittedAt ? new Date(assessment.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Official Record'}
                    </span>
                  </div>
                </div>

                {/* Qualitative Feedback Breakdown */}
                <div className="bg-white p-3 rounded-3 border d-flex flex-column gap-3">
                  {/* Overall Feedback */}
                  {assessment.feedback && (
                    <div>
                      <h6 className="fw-bold text-dark small text-uppercase mb-1 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px' }}>
                        <i className="fa-solid fa-comment-dots text-primary"></i>
                        Official Faculty Feedback
                      </h6>
                      <div className="p-3 bg-light rounded-3 text-dark small border-start border-4 border-primary" style={{ lineHeight: '1.5' }}>
                        "{assessment.feedback}"
                      </div>
                    </div>
                  )}

                  {/* Strengths */}
                  {assessment.strengths && (
                    <div>
                      <h6 className="fw-bold text-success small text-uppercase mb-1 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px' }}>
                        <i className="fa-solid fa-circle-check"></i>
                        Demonstrated Technical Strengths
                      </h6>
                      <div className="p-2 px-3 bg-success-subtle text-dark rounded-3 small">
                        {assessment.strengths}
                      </div>
                    </div>
                  )}

                  {/* Areas for Growth */}
                  {assessment.improvementAreas && (
                    <div>
                      <h6 className="fw-bold text-warning small text-uppercase mb-1 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px' }}>
                        <i className="fa-solid fa-lightbulb"></i>
                        Recommended Areas for Technical Growth
                      </h6>
                      <div className="p-2 px-3 bg-warning-subtle text-dark rounded-3 small">
                        {assessment.improvementAreas}
                      </div>
                    </div>
                  )}

                  {/* Certificate Impact Note */}
                  <div className="p-2 px-3 bg-light rounded-3 border d-flex align-items-center justify-content-between small">
                    <span className="text-muted">
                      <i className="fa-solid fa-certificate text-primary me-2"></i>
                      Certificate Eligibility Status:
                    </span>
                    <strong className={isPassed ? 'text-success' : 'text-danger'}>
                      {isPassed ? '✓ Requirement Satisfied' : '✕ Re-examination Required'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* PENDING EVALUATION STATE */}
            {isPending && (
              <div className="alert alert-warning p-4 rounded-3 border-0 shadow-sm d-flex flex-column gap-2 mb-0">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left fa-lg text-warning"></i>
                  <h6 className="fw-bold text-dark mb-0">Under Faculty Review</h6>
                </div>
                <p className="small text-secondary mb-0">
                  Your assessment work has been submitted and is currently being evaluated by the assigned EGSA faculty instructor. Official scores, rubrics, and feedback will be published directly to this transcript once finalized.
                </p>
                <div className="text-muted small mt-1" style={{ fontSize: '0.75rem' }}>
                  <i className="fa-solid fa-shield-halved me-1"></i> Provisional or draft scores are withheld until institutional sign-off.
                </div>
              </div>
            )}

            {/* UPCOMING STATE */}
            {!isEvaluated && !isPending && (
              <div className="alert alert-info p-4 rounded-3 border-0 shadow-sm d-flex flex-column gap-2 mb-0">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-calendar-check fa-lg text-primary"></i>
                  <h6 className="fw-bold text-dark mb-0">Upcoming Academic Milestone</h6>
                </div>
                <p className="small text-secondary mb-0">
                  This evaluation milestone is scheduled on the cohort calendar. Review related course lecture slides, laboratory recordings, and technical packages in My Training to prepare.
                </p>
                {assessment.dueDate && (
                  <div className="text-muted small mt-1" style={{ fontSize: '0.75rem' }}>
                    <i className="fa-regular fa-clock me-1"></i> Due Date: <strong>{new Date(assessment.dueDate).toLocaleDateString()}</strong>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="modal-footer bg-light px-4 py-2 border-top d-flex justify-content-between">
            <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
              Academic Affairs &bull; Egyptian Space Agency (EGSA)
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close Transcript
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
