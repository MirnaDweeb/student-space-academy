import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/cycleServices';
import { LoadingState, ErrorState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [actionSuccess, setActionSuccess] = useState('');

  // Modals state
  const [selectedAppForAccept, setSelectedAppForAccept] = useState(null);
  const [acceptNote, setAcceptNote] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);

  const [selectedAppForReject, setSelectedAppForReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    adminService
      .applications()
      .then((res) => setApplications(res.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load applications for review.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAccept = async () => {
    if (!selectedAppForAccept) return;
    setIsAccepting(true);
    setError('');
    try {
      await adminService.acceptApplication(selectedAppForAccept._id, acceptNote);
      setActionSuccess(`Application for ${selectedAppForAccept.student?.fullName} accepted. Acceptance email & payment instructions dispatched.`);
      setSelectedAppForAccept(null);
      setAcceptNote('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept application.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAppForReject) return;
    setIsRejecting(true);
    setError('');
    try {
      await adminService.rejectApplication(selectedAppForReject._id, rejectReason);
      setActionSuccess(`Application for ${selectedAppForReject.student?.fullName} rejected. Notification email dispatched.`);
      setSelectedAppForReject(null);
      setRejectReason('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject application.');
    } finally {
      setIsRejecting(false);
    }
  };

  const [promotingId, setPromotingId] = useState(null);

  const handlePromote = async (app) => {
    setPromotingId(app._id);
    setError('');
    setActionSuccess('');
    try {
      await adminService.promoteWaitlist(app._id);
      setActionSuccess(`Application for ${app.student?.fullName || 'student'} promoted from waitlist to Accepted. 72h invoice issued.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to promote application.');
    } finally {
      setPromotingId(null);
    }
  };

  const handleMoveToReview = async (app) => {
    setError('');
    setActionSuccess('');
    try {
      await adminService.reviewApplication(app._id);
      setActionSuccess(`Application for ${app.student?.fullName || 'student'} placed Under Review.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to move application to Under Review.');
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'under_review') {
      return (
        app.status === 'Under Review' ||
        app.status === 'Submitted' ||
        app.status === 'Manual Review'
      );
    }
    if (activeTab === 'waitlisted') {
      return app.status === 'Waitlisted';
    }
    if (activeTab === 'accepted') {
      return app.status === 'Accepted' || app.status === 'Eligible - Payment Pending';
    }
    if (activeTab === 'confirmed') {
      return app.status === 'Confirmed' || app.status === 'In Progress' || app.status === 'Completed';
    }
    if (activeTab === 'rejected') {
      return app.status === 'Rejected' || app.status === 'Cancelled';
    }
    return true;
  });

  const underReviewCount = applications.filter(
    (a) => a.status === 'Under Review' || a.status === 'Submitted' || a.status === 'Manual Review'
  ).length;
  const waitlistCount = applications.filter((a) => a.status === 'Waitlisted').length;
  const acceptedCount = applications.filter(
    (a) => a.status === 'Accepted' || a.status === 'Eligible - Payment Pending'
  ).length;
  const confirmedCount = applications.filter(
    (a) => a.status === 'Confirmed' || a.status === 'Completed'
  ).length;

  if (loading) return <LoadingState label="Loading admissions applications..." />;

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Admissions & Application Review"
        subtitle="Review Space Academy candidate applications, issue institutional acceptances, track tuition payments, and confirm enrollment."
        breadcrumbs={[
          { label: 'Admin Management', to: '/admin/applications' },
          { label: 'Applications' },
        ]}
        actions={
          <button className="btn btn-outline-secondary btn-sm" onClick={load} title="Refresh records">
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh Applications
          </button>
        }
      />

      {/* KPI Stats */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-primary">
            <span className="text-muted small text-uppercase fw-bold">Total Applications</span>
            <h3 className="fw-bold text-dark mt-1 mb-0">{applications.length}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-warning">
            <span className="text-muted small text-uppercase fw-bold">Under Review</span>
            <h3 className="fw-bold text-warning mt-1 mb-0">{underReviewCount}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-info">
            <span className="text-muted small text-uppercase fw-bold">Accepted / Awaiting Pay</span>
            <h3 className="fw-bold text-primary-egsa mt-1 mb-0">{acceptedCount}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-success">
            <span className="text-muted small text-uppercase fw-bold">Confirmed Enrolled</span>
            <h3 className="fw-bold text-success mt-1 mb-0">{confirmedCount}</h3>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
          <i className="fa-solid fa-circle-check me-2"></i> {actionSuccess}
          <button type="button" className="btn-close" onClick={() => setActionSuccess('')}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('all')}
        >
          All ({applications.length})
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'under_review' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('under_review')}
        >
          Under Review ({underReviewCount})
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'waitlisted' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('waitlisted')}
        >
          Waitlisted ({waitlistCount})
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'accepted' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('accepted')}
        >
          Accepted ({acceptedCount})
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'confirmed' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('confirmed')}
        >
          Confirmed Enrolled ({confirmedCount})
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${activeTab === 'rejected' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('rejected')}
        >
          Rejected
        </button>
      </div>

      {/* Applications Table */}
      <div className="egsa-card p-0 overflow-hidden shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-uppercase small text-muted" style={{ letterSpacing: '0.5px' }}>
              <tr>
                <th className="ps-4">Student & Reference</th>
                <th>Course & Level</th>
                <th>Application Status</th>
                <th>Payment Status & Package</th>
                <th>Enrollment</th>
                <th className="text-end pe-4">Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted">
                    <i className="fa-solid fa-inbox fa-2x mb-2 d-block text-secondary-subtle"></i>
                    No applications found in this category.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => {
                  const student = app.student || {};
                  const course = app.course || {};
                  const invoice = app.invoice || null;
                  const enrollment = app.enrollment || null;

                  const isReviewable =
                    app.status === 'Under Review' ||
                    app.status === 'Submitted' ||
                    app.status === 'Manual Review' ||
                    app.status === 'Readiness Required';

                  return (
                    <tr key={app._id}>
                      <td className="ps-4 py-3">
                        <div className="fw-bold text-dark">{student.fullName || 'Candidate'}</div>
                        <div className="text-muted small">{student.email}</div>
                        <span className="badge bg-light text-secondary border small mt-1 font-monospace">
                          {app.referenceNumber || student.registrationNumber || app._id.slice(-6).toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <div className="fw-semibold text-dark">{course.title || 'Space Program'}</div>
                        <div className="text-muted small">
                          {course.level || 'Training'} {app.cohort?.name ? `• ${app.cohort.name}` : ''}
                        </div>
                      </td>

                      <td>
                        <StatusBadge status={app.status} />
                      </td>

                      <td>
                        {invoice ? (
                          <div>
                            <span
                              className={`badge ${
                                invoice.status === 'Paid'
                                  ? 'bg-success-subtle text-success'
                                  : 'bg-warning-subtle text-warning-emphasis'
                              }`}
                            >
                              {invoice.status}
                            </span>
                            <div className="small fw-semibold text-dark mt-1">
                              {invoice.amount?.toLocaleString()} {invoice.currency || 'EGP'}
                            </div>
                            <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                              {invoice.packageType === 'WITH_TRANSPORTATION'
                                ? 'With Transportation'
                                : 'Course Only'}
                            </small>
                          </div>
                        ) : (
                          <span className="text-muted small">Offer Pending Acceptance</span>
                        )}
                      </td>

                      <td>
                        {enrollment ? (
                          <span className="badge bg-success">
                            <i className="fa-solid fa-check me-1"></i> ENROLLED
                          </span>
                        ) : app.status === 'Confirmed' ? (
                          <span className="badge bg-success">Confirmed</span>
                        ) : (
                          <span className="text-muted small">Pending Payment</span>
                        )}
                      </td>

                      <td className="text-end pe-4">
                        <div className="btn-group btn-group-sm">
                          {isReviewable && (
                            <>
                              {app.status === 'Submitted' && (
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => handleMoveToReview(app)}
                                  title="Mark Application Under Review"
                                >
                                  <i className="fa-solid fa-clock-rotate-left me-1"></i> Review
                                </button>
                              )}
                              <button
                                className="btn btn-outline-success"
                                onClick={() => setSelectedAppForAccept(app)}
                                title="Accept Application"
                              >
                                <i className="fa-solid fa-check me-1"></i> Accept
                              </button>
                              <button
                                className="btn btn-outline-danger"
                                onClick={() => setSelectedAppForReject(app)}
                                title="Reject Application"
                              >
                                <i className="fa-solid fa-xmark me-1"></i> Reject
                              </button>
                            </>
                          )}
                          {app.status === 'Waitlisted' && (
                            <button
                              className="btn btn-warning btn-sm text-dark fw-medium"
                              onClick={() => handlePromote(app)}
                              disabled={promotingId === app._id}
                              title="Manually promote waitlisted applicant and issue 72h invoice"
                            >
                              {promotingId === app._id ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                  Promoting...
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-arrow-up-from-bracket me-1"></i>
                                  Promote to Accepted
                                </>
                              )}
                            </button>
                          )}
                          {app.status === 'Accepted' && (
                            <span className="badge bg-light text-primary border p-2">
                              <i className="fa-solid fa-envelope-circle-check me-1"></i> Offer Sent
                            </span>
                          )}
                          {app.status === 'Confirmed' && (
                            <span className="badge bg-light text-success border p-2">
                              <i className="fa-solid fa-user-check me-1"></i> Confirmed
                            </span>
                          )}
                          {app.status === 'Rejected' && (
                            <span className="badge bg-light text-danger border p-2">
                              <i className="fa-solid fa-ban me-1"></i> Rejected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accept Application Modal */}
      {selectedAppForAccept && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-circle-check me-2"></i> Accept Student Application
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedAppForAccept(null)}
                ></button>
              </div>

              <div className="modal-body p-4">
                <p className="text-muted small mb-3">
                  Accepting this application will change the candidate's status to <strong>Accepted</strong>, generate tuition payment options, and automatically dispatch the official EGSA Acceptance Email with the two pricing packages.
                </p>

                <div className="p-3 bg-light rounded border mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted small">Candidate:</span>
                    <strong className="text-dark small">{selectedAppForAccept.student?.fullName}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted small">Program:</span>
                    <strong className="text-dark small">{selectedAppForAccept.course?.title}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted small">Base Course Fee:</span>
                    <strong className="text-primary-egsa small">
                      {(selectedAppForAccept.course?.price || 0).toLocaleString()} EGP
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted small">Transportation Fee:</span>
                    <strong className="text-success small">
                      {(selectedAppForAccept.course?.transportationPrice != null ? selectedAppForAccept.course.transportationPrice : 500).toLocaleString()} EGP
                    </strong>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark">Admissions Board Note (Optional):</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="e.g. Approved by Academic Board for Intake Alpha."
                    value={acceptNote}
                    onChange={(e) => setAcceptNote(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelectedAppForAccept(null)}
                  disabled={isAccepting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-sm px-3"
                  onClick={handleAccept}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Accepting & Dispatching…
                    </>
                  ) : (
                    'Confirm Acceptance'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Application Modal */}
      {selectedAppForReject && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-circle-xmark me-2"></i> Reject Application
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedAppForReject(null)}
                ></button>
              </div>

              <div className="modal-body p-4">
                <p className="text-muted small mb-3">
                  Rejecting this application will mark the status as <strong>Rejected</strong> and automatically dispatch a polite official notification email to the candidate.
                </p>

                <div className="p-3 bg-light rounded border mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted small">Candidate:</span>
                    <strong className="text-dark small">{selectedAppForReject.student?.fullName}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted small">Program:</span>
                    <strong className="text-dark small">{selectedAppForReject.course?.title}</strong>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark">
                    Reason for Rejection (Visible to Student):
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="e.g. Cohort capacity reached or prerequisites not aligned for this intake."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelectedAppForReject(null)}
                  disabled={isRejecting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm px-3"
                  onClick={handleReject}
                  disabled={isRejecting}
                >
                  {isRejecting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Rejecting…
                    </>
                  ) : (
                    'Confirm Rejection'
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
