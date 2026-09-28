import React, { useEffect, useState } from 'react';
import { enrollmentService } from '../../services/cycleServices';
import { LoadingState, ErrorState, EmptyState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    enrollmentService
      .my()
      .then((res) => setEnrollments(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load enrollments.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading your enrollments…" />;
  if (error) return <ErrorState message={error} />;
  if (enrollments.length === 0) return <EmptyState title="No enrollments yet" message="Enrollments appear after a confirmed payment." />;

  return (
    <div>
      <PageHeader
        title="My Enrollments"
        subtitle="Manage your confirmed course cohort enrollments."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Training', to: '/student/training' },
          { label: 'Enrollments' },
        ]}
      />
      <div className="row g-3">
        {enrollments.map((e) => (
          <div className="col-md-6" key={e._id}>
            <div className="egsa-card p-4 h-100">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h6 className="fw-bold text-dark">{e.course?.title}</h6>
                <StatusBadge status={e.status} />
              </div>
              <ul className="list-unstyled small text-muted mb-0">
                <li><i className="fa-regular fa-calendar me-2"></i>{new Date(e.course?.startDate).toLocaleDateString()}</li>
                <li><i className="fa-solid fa-location-dot me-2"></i>{e.course?.deliveryMode} — {e.course?.location}</li>
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
