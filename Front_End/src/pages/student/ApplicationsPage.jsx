import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, EmptyState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const load = () => {
    setLoading(true);
    setError('');
    applicationService
      .my()
      .then((res) => setApplications(res.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load applications.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Filter applications by tab
  const filteredApplications = applications.filter((app) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'action_required') {
      return (
        app.status === 'Accepted' ||
        app.status === 'Eligible - Payment Pending' ||
        app.status === 'Readiness Required' ||
        app.status === 'Needs Information' ||
        app.status === 'Foundation Recommended'
      );
    }
    if (activeTab === 'under_review') {
      return (
        app.status === 'Submitted' ||
        app.status === 'Under Review' ||
        app.status === 'Manual Review' ||
        app.status === 'Waitlisted'
      );
    }
    if (activeTab === 'confirmed') {
      return (
        app.status === 'Confirmed' ||
        app.status === 'In Progress' ||
        app.status === 'Completed'
      );
    }
    if (activeTab === 'cancelled') {
      return (
        app.status === 'Cancelled' ||
        app.status === 'No Show' ||
        app.status === 'Incomplete'
      );
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="My Applications"
        subtitle="Track your application status, review requirements, and take next actions across the Academy admissions pipeline."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Applications' },
        ]}
        actions={
          <Link to="/student/programs" className="btn btn-primary btn-sm px-3">
            <i className="fa-solid fa-plus me-1"></i> Apply for a Course
          </Link>
        }
      />

      {/* Filter Tabs */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('all')}
        >
          All Applications ({applications.length})
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'action_required' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('action_required')}
        >
          Action Required
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'under_review' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('under_review')}
        >
          Under Review
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'confirmed' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('confirmed')}
        >
          Confirmed & Enrolled
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'cancelled' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('cancelled')}
        >
          Cancelled / Expired
        </button>
      </div>

      {loading && <LoadingState label="Loading your applications…" />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && applications.length === 0 && (
        <EmptyState
          icon="fa-file-circle-plus"
          title="No applications submitted yet"
          message="Explore the EGSA course catalog, check your fit, and apply for training programs to get started."
          actionLabel="Explore Programs"
          actionLink="/student/programs"
        />
      )}

      {!loading && !error && applications.length > 0 && filteredApplications.length === 0 && (
        <EmptyState
          icon="fa-filter"
          title="No applications in this category"
          message="Select another tab to view your applications."
          actionLabel="Show All Applications"
          onAction={() => setActiveTab('all')}
        />
      )}

      {!loading && !error && filteredApplications.length > 0 && (
        <div className="row g-3">
          {filteredApplications.map((app) => (
            <div className="col-12" key={app._id}>
              <div className="egsa-card p-3 p-md-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                  <div className="flex-grow-1">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      <h5 className="mb-0 fw-bold text-dark">{app.course?.title}</h5>
                      <StatusBadge status={app.status} />
                    </div>

                    <div className="text-muted small d-flex flex-wrap gap-3 mt-2">
                      <span>
                        <i className="fa-regular fa-calendar me-1"></i>
                        Applied: {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : new Date(app.createdAt).toLocaleDateString()}
                      </span>
                      {app.cohort && (
                        <span>
                          <i className="fa-solid fa-users me-1"></i>
                          Cohort: {app.cohort.name || 'Upcoming'}
                        </span>
                      )}
                      {app.course?.level && (
                        <span>
                          <i className="fa-solid fa-layer-group me-1"></i>
                          {app.course.level}
                        </span>
                      )}
                      {app.course?.price != null && (
                        <span className="fw-semibold text-dark">
                          <i className="fa-solid fa-tag me-1 text-accent-egsa"></i>
                          {app.course.price} EGP
                        </span>
                      )}
                    </div>

                    {/* Contextual Action Reminder based on real status */}
                    <div className="mt-2 text-muted small">
                      {app.status === 'Accepted' && (
                        <span className="text-success fw-medium">
                          <i className="fa-solid fa-circle-check text-success me-1"></i>
                          Application Accepted! Complete payment to confirm your enrollment and receive schedule.
                        </span>
                      )}
                      {app.status === 'Eligible - Payment Pending' && (
                        <span className="text-warning-emphasis fw-medium">
                          <i className="fa-solid fa-triangle-exclamation text-warning me-1"></i>
                          Payment pending to confirm your seat reservation. Seat held until 72h before training start.
                        </span>
                      )}
                      {(app.status === 'Under Review' || app.status === 'Submitted') && (
                        <span className="text-primary-egsa fw-medium">
                          <i className="fa-solid fa-clock-rotate-left me-1"></i>
                          Your application has been received and is currently under review by the EGSA Academic Committee.
                        </span>
                      )}
                      {app.status === 'Rejected' && (
                        <span className="text-danger fw-medium">
                          <i className="fa-solid fa-circle-xmark text-danger me-1"></i>
                          Application not accepted for this intake. {app.rejectionReason ? `(${app.rejectionReason})` : ''}
                        </span>
                      )}
                      {app.status === 'Readiness Required' && (
                        <span className="text-primary-egsa fw-medium">
                          <i className="fa-solid fa-pen-to-square me-1"></i>
                          Initial readiness assessment required to evaluate program alignment.
                        </span>
                      )}
                      {app.status === 'Foundation Recommended' && (
                        <span className="text-accent-egsa fw-medium">
                          <i className="fa-solid fa-lightbulb me-1"></i>
                          Foundation path recommended to bridge prerequisite knowledge gaps.
                        </span>
                      )}
                      {app.status === 'Manual Review' && (
                        <span className="text-muted">
                          <i className="fa-solid fa-user-clock me-1"></i>
                          Your application is undergoing evaluation by the EGSA Admissions Committee.
                        </span>
                      )}
                      {app.status === 'Waitlisted' && (
                        <span className="text-muted">
                          <i className="fa-solid fa-clock-rotate-left me-1"></i>
                          Cohort is currently full. You will be automatically notified if a seat becomes available.
                        </span>
                      )}
                      {app.status === 'Confirmed' && (
                        <span className="text-secondary-egsa fw-medium">
                          <i className="fa-solid fa-circle-check me-1"></i>
                          Admission confirmed! You are enrolled in this training program.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="d-flex flex-wrap align-items-center gap-2 w-100 w-md-auto justify-content-md-end">
                    {(app.status === 'Accepted' || app.status === 'Eligible - Payment Pending') && (
                      <Link
                        to={`/student/payments?invoiceId=${app.invoice?._id || (typeof app.invoice === 'string' ? app.invoice : '')}&applicationId=${app._id}`}
                        className="btn btn-primary btn-sm"
                      >
                        {app.invoice?.status === 'Payment Initiated' ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin me-1"></i> Continue Payment
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-credit-card me-1"></i> Pay Now
                          </>
                        )}
                      </Link>
                    )}
                    {app.status === 'Readiness Required' && (
                      <Link to={`/student/readiness/start?courseId=${app.course?._id}`} className="btn btn-primary btn-sm">
                        <i className="fa-solid fa-pen-to-square me-1"></i> Take Readiness
                      </Link>
                    )}
                    {app.status === 'Foundation Recommended' && (
                      <Link to={`/student/applications/${app._id}/foundation`} className="btn btn-warning text-dark btn-sm fw-semibold">
                        <i className="fa-solid fa-graduation-cap me-1"></i> Review Foundation Request
                      </Link>
                    )}
                    {app.status === 'Confirmed' && (
                      <Link to="/student/training" className="btn btn-secondary btn-sm">
                        <i className="fa-solid fa-graduation-cap me-1"></i> Go to Training
                      </Link>
                    )}
                    <Link to={`/student/applications/${app._id}`} className="btn btn-outline-primary btn-sm">
                      View Application Details <i className="fa-solid fa-chevron-right ms-1 small"></i>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
