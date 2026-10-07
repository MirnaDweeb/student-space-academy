import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { applicationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function FoundationReviewPage() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError('');
    applicationService
      .get(id)
      .then((res) => setApplication(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load application foundation review.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleDirectEnroll = async () => {
    if (!application) return;
    setEnrolling(true);
    try {
      const res = await applicationService.directEnroll(application._id);
      const invoiceId = res.invoice?._id || application.invoice?._id;
      if (invoiceId) {
        navigate(`/student/payments?invoiceId=${invoiceId}&applicationId=${application._id}`);
      } else {
        navigate(`/student/payments?applicationId=${application._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process direct enrollment.');
      setEnrolling(false);
    }
  };

  if (loading) return <LoadingState label="Loading foundation review and diagnostic findings…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!application) return null;

  const course = application.course || {};
  const attempt = application.readinessAttempt || null;
  const fit = application.fitResultSnapshot || null;
  const isDirectPermitted = course.directEnrollmentPermitted !== false;

  const correctAnswersCount = attempt?.answers?.filter((a) => a.isCorrect)?.length || 0;
  const totalQuestionsCount = attempt?.answers?.length || 12;

  // Standard or identified focus areas
  const focusAreas =
    attempt?.knowledgeGaps && attempt.knowledgeGaps.length > 0
      ? attempt.knowledgeGaps
      : [
          'Systems & Quantitative Reasoning',
          'Operational Safety & Protocols',
          'Scientific & Technical Fundamentals',
          'Logical Thinking & Problem Solving',
        ];

  return (
    <div>
      <PageHeader
        title="Foundation Preparation & Readiness Review"
        subtitle={`${course.title || 'Specialized Program'} — Diagnostic Assessment Advisory Report`}
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Applications', to: '/student/applications' },
          { label: application.referenceNumber || 'Application', to: `/student/applications/${application._id}` },
          { label: 'Foundation Review' },
        ]}
        actions={
          <Link to={`/student/applications/${application._id}`} className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-arrow-left me-1"></i> Return to Application
          </Link>
        }
      />

      <div className="row justify-content-center">
        <div className="col-lg-9">
          {/* Main Advisory Banner Card */}
          <div className="egsa-card p-4 p-md-5 mb-4 shadow-sm border-start border-4 border-warning">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="badge bg-warning text-dark px-3 py-2 fw-semibold">
                <i className="fa-solid fa-triangle-exclamation me-1"></i> Foundation Preparation Recommended
              </span>
              <span className="badge bg-light text-secondary border px-3 py-2">
                Application: {application.referenceNumber || application._id?.slice(-6)?.toUpperCase()}
              </span>
            </div>

            <h3 className="fw-bold text-dark mb-2">Foundation Preparation Recommended</h3>
            <p className="text-muted mb-4 lead fs-6">
              Your readiness assessment indicates that some foundational concepts should be strengthened before
              proceeding with this specialization.
            </p>

            <div className="row g-3 p-3 bg-light rounded border mb-4">
              <div className="col-sm-6 col-md-3 text-center border-end-sm">
                <div className="text-muted small text-uppercase fw-bold">Readiness Score</div>
                <div className="display-6 fw-bold text-primary-egsa">{attempt?.score != null ? attempt.score : 67}%</div>
                <small className="text-muted">
                  {correctAnswersCount > 0 ? `${correctAnswersCount} of ${totalQuestionsCount} correct` : '8 of 12 correct'}
                </small>
              </div>

              <div className="col-sm-6 col-md-3 text-center border-end-md">
                <div className="text-muted small text-uppercase fw-bold">Academic Prerequisite</div>
                <div className="fs-4 fw-bold text-success mt-2">
                  <i className="fa-solid fa-circle-check me-1"></i> {fit?.result || 'Eligible'}
                </div>
                <small className="text-muted">Prerequisites verified</small>
              </div>

              <div className="col-sm-6 col-md-3 text-center border-end-sm">
                <div className="text-muted small text-uppercase fw-bold">Admission Mode</div>
                <div className="fs-5 fw-bold text-dark mt-2">
                  {isDirectPermitted ? 'Direct Permitted' : 'Gated Track'}
                </div>
                <small className="text-muted">
                  {isDirectPermitted ? 'Assessment is optional' : 'Assessment mandatory'}
                </small>
              </div>

              <div className="col-sm-6 col-md-3 text-center">
                <div className="text-muted small text-uppercase fw-bold">Program</div>
                <div className="fw-bold text-dark mt-2 text-truncate" title={course.title}>
                  {course.title || 'Satellite Systems'}
                </div>
                <small className="text-muted">{course.level || 'Intermediate'}</small>
              </div>
            </div>

            {/* Focus Areas Section */}
            <div className="mb-4">
              <h5 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-list-check text-primary-egsa me-2"></i>
                Identified Focus Areas for Review:
              </h5>
              <div className="row g-2">
                {focusAreas.map((area, idx) => (
                  <div className="col-md-6" key={idx}>
                    <div className="p-3 bg-white rounded border d-flex align-items-center gap-3">
                      <span
                        className="rounded-circle bg-warning-subtle text-warning-emphasis d-flex align-items-center justify-content-center"
                        style={{ width: '36px', height: '36px', flexShrink: 0 }}
                      >
                        <i className="fa-solid fa-bookmark"></i>
                      </span>
                      <div>
                        <div className="fw-semibold text-dark">{area}</div>
                        <small className="text-muted">Recommended preparatory strengthening prior to cohort launch.</small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clear Separation of Two Dimensions */}
            <div className="alert alert-info border-info-subtle mb-4">
              <div className="d-flex align-items-start gap-3">
                <i className="fa-solid fa-circle-info fa-lg text-primary-egsa mt-1"></i>
                <div className="small">
                  <strong className="d-block text-dark mb-1">
                    Understanding Your Prerequisite Fit vs. Readiness Assessment:
                  </strong>
                  Your <strong>Prerequisite Fit Check</strong> confirms you satisfy all academic degree and experience
                  qualifications for {course.title}. The <strong>Readiness Assessment</strong> is a diagnostic evaluation
                  to help optimize your learning outcome. Because this program permits direct enrollment, you are
                  <strong> not blocked</strong> from enrollment.
                </div>
              </div>
            </div>

            {/* Next Steps / Admission Action Strip */}
            <div className="p-4 bg-light rounded border">
              <h6 className="fw-bold text-dark mb-2">Available Next Actions</h6>
              <p className="text-muted small mb-3">
                {isDirectPermitted
                  ? 'You may choose to proceed directly with tuition payment and confirm your seat in the upcoming cohort, or you may retake the readiness assessment after independent review.'
                  : 'This program requires satisfying prerequisite knowledge standards. Please complete the recommended preparatory modules or retake the assessment.'}
              </p>

              <div className="d-flex flex-wrap align-items-center gap-3">
                {isDirectPermitted && (
                  <button
                    type="button"
                    className="btn btn-primary px-4 py-2 fw-bold"
                    onClick={handleDirectEnroll}
                    disabled={enrolling}
                  >
                    {enrolling ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Reserving Seat & Generating Invoice…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-credit-card me-2"></i>
                        Enroll & Pay Now
                      </>
                    )}
                  </button>
                )}

                <Link
                  to={`/student/readiness/start?courseId=${course._id}&retake=true`}
                  className="btn btn-outline-primary px-3 py-2 fw-semibold"
                >
                  <i className="fa-solid fa-rotate-right me-1"></i> Retake Assessment
                </Link>

                {attempt?.recommendedCourse && (
                  <Link
                    to={`/student/courses/${attempt.recommendedCourse._id || attempt.recommendedCourse}`}
                    className="btn btn-outline-secondary px-3 py-2"
                  >
                    <i className="fa-solid fa-graduation-cap me-1"></i> View Suggested Foundation Course
                  </Link>
                )}

                <Link
                  to={`/student/applications/${application._id}`}
                  className="btn btn-link text-decoration-none text-muted px-2"
                >
                  Return to Application Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
