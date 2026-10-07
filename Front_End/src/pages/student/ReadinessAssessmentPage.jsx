import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { readinessService } from '../../services/cycleServices';
import { ErrorState, ProgressBar, LoadingState } from '../../components/StateComponents.jsx';

export default function ReadinessAssessmentPage() {
  const { attemptId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [course, setCourse] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      setError('');

      // 1. Check sessionStorage first for fast rendering
      const stored = sessionStorage.getItem(`egsa_attempt_${attemptId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuestions(parsed);
          }
        } catch (_) {}
      }

      // 2. Query server for attempt details, questions, course metadata & saved answers
      try {
        const res = await readinessService.getAttempt(attemptId);
        if (!isMounted) return;

        if (res.data?.status === 'Submitted') {
          navigate(`/student/readiness/${attemptId}/result`);
          return;
        }

        if (res.data?.course) {
          setCourse(res.data.course);
        }

        if (Array.isArray(res.data?.questions) && res.data.questions.length > 0) {
          setQuestions(res.data.questions);
          sessionStorage.setItem(`egsa_attempt_${attemptId}`, JSON.stringify(res.data.questions));
        }

        if (Array.isArray(res.data?.answers) && res.data.answers.length > 0) {
          const restored = {};
          res.data.answers.forEach((ans) => {
            const qId = ans.question?._id || ans.question;
            if (qId && typeof ans.selectedIndex === 'number' && ans.selectedIndex >= 0) {
              restored[qId] = ans.selectedIndex;
            }
          });
          setAnswers((prev) => ({ ...restored, ...prev }));
        }
      } catch (err) {
        if (!isMounted) return;
        // If server getAttempt fails but we had questions in sessionStorage, keep going
        if (!stored) {
          setError(
            err.response?.data?.message ||
              'Assessment session expired or not found. Please restart from the course page.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [attemptId, navigate]);

  if (error) {
    return (
      <div className="row justify-content-center my-5">
        <div className="col-lg-7">
          <div className="egsa-card p-5 text-center shadow-sm">
            <i className="fa-solid fa-triangle-exclamation fa-3x text-warning mb-3"></i>
            <h5 className="fw-bold text-dark mb-2">Readiness Session Notice</h5>
            <p className="text-muted small mx-auto mb-4" style={{ maxWidth: '460px' }}>
              {error}
            </p>
            <div className="d-flex justify-content-center gap-2">
              <Link to="/student/readiness/start" className="btn btn-primary btn-sm">
                <i className="fa-solid fa-rotate-right me-1"></i> Restart Assessment
              </Link>
              <Link to="/student/programs" className="btn btn-outline-secondary btn-sm">
                Explore Programs
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || questions.length === 0) {
    return <LoadingState label="Loading readiness question bank…" />;
  }

  const q = questions[current];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const selectAnswer = (optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [q.id]: optionIndex,
    }));
  };

  const handlePrev = () => {
    if (current > 0) {
      setCurrent((c) => c - 1);
    }
  };

  const handleNext = () => {
    if (current < totalQuestions - 1) {
      setCurrent((c) => c + 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const payload = questions.map((item) => ({
        questionId: item.id,
        selectedIndex: answers[item.id] !== undefined ? answers[item.id] : -1,
      }));

      const res = await readinessService.submit(attemptId, payload);
      sessionStorage.removeItem(`egsa_attempt_${attemptId}`);
      navigate(`/student/readiness/${res.data.attemptId}/result`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit readiness assessment. Please check your network and try again.');
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="row justify-content-center my-4">
      <div className="col-lg-8">
        {/* Program Header */}
        <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-primary-egsa px-2 py-1">
                {course?.category || 'Space Academy Program'}
              </span>
              <span className="badge bg-light text-dark border px-2 py-1">
                {course?.level || 'Academic Readiness'}
              </span>
            </div>
            <h4 className="fw-bold text-dark mb-0">
              {course?.title ? `${course.title} — Readiness Assessment` : 'Readiness Assessment'}
            </h4>
          </div>
          <Link to="/student/programs" className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-arrow-left me-1"></i> Return to Programs
          </Link>
        </div>

        {/* Header Stats */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div>
            <span className="badge bg-primary-egsa me-2">Question {current + 1} of {totalQuestions}</span>
            <span className="badge bg-light text-dark border">{q.topic}</span>
          </div>
          <div className="text-muted small fw-semibold">
            {answeredCount}/{totalQuestions} Answered ({progressPercent}%)
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar percent={progressPercent} />

        {/* Question Selector Jump Pills */}
        <div className="d-flex flex-wrap gap-1 my-3 py-2 px-1 bg-light rounded border">
          {questions.map((item, idx) => {
            const isAnswered = answers[item.id] !== undefined;
            const isCurrent = idx === current;
            return (
              <button
                key={item.id}
                type="button"
                className={`btn btn-sm rounded-circle p-0 ${
                  isCurrent
                    ? 'btn-accent fw-bold'
                    : isAnswered
                    ? 'btn-primary'
                    : 'btn-outline-secondary'
                }`}
                style={{ width: '32px', height: '32px', fontSize: '13px' }}
                onClick={() => setCurrent(idx)}
                title={`Jump to Question ${idx + 1}: ${item.topic}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Question Card */}
        <div className="egsa-card p-4 p-md-5 mt-2 shadow-sm">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <span className="text-muted small text-uppercase fw-bold tracking-wide">
              Technical Domain: {q.topic}
            </span>
            <span className="badge bg-light text-secondary border small">
              {q.difficulty || 'Fundamentals'}
            </span>
          </div>

          <h5 className="fw-bold text-dark mb-4 lh-base">
            {current + 1}. {q.question}
          </h5>

          {/* Accessible Options */}
          <div className="d-flex flex-column gap-3 mb-4" role="radiogroup" aria-labelledby="question-text">
            {q.options.map((opt, idx) => {
              const isSelected = answers[q.id] === idx;
              return (
                <label
                  key={idx}
                  className={`d-flex align-items-center gap-3 p-3 rounded border text-start cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary-subtle text-dark fw-semibold shadow-sm'
                      : 'border-secondary-subtle bg-white text-dark hover-bg-light'
                  }`}
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onClick={() => selectAnswer(idx)}
                >
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={idx}
                    checked={isSelected}
                    onChange={() => selectAnswer(idx)}
                    className="form-check-input mt-0 fs-5"
                    aria-label={opt}
                  />
                  <div className="flex-grow-1">
                    <span className="me-2 text-muted fw-normal">{String.fromCharCode(65 + idx)}.</span>
                    <span>{opt}</span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="d-flex justify-content-between align-items-center pt-3 border-top">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm px-3"
              onClick={handlePrev}
              disabled={current === 0 || submitting}
            >
              <i className="fa-solid fa-arrow-left me-1"></i> Previous
            </button>

            <div className="d-flex gap-2">
              {current < totalQuestions - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4"
                  onClick={handleNext}
                >
                  Next <i className="fa-solid fa-arrow-right ms-1"></i>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-accent btn-sm px-4 fw-bold"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={submitting}
                >
                  Review & Submit <i className="fa-solid fa-check ms-1"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Review / Submit Strip */}
        <div className="d-flex justify-content-between align-items-center mt-3 px-2 text-muted small">
          <span>
            <i className="fa-solid fa-circle-info text-primary-egsa me-1"></i>
            All questions must be answered for optimal assessment accuracy.
          </span>
          {answeredCount === totalQuestions && (
            <button
              type="button"
              className="btn btn-link p-0 text-accent text-decoration-none fw-semibold"
              onClick={() => setShowConfirmModal(true)}
            >
              Ready to submit? Click here.
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-light">
                <h6 className="modal-title fw-bold text-dark">
                  <i className="fa-solid fa-shield-check text-primary-egsa me-2"></i>
                  Confirm Assessment Submission
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="text-center mb-3">
                  <div className="display-6 fw-bold text-primary-egsa">
                    {answeredCount} / {totalQuestions}
                  </div>
                  <div className="text-muted small">Questions Completed (Ungraded)</div>
                </div>

                {answeredCount < totalQuestions ? (
                  <div className="alert alert-warning small mb-3">
                    <i className="fa-solid fa-triangle-exclamation me-1"></i>
                    You have <strong>{totalQuestions - answeredCount} unanswered questions</strong>.
                    Unanswered questions will be scored as incorrect.
                  </div>
                ) : (
                  <p className="text-muted small mb-3 text-center">
                    You have answered all {totalQuestions} questions. Once submitted, your responses will be evaluated
                    and graded by the admissions scoring engine.
                  </p>
                )}

                <div className="p-3 bg-light rounded small text-muted">
                  <strong>Important:</strong> Your readiness score determines admission clearance (80%+ Ready,
                  50-79% Foundation Recommended, &lt;50% Manual Review).
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                >
                  Return to Questions
                </button>
                <button
                  type="button"
                  className="btn btn-accent btn-sm px-4 fw-bold"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Grading & Saving…
                    </>
                  ) : (
                    'Confirm & Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
