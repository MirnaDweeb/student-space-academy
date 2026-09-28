import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { readinessService } from '../../services/cycleServices';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function ReadinessStartPage() {
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const courseId = params.get('courseId');
    if (!courseId) {
      setError('Missing course parameter in request.');
      return;
    }
    readinessService
      .start(courseId)
      .then((res) => {
        sessionStorage.setItem(`egsa_attempt_${res.data.attemptId}`, JSON.stringify(res.data.questions));
        navigate(`/student/readiness/${res.data.attemptId}`, { replace: true });
      })
      .catch((err) =>
        setError(
          err.response?.data?.message ||
            'Could not initiate readiness assessment. The question bank for this specialized course is being prepared by the faculty.'
        )
      );
  }, [params, navigate]);

  return (
    <div>
      <PageHeader
        title="Initializing Readiness Assessment"
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Assessments', to: '/student/assessments' },
          { label: 'Readiness Assessment' },
        ]}
      />

      {error ? (
        <div className="egsa-card p-5 text-center my-4">
          <i className="fa-solid fa-circle-exclamation fa-3x text-warning mb-3"></i>
          <h5 className="fw-bold text-dark mb-2">Readiness Session Notice</h5>
          <p className="text-muted small mx-auto mb-4" style={{ maxWidth: '480px' }}>
            {error}
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/student/applications" className="btn btn-primary btn-sm">
              <i className="fa-solid fa-file-lines me-1"></i> Return to Applications
            </Link>
            <Link to="/student/programs" className="btn btn-outline-secondary btn-sm">
              Explore Other Courses
            </Link>
          </div>
        </div>
      ) : (
        <LoadingState label="Preparing randomized 10-question readiness bank…" />
      )}
    </div>
  );
}
