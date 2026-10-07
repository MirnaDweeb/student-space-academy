import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { courseService } from '../../services/courseService';
import { applicationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

const RESULT_ICON = {
  Eligible: 'fa-circle-check text-secondary-egsa',
  'Conditionally Eligible': 'fa-circle-exclamation text-accent-egsa',
  'Foundation Required': 'fa-triangle-exclamation text-danger-egsa',
  'Manual Review': 'fa-magnifying-glass text-primary-egsa',
  'Not Eligible': 'fa-circle-xmark text-danger-egsa',
};

export default function CourseFitPage() {
  const { id } = useParams();
  const [fit, setFit] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      courseService.checkFit(id),
      courseService.get(id).catch(() => null),
    ])
      .then(([fitRes, courseRes]) => {
        setFit(fitRes.data);
        if (courseRes) setCourse(courseRes.data);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to check course fit.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleDirectEnroll = async () => {
    setApplying(true);
    try {
      const res = await applicationService.create({ courseId: id, directEnroll: true });
      const app = res.data;
      const invId = res.invoice?._id || app?.invoice?._id || app?.invoice;
      if (app && ['Accepted', 'Eligible - Payment Pending'].includes(app.status)) {
        if (invId) {
          navigate(`/student/payments?invoiceId=${invId}&applicationId=${app._id}`);
        } else {
          navigate(`/student/payments?applicationId=${app._id}`);
        }
      } else if (app) {
        navigate(`/student/applications/${app._id}`);
      } else {
        navigate('/student/applications');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process direct enrollment.');
    } finally {
      setApplying(false);
    }
  };

  const handleApplyOrAssess = async () => {
    if (fit.result === 'Foundation Required') {
      setApplying(true);
      try {
        await applicationService.create({ courseId: id });
        navigate('/student/applications');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to submit application.');
      } finally {
        setApplying(false);
      }
      return;
    }

    if (!fit.requiresReadiness) {
      return handleDirectEnroll();
    }

    navigate(`/student/readiness/start?courseId=${id}`);
  };

  if (loading) return <LoadingState label="Checking your prerequisite alignment and course fit…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!fit) return null;

  return (
    <div>
      <PageHeader
        title="Course Fit & Prerequisite Evaluation"
        subtitle={course ? course.title : 'Prerequisite Alignment Check'}
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Explore Programs', to: '/student/programs' },
          { label: course ? course.title : 'Course', to: `/student/courses/${id}` },
          { label: 'Fit Check' },
        ]}
      />

      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="egsa-card text-center mb-4 p-4 p-md-5">
            <i className={`fa-solid ${RESULT_ICON[fit.result] || 'fa-circle-info'} fa-4x mb-3`}></i>
            <h4 className="fw-bold mb-2">Evaluation Outcome</h4>
            <div className="d-flex justify-content-center mb-2">
              <StatusBadge status={fit.result} />
            </div>
            <p className="text-muted small mx-auto mb-0" style={{ maxWidth: '480px' }}>
              {fit.result === 'Eligible'
                ? 'Your academic background satisfies the prerequisite standards for this program.'
                : fit.result === 'Foundation Required'
                ? 'A mandatory foundational prerequisite has not been completed yet.'
                : 'Review the detailed evaluation criteria below.'}
            </p>
          </div>

          <div className="egsa-card p-4 mb-4">
            <h5 className="fw-bold text-dark mb-3">Evaluation Breakdown & Criteria</h5>
            <div className="d-flex flex-column gap-3">
              {fit.reasons.map((r, idx) => (
                <div key={idx} className="p-3 rounded bg-light border d-flex align-items-start gap-3">
                  <i
                    className={`fa-solid ${
                      r.code === 'OK' ? 'fa-check text-secondary-egsa' : 'fa-circle-exclamation text-accent-egsa'
                    } mt-1 fs-5`}
                  ></i>
                  <div className="flex-grow-1">
                    <div className="fw-semibold text-dark mb-1">{r.message}</div>
                    {r.recommendedNextStep && (
                      <div className="text-muted small">
                        <strong>Recommended Next Step:</strong> {r.recommendedNextStep}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <Link to="/student/programs" className="btn btn-outline-secondary btn-sm">
              <i className="fa-solid fa-arrow-left me-1"></i> Browse Other Courses
            </Link>

            {fit.result !== 'Not Eligible' && (
              <div className="d-flex align-items-center gap-2">
                {fit.result === 'Foundation Required' ? (
                  <button
                    className="btn btn-warning px-4"
                    onClick={handleApplyOrAssess}
                    disabled={applying}
                  >
                    {applying ? 'Submitting…' : 'Apply to Recommended Foundation'}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-primary px-3 fw-bold"
                      onClick={handleDirectEnroll}
                      disabled={applying}
                    >
                      {applying ? 'Reserving…' : (
                        <>
                          <i className="fa-solid fa-credit-card me-1"></i> Enroll & Pay Now
                        </>
                      )}
                    </button>
                    {fit.requiresReadiness && (
                      <button
                        className="btn btn-outline-primary px-3 fw-semibold"
                        onClick={handleApplyOrAssess}
                        disabled={applying}
                      >
                        Check Readiness First <i className="fa-solid fa-arrow-right ms-1"></i>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
