import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/cycleServices';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminAttendancePage() {
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' | 'disputes'
  const [sessions, setSessions] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // QR Modal
  const [activeQRData, setActiveQRData] = useState(null);
  const [generatingQR, setGeneratingQR] = useState(false);

  // Review Dispute Modal
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [reviewApproved, setReviewApproved] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sessionsRes, disputesRes, cohortsRes] = await Promise.all([
        adminService.sessions({ cohortId: selectedCohortId || undefined }),
        adminService.disputes().catch(() => ({ data: [] })),
        adminService.cohorts().catch(() => ({ data: [] })),
      ]);
      setSessions(sessionsRes.data || []);
      setDisputes(disputesRes.data || disputesRes || []);
      setCohorts(cohortsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCohortId]);

  const handleGenerateQR = async (session) => {
    setGeneratingQR(true);
    setError('');
    try {
      const res = await adminService.generateQR(session._id);
      setActiveQRData({
        session,
        qrCode: res.data?.qrCode || res.qrCode,
        window: res.data?.attendanceWindow || res.attendanceWindow,
      });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate session QR code.');
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleReviewDispute = async (e) => {
    e.preventDefault();
    if (!selectedDispute) return;
    setSubmittingReview(true);
    setError('');
    setSuccessMsg('');
    try {
      await adminService.reviewDispute(selectedDispute._id, {
        approved: reviewApproved,
        reviewNotes,
      });
      setSuccessMsg(`Dispute from ${selectedDispute.student?.fullName || 'student'} has been ${reviewApproved ? 'Approved' : 'Rejected'}.`);
      setSelectedDispute(null);
      setReviewNotes('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to review dispute.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <LoadingState label="Loading training sessions and attendance telemetry..." />;

  const pendingDisputesCount = disputes.filter((d) => d.status === 'Pending').length;

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Training Sessions & Attendance Management"
        subtitle="Manage scheduled training sessions, generate live QR check-in tokens, and audit student attendance excuses."
        breadcrumbs={[
          { label: 'Admin Command', to: '/admin/dashboard' },
          { label: 'Sessions & Attendance' },
        ]}
        actions={
          <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
          </button>
        }
      />

      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <i className="fa-solid fa-circle-check me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Tabs */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 pb-2 border-bottom">
        <ul className="nav nav-pills">
          <li className="nav-item">
            <button
              className={`nav-link small py-2 px-3 ${activeTab === 'sessions' ? 'active bg-primary-egsa' : 'text-dark'}`}
              onClick={() => setActiveTab('sessions')}
            >
              <i className="fa-solid fa-calendar-day me-2"></i>
              Training Sessions ({sessions.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link small py-2 px-3 ${activeTab === 'disputes' ? 'active bg-primary-egsa' : 'text-dark'}`}
              onClick={() => setActiveTab('disputes')}
            >
              <i className="fa-solid fa-file-circle-question me-2"></i>
              Attendance Disputes ({pendingDisputesCount} pending)
            </button>
          </li>
        </ul>

        {activeTab === 'sessions' && (
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted text-nowrap">Filter Cohort:</span>
            <select
              className="form-select form-select-sm"
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              style={{ minWidth: 200 }}
            >
              <option value="">All Cohorts</option>
              {cohorts.map((coh) => (
                <option key={coh._id} value={coh._id}>
                  {coh.name} ({coh.course?.title})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Sessions List */}
      {activeTab === 'sessions' && (
        <div>
          {sessions.length === 0 ? (
            <EmptyState
              icon="fa-calendar-xmark"
              title="No Sessions Scheduled"
              message="No training sessions match the selected cohort filter."
            />
          ) : (
            <div className="table-responsive egsa-card p-3 shadow-sm">
              <table className="table table-hover align-middle mb-0 small">
                <thead>
                  <tr className="text-muted">
                    <th>#</th>
                    <th>Session Title</th>
                    <th>Course & Cohort</th>
                    <th>Date & Time</th>
                    <th>Location</th>
                    <th>QR Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sess) => {
                    const hasActiveQR = sess.qrCode?.token && new Date(sess.qrCode.expiresAt) > new Date();

                    return (
                      <tr key={sess._id}>
                        <td>
                          <span className="badge bg-light text-dark border">
                            #{sess.sessionNumber}
                          </span>
                        </td>
                        <td>
                          <div className="fw-bold text-dark">{sess.title}</div>
                          {sess.focus && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{sess.focus}</div>}
                        </td>
                        <td>
                          <div className="text-dark fw-medium">{sess.course?.title}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{sess.cohort?.name}</div>
                        </td>
                        <td>
                          <div>{new Date(sess.date).toLocaleDateString()}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {sess.startTime} – {sess.endTime}
                          </div>
                        </td>
                        <td>
                          <i className="fa-solid fa-location-dot text-muted me-1"></i>
                          {sess.location || 'EGSA Cairo'}
                        </td>
                        <td>
                          {hasActiveQR ? (
                            <span className="badge bg-success">
                              <i className="fa-solid fa-qrcode me-1"></i> Active Token
                            </span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => handleGenerateQR(sess)}
                            disabled={generatingQR}
                          >
                            <i className="fa-solid fa-qrcode me-1"></i>
                            {hasActiveQR ? 'View / Refresh QR' : 'Generate QR'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Attendance Disputes */}
      {activeTab === 'disputes' && (
        <div>
          {disputes.length === 0 ? (
            <EmptyState
              icon="fa-check-circle"
              title="No Attendance Disputes"
              message="There are currently no attendance excuse or dispute requests submitted by students."
            />
          ) : (
            <div className="table-responsive egsa-card p-3 shadow-sm">
              <table className="table table-hover align-middle mb-0 small">
                <thead>
                  <tr className="text-muted">
                    <th>Student</th>
                    <th>Type</th>
                    <th>Session Date</th>
                    <th>Reason / Explanation</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((disp) => (
                    <tr key={disp._id}>
                      <td>
                        <div className="fw-bold text-dark">{disp.student?.fullName || 'Student'}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{disp.student?.email}</div>
                      </td>
                      <td>
                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                          {disp.type || 'Dispute'}
                        </span>
                      </td>
                      <td>
                        {disp.session?.date ? new Date(disp.session.date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div className="text-truncate" title={disp.reason}>{disp.reason}</div>
                      </td>
                      <td>{new Date(disp.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span
                          className={`badge ${
                            disp.status === 'Approved'
                              ? 'bg-success'
                              : disp.status === 'Rejected'
                              ? 'bg-danger'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {disp.status}
                        </span>
                      </td>
                      <td className="text-end">
                        {disp.status === 'Pending' ? (
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => {
                              setSelectedDispute(disp);
                              setReviewApproved(true);
                              setReviewNotes('');
                            }}
                          >
                            <i className="fa-solid fa-gavel me-1"></i> Review
                          </button>
                        ) : (
                          <span className="text-muted small">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QR Code Broadcast Display Modal */}
      {activeQRData && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 440 }}>
            <div className="modal-content border-0 shadow text-center p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="modal-title fw-bold text-primary-egsa mb-0">
                  <i className="fa-solid fa-qrcode me-2"></i> Session Attendance QR
                </h5>
                <button type="button" className="btn-close" onClick={() => setActiveQRData(null)}></button>
              </div>

              <div className="mb-2">
                <span className="badge bg-secondary-egsa text-dark small text-uppercase">
                  Session #{activeQRData.session?.sessionNumber}: {activeQRData.session?.title}
                </span>
              </div>

              {/* Token Display Box */}
              <div className="p-4 bg-light rounded border my-3">
                <i className="fa-solid fa-qrcode fa-5x text-dark mb-3"></i>
                <div className="small text-muted mb-1 text-uppercase fw-bold">Live Check-in Token</div>
                <div className="fs-4 fw-monospace fw-bold text-primary-egsa tracking-wider border rounded p-2 bg-white select-all">
                  {activeQRData.qrCode?.token || 'TOKEN-ACTIVE'}
                </div>
                <small className="text-muted mt-2 d-block">
                  Students enter this token or scan this code in their Attendance Portal.
                </small>
              </div>

              <div className="alert alert-info small text-start mb-3">
                <i className="fa-solid fa-clock me-1"></i>
                <strong>Window Policy:</strong> Valid for on-time check-in within 15 minutes of start. Check-ins after 15m are recorded as Late (0.75 credit).
              </div>

              <button className="btn btn-primary btn-sm w-100" onClick={() => setActiveQRData(null)}>
                Close Token Broadcast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Dispute Modal */}
      {selectedDispute && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-gavel text-primary me-2"></i> Review Attendance Dispute
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedDispute(null)}></button>
              </div>
              <form onSubmit={handleReviewDispute}>
                <div className="modal-body py-3">
                  <div className="mb-3">
                    <label className="form-label small text-muted">Student</label>
                    <div className="fw-bold">{selectedDispute.student?.fullName} ({selectedDispute.student?.email})</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small text-muted">Dispute Reason</label>
                    <div className="p-3 bg-light rounded border small">{selectedDispute.reason}</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Decision *</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="disputeDecision"
                          id="decApprove"
                          checked={reviewApproved === true}
                          onChange={() => setReviewApproved(true)}
                        />
                        <label className="form-check-label text-success fw-bold" htmlFor="decApprove">
                          <i className="fa-solid fa-check me-1"></i> Approve Request
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="disputeDecision"
                          id="decReject"
                          checked={reviewApproved === false}
                          onChange={() => setReviewApproved(false)}
                        />
                        <label className="form-check-label text-danger fw-bold" htmlFor="decReject">
                          <i className="fa-solid fa-xmark me-1"></i> Reject Request
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Review Notes / Administrative Feedback</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="3"
                      placeholder="Add institutional justification (will be communicated to student)..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedDispute(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn btn-sm ${reviewApproved ? 'btn-success' : 'btn-danger'}`}
                    disabled={submittingReview}
                  >
                    {submittingReview ? 'Submitting...' : reviewApproved ? 'Approve & Adjust Attendance' : 'Reject Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
