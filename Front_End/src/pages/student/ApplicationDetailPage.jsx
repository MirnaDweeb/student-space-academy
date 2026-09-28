import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { applicationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

const PIPELINE_STEPS = [
  { key: 'Submitted', label: 'Application Submitted' },
  { key: 'Readiness', label: 'Readiness / Eligibility' },
  { key: 'Review', label: 'Review & Seat Allocation' },
  { key: 'Payment', label: 'Payment & Confirmation' },
  { key: 'Enrolled', label: 'Enrolled in Cohort' },
];

function getPipelineStepState(stepKey, currentStatus) {
  const statusOrderMap = {
    Draft: 0,
    Submitted: 1,
    'Readiness Required': 2,
    'Foundation Recommended': 2,
    'Manual Review': 3,
    'Under Review': 3,
    Waitlisted: 3,
    Accepted: 4,
    'Eligible - Payment Pending': 4,
    Confirmed: 5,
    'In Progress': 5,
    Completed: 6,
  };

  const currentLevel = statusOrderMap[currentStatus] ?? 1;

  switch (stepKey) {
    case 'Submitted':
      return currentLevel >= 1 ? 'completed' : 'upcoming';
    case 'Readiness':
      if (currentStatus === 'Readiness Required') return 'current';
      if (currentStatus === 'Foundation Recommended') return 'warning';
      return currentLevel > 2 ? 'completed' : 'upcoming';
    case 'Review':
      if (currentStatus === 'Under Review' || currentStatus === 'Manual Review' || currentStatus === 'Waitlisted') return 'current';
      return currentLevel > 3 ? 'completed' : 'upcoming';
    case 'Payment':
      if (currentStatus === 'Accepted' || currentStatus === 'Eligible - Payment Pending') return 'current';
      return currentLevel > 4 ? 'completed' : 'upcoming';
    case 'Enrolled':
      if (currentStatus === 'Confirmed' || currentStatus === 'In Progress' || currentStatus === 'Completed') return 'completed';
      return 'upcoming';
    default:
      return 'upcoming';
  }
}

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    applicationService
      .get(id)
      .then((res) => setApplication(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load application.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading) return <LoadingState label="Loading application details…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!application) return null;

  const course = application.course || {};
  const cohort = application.cohort || {};
  const readiness = application.readinessAttempt || null;
  const history = application.statusHistory || [];

  return (
    <div>
      <PageHeader
        title={course.title || 'Application Details'}
        subtitle={`Application ID: ${application._id}`}
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Applications', to: '/student/applications' },
          { label: course.title || 'Details' },
        ]}
        actions={
          <Link to="/student/applications" className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-arrow-left me-1"></i> Back to Applications
          </Link>
        }
      />

      <div className="row g-4">
        {/* Main Left Column */}
        <div className="col-lg-8">
          {/* Status Header Banner */}
          <div className="egsa-card mb-4 p-4">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
              <div>
                <small className="text-muted text-uppercase fw-bold">Current Application Status</small>
                <div className="mt-1">
                  <StatusBadge status={application.status} />
                </div>
              </div>
              <div className="text-sm-end text-muted small">
                <div>Applied: {new Date(application.createdAt).toLocaleDateString()}</div>
                <div>Last updated: {new Date(application.updatedAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Contextual guidance message */}
            <div className="p-3 bg-light rounded border">
              {(application.status === 'Accepted' || application.status === 'Eligible - Payment Pending') && (
                <div>
                  <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                    <div>
                      <h6 className="fw-bold text-success mb-1">
                        <i className="fa-solid fa-circle-check text-success me-2"></i>
                        Application Accepted — Complete Payment to Confirm Seat
                      </h6>
                      <p className="text-muted small mb-0">
                        Congratulations! Your application has been approved by the EGSA Academic Committee. Please choose your package and complete payment.
                      </p>
                    </div>
                    <Link to="/student/payments" className="btn btn-primary btn-sm px-3 mt-2 mt-sm-0">
                      <i className="fa-solid fa-credit-card me-1"></i> Choose Package & Pay
                    </Link>
                  </div>

                  {/* Pricing Package Options Preview */}
                  <div className="row g-2 pt-2 border-top">
                    <div className="col-sm-6">
                      <div className="p-2 border rounded bg-white">
                        <div className="small fw-bold text-dark">Option A: Course Only</div>
                        <div className="fs-6 fw-bold text-primary-egsa">
                          {(course.price || 0).toLocaleString()} {course.currency || 'EGP'}
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Self transportation</small>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="p-2 border rounded bg-white">
                        <div className="small fw-bold text-dark">Option B: Course + Transportation</div>
                        <div className="fs-6 fw-bold text-success">
                          {((course.price || 0) + (course.transportationPrice != null ? course.transportationPrice : 500)).toLocaleString()} {course.currency || 'EGP'}
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Includes Agency Shuttle Bus</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(application.status === 'Under Review' || application.status === 'Submitted') && (
                <div>
                  <h6 className="fw-bold text-primary-egsa mb-1">
                    <i className="fa-solid fa-clock-rotate-left me-2"></i>
                    Application Submitted & Under Review
                  </h6>
                  <p className="text-muted small mb-0">
                    Your application is currently under review by the EGSA Academic Committee. Once approved, you will receive an acceptance email with tuition payment instructions.
                  </p>
                </div>
              )}

              {application.status === 'Rejected' && (
                <div>
                  <h6 className="fw-bold text-danger mb-1">
                    <i className="fa-solid fa-circle-xmark me-2"></i>
                    Application Status Update
                  </h6>
                  <p className="text-muted small mb-2">
                    After careful review, we are unable to accept your application for this training intake.
                  </p>
                  {application.rejectionReason && (
                    <div className="alert alert-light border small text-dark py-2 px-3 mb-2">
                      <strong>Reason:</strong> {application.rejectionReason}
                    </div>
                  )}
                  <Link to="/catalog" className="btn btn-outline-secondary btn-sm">
                    <i className="fa-solid fa-compass me-1"></i> Explore Available Courses
                  </Link>
                </div>
              )}

              {application.status === 'Readiness Required' && (
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                  <div>
                    <h6 className="fw-bold text-dark mb-1">
                      <i className="fa-solid fa-pen-to-square text-primary-egsa me-2"></i>
                      Readiness Assessment Required
                    </h6>
                    <p className="text-muted small mb-0">
                      Complete the 10-question prerequisite check to verify readiness for this advanced syllabus.
                    </p>
                  </div>
                  <Link to={`/student/readiness/start?courseId=${course._id}`} className="btn btn-primary btn-sm px-3 mt-2 mt-sm-0">
                    Start Assessment
                  </Link>
                </div>
              )}

              {application.status === 'Foundation Recommended' && (
                <div>
                  <h6 className="fw-bold text-accent-egsa mb-1">
                    <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
                    Foundation Preparation Recommended
                  </h6>
                  <p className="text-muted small mb-2">
                    Prerequisite analysis indicates foundational concepts are required prior to this specialization.
                  </p>
                  <Link to={`/student/courses/${course._id}/fit`} className="btn btn-outline-primary btn-sm">
                    Review Prerequisite Requirements
                  </Link>
                </div>
              )}

              {application.status === 'Manual Review' && (
                <div>
                  <h6 className="fw-bold text-primary-egsa mb-1">
                    <i className="fa-solid fa-user-clock me-2"></i>
                    Academic Board Review in Progress
                  </h6>
                  <p className="text-muted small mb-0">
                    Your academic profile and experience are being evaluated by our space systems faculty. Decisions are normally published within 48 business hours.
                  </p>
                </div>
              )}

              {application.status === 'Confirmed' && (
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                  <div>
                    <h6 className="fw-bold text-secondary-egsa mb-1">
                      <i className="fa-solid fa-award me-2"></i>
                      Admission Confirmed & Enrolled
                    </h6>
                    <p className="text-muted small mb-0">
                      You are officially registered for this cohort. View your schedule, attendance, and training materials in My Training.
                    </p>
                  </div>
                  <Link to="/student/training" className="btn btn-secondary btn-sm px-3 mt-2 mt-sm-0">
                    Go to Training
                  </Link>
                </div>
              )}

              {(application.status === 'Cancelled' || application.status === 'No Show') && (
                <div>
                  <h6 className="fw-bold text-danger-egsa mb-1">
                    <i className="fa-solid fa-ban me-2"></i>
                    Application Cancelled / Expired
                  </h6>
                  <p className="text-muted small mb-0">
                    This reservation has been cancelled. If your payment window lapsed, seats have been returned to the open pool.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Application Pipeline Timeline */}
          <div className="egsa-card mb-4 p-4">
            <h6 className="fw-bold text-dark mb-4">Admissions Pipeline Journey</h6>
            <div className="ps-2">
              {PIPELINE_STEPS.map((step, idx) => {
                const state = getPipelineStepState(step.key, application.status);
                return (
                  <div key={step.key}>
                    <div className="path-node mb-1">
                      <div className={`dot ${state}`}>
                        {state === 'completed' ? (
                          <i className="fa-solid fa-check"></i>
                        ) : state === 'warning' ? (
                          <i className="fa-solid fa-exclamation"></i>
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <div>
                        <div className="fw-semibold text-dark">{step.label}</div>
                        <div className="text-muted small">
                          {state === 'completed'
                            ? 'Step fulfilled'
                            : state === 'current'
                            ? 'Action in progress'
                            : 'Upcoming milestone'}
                        </div>
                      </div>
                    </div>
                    {idx < PIPELINE_STEPS.length - 1 && <div className="path-connector"></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Readiness Assessment Snapshot (if available) */}
          {readiness && (
            <div className="egsa-card mb-4 p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-dark mb-0">
                  <i className="fa-solid fa-square-poll-vertical text-primary-egsa me-2"></i>
                  Readiness Assessment Result
                </h6>
                <span className="badge bg-secondary-egsa fs-6">{readiness.score}% Score</span>
              </div>
              <div className="p-3 bg-light rounded mb-3">
                <div className="row g-2 text-center">
                  <div className="col-4">
                    <small className="text-muted d-block">Outcome</small>
                    <strong className="text-dark small">{readiness.outcome}</strong>
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">Questions</small>
                    <strong className="text-dark small">{readiness.answers?.length || 10} Answered</strong>
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">Completed</small>
                    <strong className="text-dark small">{new Date(readiness.completedAt || readiness.createdAt).toLocaleDateString()}</strong>
                  </div>
                </div>
              </div>
              {readiness.knowledgeGaps?.length > 0 && (
                <div>
                  <small className="fw-bold text-danger-egsa d-block mb-1">Identified Focus Areas:</small>
                  <ul className="small text-muted mb-0">
                    {readiness.knowledgeGaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Status History Audit Trail */}
          {history.length > 0 && (
            <div className="egsa-card p-4">
              <h6 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-clock-rotate-left text-muted me-2"></i>
                Status Change History
              </h6>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0 small">
                  <thead>
                    <tr className="text-muted">
                      <th>Timestamp</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td className="text-muted">{new Date(h.changedAt).toLocaleString()}</td>
                        <td>
                          <StatusBadge status={h.status} showIcon={false} />
                        </td>
                        <td className="text-dark">{h.note || 'Status updated by system.'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Program & Cohort Details */}
        <div className="col-lg-4">
          <div className="egsa-card p-4 mb-4">
            <h6 className="fw-bold text-dark mb-3">Program Summary</h6>
            <div className="mb-2">
              <span className="badge bg-primary-egsa mb-1">{course.category}</span>
              <h5 className="fw-bold text-dark mb-1">{course.title}</h5>
              <p className="text-muted small mb-0">{course.level}</p>
            </div>
            <hr />
            <ul className="list-unstyled small d-flex flex-column gap-2 mb-3">
              <li className="d-flex justify-content-between">
                <span className="text-muted">Tuition:</span>
                <strong className="text-accent-egsa">{course.price != null ? `${course.price} EGP` : 'TBA'}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted">Duration:</span>
                <strong className="text-dark">{course.duration ? `${course.duration} ${course.durationUnit}` : 'TBA'}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted">Delivery Mode:</span>
                <strong className="text-dark">{course.deliveryMode}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted">Location:</span>
                <strong className="text-dark">{course.location || 'EGSA Cairo'}</strong>
              </li>
            </ul>

            <Link to={`/student/courses/${course._id}`} className="btn btn-outline-primary btn-sm w-100">
              <i className="fa-solid fa-circle-info me-1"></i> View Full Course Syllabus
            </Link>
          </div>

          {/* Cohort Card */}
          {cohort && (
            <div className="egsa-card p-4">
              <h6 className="fw-bold text-dark mb-3">Assigned Cohort</h6>
              <div className="p-3 bg-light rounded mb-3">
                <div className="fw-bold text-dark mb-1">{cohort.name || 'Upcoming Cohort'}</div>
                <div className="text-muted small">
                  {cohort.startDate ? `Starts: ${new Date(cohort.startDate).toLocaleDateString()}` : 'Dates announced soon'}
                </div>
              </div>
              <ul className="list-unstyled small d-flex flex-column gap-2 mb-0">
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Capacity:</span>
                  <strong className="text-dark">{cohort.capacity || 30} students</strong>
                </li>
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Seats Reserved:</span>
                  <strong className="text-secondary-egsa">{cohort.seatsTaken || 0} filled</strong>
                </li>
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Cohort Status:</span>
                  <strong className="text-dark">{cohort.status || 'Scheduled'}</strong>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
