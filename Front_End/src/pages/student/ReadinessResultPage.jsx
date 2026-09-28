import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { readinessService, applicationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

const OUTCOME_LABEL = {
  READY: 'READY — DIRECT ADMISSION CLEARANCE',
  CONDITIONALLY_READY: 'CONDITIONALLY READY — RECOMMENDED PREPARATION',
  FOUNDATION_REQUIRED: 'FOUNDATION REQUIRED — PREREQUISITES MANDATORY',
  MANUAL_REVIEW: 'MANUAL REVIEW — COMMITTEE EVALUATION',
};

export default function ReadinessResultPage() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError('');
    readinessService
      .result(attemptId)
      .then((res) => setAttempt(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load readiness result.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [attemptId]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await applicationService.create({
        courseId: attempt.course._id,
        readinessAttemptId: attempt._id,
      });
      navigate(`/student/applications/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create application.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <LoadingState label="Analyzing your readiness assessment outcome…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!attempt) return null;

  const isReady = attempt.outcome === 'READY';
  const isConditionallyReady = attempt.outcome === 'CONDITIONALLY_READY';

  return (
    <div>
      <PageHeader
        title="Readiness Assessment Result"
        subtitle={attempt.course?.title || 'Diagnostic Evaluation Report'}
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Assessments', to: '/student/assessments' },
          { label: 'Readiness Result' },
        ]}
      />

      <div className="row justify-content-center">
        <div className="col-lg-7">
          <div className="egsa-card text-center mb-4 p-5 shadow-sm">
            <div className="text-muted small text-uppercase fw-bold mb-2">Composite Score</div>
            <h1 className="display-3 fw-bold text-primary-egsa mb-2">{attempt.score}%</h1>
            <span
              className={`badge ${
                isReady ? 'bg-success' : isConditionallyReady ? 'bg-primary-egsa' : 'bg-warning text-dark'
              } px-3 py-2 fs-6 fw-semibold mb-3`}
            >
              {OUTCOME_LABEL[attempt.outcome] || attempt.outcome}
            </span>
            <p className="text-muted small mx-auto mb-0" style={{ maxWidth: '440px' }}>
              {isReady
                ? 'Excellent performance! You satisfy the prerequisite readiness threshold for immediate admissions processing.'
                : isConditionallyReady
                ? 'You satisfy the basic threshold with minor recommended focus areas.'
                : 'Foundational coursework is required before enrolling in this advanced syllabus.'}
            </p>
          </div>

          {attempt.knowledgeGaps?.length > 0 && (
            <div className="egsa-card mb-4 border-start border-4 border-warning p-4">
              <h6 className="fw-bold text-dark mb-2">
                <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
                Identified Knowledge Gaps
              </h6>
              <p className="text-muted small mb-2">
                The diagnostic engine flagged the following areas for recommended review:
              </p>
              <ul className="mb-0 small text-muted">
                {attempt.knowledgeGaps.map((g, idx) => (
                  <li key={idx} className="mb-1">{g}</li>
                ))}
              </ul>
            </div>
          )}

          {attempt.recommendedCourse && (
            <div className="egsa-card mb-4 border-start border-4 border-primary p-4">
              <span className="badge bg-primary-egsa mb-2">Recommended Preparatory Course</span>
              <h5 className="fw-bold text-dark mb-1">{attempt.recommendedCourse.title}</h5>
              <p className="text-muted small mb-3">
                This foundation course covers the prerequisite technical topics required before advancing to {attempt.course.title}.
              </p>
              <Link to={`/student/courses/${attempt.recommendedCourse._id}`} className="btn btn-outline-primary btn-sm">
                View Recommended Foundation Course
              </Link>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-4">
            <Link to="/student/programs" className="btn btn-outline-secondary">
              <i className="fa-solid fa-arrow-left me-1"></i> Back to Catalog
            </Link>
            <button className="btn btn-primary px-4" onClick={handleApply} disabled={applying}>
              {applying ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Submitting Application…
                </>
              ) : (
                <>
                  Continue to Application <i className="fa-solid fa-arrow-right ms-1"></i>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
