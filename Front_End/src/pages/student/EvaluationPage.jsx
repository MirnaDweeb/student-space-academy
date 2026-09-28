import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { evaluationService } from '../../services/studentPortalServices';
import { LoadingState, ErrorState, EmptyState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

export default function EvaluationPage() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active evaluation modal state
  const [activeEval, setActiveEval] = useState(null); // course item
  const [isReviewing, setIsReviewing] = useState(false); // viewing past submission

  // Form ratings (1-5)
  const [ratings, setRatings] = useState({
    content: 5,
    instructor: 5,
    labs: 5,
    organization: 5,
  });

  const [comments, setComments] = useState({
    highlights: '',
    improvements: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    evaluationService
      .getEvaluations()
      .then((data) => setEvaluations(data || []))
      .catch((err) => setError(err.message || 'Failed to load evaluations.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openEvaluationForm = (item) => {
    setActiveEval(item);
    setIsReviewing(false);
    setRatings({ content: 5, instructor: 5, labs: 5, organization: 5 });
    setComments({ highlights: '', improvements: '' });
    setSuccessMsg('');
  };

  const openReviewModal = (item) => {
    setActiveEval(item);
    setIsReviewing(true);
    if (item.submission) {
      setRatings(item.submission.ratings || { content: 5, instructor: 5, labs: 5, organization: 5 });
      setComments(item.submission.comments || { highlights: '', improvements: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeEval) return;

    setSubmitting(true);
    try {
      await evaluationService.submitEvaluation({
        courseId: activeEval.courseId,
        ratings,
        comments,
      });
      setSuccessMsg('Your official course and instructor evaluation has been recorded. Thank you for helping EGSA improve training quality!');
      load();
      setTimeout(() => {
        setActiveEval(null);
      }, 1800);
    } catch (err) {
      setError(err.message || 'Failed to submit evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading training evaluations…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Course & Instructor Evaluation"
        subtitle="Provide anonymous, constructive feedback on technical curriculum, instructor effectiveness, and lab simulation facilities."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Evaluation' },
        ]}
      />

      <div className="alert alert-info border-0 mb-4 bg-light text-primary-egsa">
        <i className="fa-solid fa-shield-halved me-2"></i>
        <strong>Official Academic Requirement:</strong> Submitting an evaluation for your enrolled cohort is a prerequisite for certificate issuance and graduation clearance by the Egyptian Space Agency.
      </div>

      {evaluations.length === 0 ? (
        <EmptyState
          icon="fa-star-half-stroke"
          title="No evaluations required at this time"
          message="Course evaluations open during your enrolled training cohort. Check back once your classes begin."
          actionLabel="Explore Programs"
          actionLink="/student/programs"
        />
      ) : (
        <div className="row g-3">
          {evaluations.map((item) => (
            <div className="col-12" key={item.enrollmentId}>
              <div className="egsa-card p-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-primary-egsa">Course Evaluation</span>
                      <StatusBadge status={item.isCompleted ? 'Completed' : 'Pending'} />
                    </div>

                    <h5 className="fw-bold text-dark mb-1">{item.courseTitle}</h5>
                    <div className="text-muted small">
                      Instructor: <strong className="text-dark">{item.instructor}</strong> · Evaluated anonymously
                    </div>

                    {item.isCompleted && item.submission && (
                      <div className="text-muted small mt-2">
                        <i className="fa-solid fa-check-circle text-success me-1"></i>
                        Submitted on {new Date(item.submission.submittedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="d-flex gap-2">
                    {item.isCompleted ? (
                      <button
                        className="btn btn-outline-secondary btn-sm px-3"
                        onClick={() => openReviewModal(item)}
                      >
                        <i className="fa-solid fa-eye me-1"></i> View Submitted Feedback
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm px-3"
                        onClick={() => openEvaluationForm(item)}
                      >
                        <i className="fa-solid fa-pen-to-square me-1"></i> Complete Evaluation
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evaluation Modal (Form / Read-only Review) */}
      {activeEval && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-light">
                <div>
                  <h5 className="modal-title fw-bold text-dark mb-0">
                    {isReviewing ? 'Submitted Evaluation Feedback' : 'Student Feedback Survey'}
                  </h5>
                  <small className="text-muted">{activeEval.courseTitle} · {activeEval.instructor}</small>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setActiveEval(null)}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body p-4">
                {successMsg && <div className="alert alert-success">{successMsg}</div>}

                <form onSubmit={handleSubmit}>
                  {/* Rating 1: Curriculum */}
                  <div className="mb-4">
                    <label className="fw-semibold text-dark small d-block mb-1">
                      1. Course Curriculum, Content Relevance & Syllabus Depth
                    </label>
                    <div className="d-flex gap-2 align-items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          disabled={isReviewing}
                          className="btn btn-link p-1 text-decoration-none"
                          onClick={() => setRatings((r) => ({ ...r, content: star }))}
                        >
                          <i
                            className={`fa-star ${star <= ratings.content ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}
                          ></i>
                        </button>
                      ))}
                      <span className="small text-muted ms-2">
                        {ratings.content}/5 — {ratings.content >= 4 ? 'Excellent' : ratings.content >= 3 ? 'Good' : 'Needs Improvement'}
                      </span>
                    </div>
                  </div>

                  {/* Rating 2: Instructor */}
                  <div className="mb-4">
                    <label className="fw-semibold text-dark small d-block mb-1">
                      2. Instructor Technical Expertise, Mentorship & Clarity
                    </label>
                    <div className="d-flex gap-2 align-items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          disabled={isReviewing}
                          className="btn btn-link p-1 text-decoration-none"
                          onClick={() => setRatings((r) => ({ ...r, instructor: star }))}
                        >
                          <i
                            className={`fa-star ${star <= ratings.instructor ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}
                          ></i>
                        </button>
                      ))}
                      <span className="small text-muted ms-2">
                        {ratings.instructor}/5
                      </span>
                    </div>
                  </div>

                  {/* Rating 3: Labs */}
                  <div className="mb-4">
                    <label className="fw-semibold text-dark small d-block mb-1">
                      3. Engineering Labs, Telemetry Tools & Practical Simulations
                    </label>
                    <div className="d-flex gap-2 align-items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          disabled={isReviewing}
                          className="btn btn-link p-1 text-decoration-none"
                          onClick={() => setRatings((r) => ({ ...r, labs: star }))}
                        >
                          <i
                            className={`fa-star ${star <= ratings.labs ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}
                          ></i>
                        </button>
                      ))}
                      <span className="small text-muted ms-2">{ratings.labs}/5</span>
                    </div>
                  </div>

                  {/* Rating 4: Organization */}
                  <div className="mb-4">
                    <label className="fw-semibold text-dark small d-block mb-1">
                      4. Academy Facilities, Organization & Support
                    </label>
                    <div className="d-flex gap-2 align-items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          disabled={isReviewing}
                          className="btn btn-link p-1 text-decoration-none"
                          onClick={() => setRatings((r) => ({ ...r, organization: star }))}
                        >
                          <i
                            className={`fa-star ${star <= ratings.organization ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}
                          ></i>
                        </button>
                      ))}
                      <span className="small text-muted ms-2">{ratings.organization}/5</span>
                    </div>
                  </div>

                  {/* Open Comments */}
                  <div className="mb-3">
                    <label className="fw-semibold text-dark small mb-1">
                      What was the strongest aspect of this training program?
                    </label>
                    {isReviewing ? (
                      <p className="p-2 bg-light rounded text-muted small mb-0">
                        {comments.highlights || 'No highlights entered.'}
                      </p>
                    ) : (
                      <textarea
                        className="form-control"
                        rows="3"
                        placeholder="e.g., The hands-on ADCS telemetry simulation and mission design workshop..."
                        value={comments.highlights}
                        onChange={(e) => setComments((c) => ({ ...c, highlights: e.target.value }))}
                      />
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="fw-semibold text-dark small mb-1">
                      What recommendations or suggestions do you have for future cohorts?
                    </label>
                    {isReviewing ? (
                      <p className="p-2 bg-light rounded text-muted small mb-0">
                        {comments.improvements || 'No recommendations entered.'}
                      </p>
                    ) : (
                      <textarea
                        className="form-control"
                        rows="3"
                        placeholder="e.g., Include more time for payload thermal modeling..."
                        value={comments.improvements}
                        onChange={(e) => setComments((c) => ({ ...c, improvements: e.target.value }))}
                      />
                    )}
                  </div>

                  {!isReviewing && (
                    <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setActiveEval(null)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm px-4" disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Submit Evaluation'}
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {isReviewing && (
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveEval(null)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
