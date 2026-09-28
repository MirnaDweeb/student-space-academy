import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { attendanceService } from '../../services/studentPortalServices';
import { LoadingState, ErrorState, EmptyState, StatusBadge, PageHeader, ProgressBar } from '../../components/StateComponents.jsx';
import QRCheckInModal from '../../components/training/QRCheckInModal';
import DisputeModal from '../../components/training/DisputeModal';

export default function AttendancePage() {
  const [data, setData] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCourseIdx, setSelectedCourseIdx] = useState(0);

  // Modals state
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedSessionForQR, setSelectedSessionForQR] = useState(null);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, disputesRes, policyRes] = await Promise.all([
        attendanceService.getStudentAttendance(),
        attendanceService.getMyDisputes().catch(() => []),
        attendanceService.getPolicy().catch(() => null),
      ]);
      setData(summaryRes);
      setDisputes(disputesRes || []);
      setPolicy(policyRes);
    } catch (err) {
      setError(err.message || 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQRSuccess = (checkInData) => {
    // Reload full summary to ensure real-time consistency
    loadData();
  };

  if (loading) return <LoadingState label="Synchronizing attendance records with Mission Control…" />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  if (!data || !data.courses || data.courses.length === 0) {
    return (
      <div>
        <PageHeader
          title="Attendance Records"
          subtitle="Track session participation, attendance thresholds, and lab check-ins."
          breadcrumbs={[
            { label: 'Portal', to: '/student/dashboard' },
            { label: 'Attendance' },
          ]}
        />
        <EmptyState
          icon="fa-calendar-xmark"
          title="No attendance records available"
          message="Attendance tracking is activated once you are enrolled in an active training cohort."
          actionLabel="Explore Available Programs"
          actionLink="/student/programs"
        />
      </div>
    );
  }

  const activeCourse = data.courses[selectedCourseIdx] || data.courses[0];
  const warningState = activeCourse.warningState || data.warningState || 'NORMAL';
  const certEligibility = activeCourse.certificateEligibility || data.certificateEligibility || 'ON_TRACK';
  const recovery = activeCourse.recovery || data.recovery || {};
  const attendanceRate = activeCourse.percentage ?? data.overallPercentage ?? 100;
  const minimumAttendance = policy?.minimumAttendancePercentage || activeCourse.policy?.minimumAttendancePercentage || 85;

  // Find active or upcoming session with open window
  const activeSessionWithOpenWindow = activeCourse.sessions?.find((s) => s.isAttendanceWindowOpen);
  const nextScheduledSession = activeCourse.sessions?.find((s) => s.status === 'Upcoming');

  return (
    <div>
      <PageHeader
        title="Attendance Records"
        subtitle="Review session participation across all scheduled lectures, engineering labs, and simulation drills."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Attendance' },
        ]}
      />

      {/* GRADUATED ATTENDANCE POLICY WARNING BANNER */}
      {warningState === 'NORMAL' && (
        <div className="egsa-card mb-4 border-start border-4 border-success bg-success-subtle p-3 p-md-4">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <span className="badge bg-success p-2 rounded-circle">
                <i className="fa-solid fa-circle-check fs-5 text-white"></i>
              </span>
              <div>
                <h6 className="fw-bold text-dark mb-1">Attendance is on track</h6>
                <p className="text-muted small mb-0">
                  Your attendance complies with the EGSA Space Academy requirement (Minimum {minimumAttendance}% required).
                </p>
              </div>
            </div>
            <div className="text-sm-end">
              <span className="badge bg-success px-3 py-2 fw-semibold fs-6">
                {attendanceRate}% Attendance Rate
              </span>
              <small className="d-block text-success fw-semibold mt-1">Status: On Track</small>
            </div>
          </div>
        </div>
      )}

      {warningState === 'ATTENTION' && (
        <div className="egsa-card mb-4 border-start border-4 border-warning bg-warning-subtle p-3 p-md-4">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <span className="badge bg-warning text-dark p-2 rounded-circle">
                <i className="fa-solid fa-triangle-exclamation fs-5"></i>
              </span>
              <div>
                <h6 className="fw-bold text-dark mb-1">Attention: Approaching Permitted Absence Limit</h6>
                <p className="text-muted small mb-0">
                  Your attendance is approaching the maximum allowed absence threshold. Continued absences will trigger official academic warnings.
                </p>
              </div>
            </div>
            <div className="text-sm-end">
              <span className="badge bg-warning text-dark px-3 py-2 fw-semibold fs-6">
                {attendanceRate}% Attendance Rate
              </span>
              <small className="d-block text-warning-emphasis fw-semibold mt-1">Status: Attention</small>
            </div>
          </div>
        </div>
      )}

      {warningState === 'WARNING' && (
        <div className="egsa-card mb-4 border-start border-4 border-warning-subtle bg-light p-3 p-md-4 shadow-sm" style={{ borderLeftColor: '#f59e0b !important' }}>
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <span className="badge bg-warning text-dark p-2 rounded-circle">
                <i className="fa-solid fa-bell fs-5"></i>
              </span>
              <div>
                <h6 className="fw-bold text-dark mb-1 text-danger">Official Attendance Warning Issued</h6>
                <p className="text-muted small mb-0">
                  Your current absence rate has exceeded the warning threshold. Continued absence may affect your training and certificate eligibility.
                </p>
                {recovery.canRecover && (
                  <small className="text-primary-egsa fw-semibold d-block mt-1">
                    <i className="fa-solid fa-arrow-trend-up me-1"></i>
                    Recovery Path: Attending all remaining sessions can restore your attendance up to {recovery.maxPossibleFinalRate}%.
                  </small>
                )}
              </div>
            </div>
            <div className="text-sm-end">
              <span className="badge bg-danger px-3 py-2 fw-semibold fs-6">
                {attendanceRate}% Attendance Rate
              </span>
              <small className="d-block text-danger fw-semibold mt-1">Certificate: At Risk</small>
            </div>
          </div>
        </div>
      )}

      {warningState === 'FINAL_WARNING' && (
        <div className="egsa-card mb-4 border-start border-4 border-danger bg-danger-subtle p-3 p-md-4">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <span className="badge bg-danger text-white p-2 rounded-circle">
                <i className="fa-solid fa-triangle-exclamation fs-5"></i>
              </span>
              <div>
                <h6 className="fw-bold text-danger mb-1">Final Attendance Warning</h6>
                <p className="text-muted small mb-0">
                  Your attendance has reached a critical level. Further absence will make you ineligible for the course certificate and require administrative board review.
                </p>
                {recovery.canRecover ? (
                  <small className="text-primary-egsa fw-semibold d-block mt-1">
                    <i className="fa-solid fa-circle-exclamation me-1"></i>
                    Must attend 100% of remaining sessions to achieve {recovery.maxPossibleFinalRate}% final rate.
                  </small>
                ) : (
                  <small className="text-danger fw-semibold d-block mt-1">
                    Immediate academic review required.
                  </small>
                )}
              </div>
            </div>
            <div className="text-sm-end">
              <span className="badge bg-danger px-3 py-2 fw-semibold fs-6">
                {attendanceRate}% Attendance Rate
              </span>
              <small className="d-block text-danger fw-semibold mt-1">Status: Final Warning</small>
            </div>
          </div>
        </div>
      )}

      {warningState === 'CERTIFICATE_INELIGIBLE' && (
        <div className="egsa-card mb-4 border-start border-4 border-danger bg-light p-3 p-md-4 shadow">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <span className="badge bg-danger text-white p-2 rounded-circle">
                <i className="fa-solid fa-circle-xmark fs-5"></i>
              </span>
              <div>
                <h6 className="fw-bold text-danger mb-1">Certificate Eligibility Affected</h6>
                <p className="text-muted small mb-0">
                  Your absence rate has exceeded the permitted attendance limit for this course. You are currently not eligible to receive the course certificate based on attendance.
                </p>
                <small className="text-muted d-block mt-1">
                  If you have legitimate extenuating circumstances, submit an official Attendance Dispute / Medical Excuse below for Academic Board review.
                </small>
              </div>
            </div>
            <div className="text-sm-end">
              <span className="badge bg-dark text-white px-3 py-2 fw-semibold fs-6">
                {attendanceRate}% Attendance Rate
              </span>
              <span className="badge bg-danger d-block mt-1">Ineligible for Certificate</span>
            </div>
          </div>
        </div>
      )}

      {/* Course Switcher (if student has multiple enrollments) */}
      {data.courses.length > 1 && (
        <div className="mb-4">
          <label className="form-label small text-muted fw-semibold">Select Training Enrollment:</label>
          <div className="d-flex flex-wrap gap-2">
            {data.courses.map((c, idx) => (
              <button
                key={c.enrollmentId}
                className={`btn btn-sm rounded-pill px-3 ${selectedCourseIdx === idx ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setSelectedCourseIdx(idx)}
              >
                {c.courseTitle}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ACTIVE / UPCOMING SESSION ACTION CARD */}
      <div className="egsa-card p-4 mb-4 bg-gradient-light border-primary-subtle shadow-sm">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-primary-egsa">
                <i className="fa-solid fa-satellite-dish me-1"></i> Session Check-in Station
              </span>
              {activeSessionWithOpenWindow ? (
                <span className="badge bg-success text-white">
                  <i className="fa-solid fa-circle-dot me-1"></i> Attendance Window Open
                </span>
              ) : (
                <span className="badge bg-light text-muted border">
                  Next Scheduled: {nextScheduledSession ? `Session #${nextScheduledSession.sessionNumber}` : 'All Sessions Concluded'}
                </span>
              )}
            </div>
            <h5 className="fw-bold text-dark mb-1">
              {activeSessionWithOpenWindow
                ? `Session #${activeSessionWithOpenWindow.sessionNumber}: ${activeSessionWithOpenWindow.title}`
                : nextScheduledSession
                ? `Session #${nextScheduledSession.sessionNumber}: ${nextScheduledSession.title}`
                : activeCourse.courseTitle}
            </h5>
            <p className="text-muted small mb-0">
              {activeSessionWithOpenWindow ? (
                <span>
                  Attendance window is currently open until{' '}
                  <strong>{new Date(activeSessionWithOpenWindow.attendanceWindow?.closesAt || Date.now()).toLocaleTimeString()}</strong>.
                </span>
              ) : nextScheduledSession?.attendanceWindow?.opensAt ? (
                <span>
                  Attendance window opens at{' '}
                  <strong>{new Date(nextScheduledSession.attendanceWindow.opensAt).toLocaleTimeString()}</strong> on {new Date(nextScheduledSession.date).toLocaleDateString()}.
                </span>
              ) : (
                <span>Scan the session QR code displayed by your proctor or instructor during class.</span>
              )}
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              className="btn btn-primary px-3 fw-semibold text-nowrap"
              onClick={() => {
                setSelectedSessionForQR(activeSessionWithOpenWindow || nextScheduledSession || activeCourse.sessions?.[0]);
                setIsQRModalOpen(true);
              }}
            >
              <i className="fa-solid fa-qrcode me-2"></i> Mark Attendance
            </button>
            <button
              className="btn btn-outline-secondary px-3 text-nowrap"
              onClick={() => setIsDisputeModalOpen(true)}
            >
              <i className="fa-solid fa-circle-question me-1"></i> Report Issue / Excuse
            </button>
          </div>
        </div>
      </div>

      {/* METRIC OVERVIEW CARDS (Calculated from Backend) */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-2">
          <div className="egsa-card p-3 text-center">
            <span className="text-muted small d-block mb-1">Attendance Rate</span>
            <h3 className={`fw-bold mb-0 ${attendanceRate >= minimumAttendance ? 'text-primary-egsa' : 'text-danger'}`}>
              {attendanceRate}%
            </h3>
            <small className="text-muted">Target: ≥{minimumAttendance}%</small>
          </div>
        </div>

        <div className="col-6 col-md-2">
          <div className="egsa-card p-3 text-center">
            <span className="text-muted small d-block mb-1">Present</span>
            <h4 className="fw-bold text-success mb-0">
              <i className="fa-solid fa-check small me-1"></i>
              {activeCourse.presentSessions ?? activeCourse.presentCount ?? 0}
            </h4>
            <small className="text-muted">Full credit</small>
          </div>
        </div>

        <div className="col-6 col-md-2">
          <div className="egsa-card p-3 text-center">
            <span className="text-muted small d-block mb-1">Late Arrivals</span>
            <h4 className="fw-bold text-warning mb-0">
              <i className="fa-solid fa-clock small me-1"></i>
              {activeCourse.lateSessions ?? activeCourse.lateCount ?? 0}
            </h4>
            <small className="text-muted">0.75x weight</small>
          </div>
        </div>

        <div className="col-6 col-md-2">
          <div className="egsa-card p-3 text-center">
            <span className="text-muted small d-block mb-1">Excused</span>
            <h4 className="fw-bold text-info mb-0">
              <i className="fa-solid fa-notes-medical small me-1"></i>
              {activeCourse.excusedSessions ?? activeCourse.excusedCount ?? 0}
            </h4>
            <small className="text-muted">Approved</small>
          </div>
        </div>

        <div className="col-6 col-md-2">
          <div className="egsa-card p-3 text-center">
            <span className="text-muted small d-block mb-1">Absences</span>
            <h4 className="fw-bold text-danger mb-0">
              <i className="fa-solid fa-xmark small me-1"></i>
              {activeCourse.absentSessions ?? activeCourse.absentCount ?? 0}
            </h4>
            <small className="text-muted">Unexcused</small>
          </div>
        </div>

        <div className="col-6 col-md-2">
          <div className="egsa-card p-3 text-center">
            <span className="text-muted small d-block mb-1">Total Sessions</span>
            <h4 className="fw-bold text-dark mb-0">{activeCourse.totalSessions || 0}</h4>
            <small className="text-muted">
              {activeCourse.completedSessions || 0} concluded
            </small>
          </div>
        </div>
      </div>

      {/* SESSION LOG TABLE & RESPONSIVE CARDS */}
      <div className="egsa-card p-4 mb-4">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
          <div>
            <h5 className="fw-bold text-dark mb-0">{activeCourse.courseTitle}</h5>
            <small className="text-muted">
              {activeCourse.cohortName} · Instructor: {activeCourse.instructor || 'EGSA Faculty'}
            </small>
          </div>
          <div style={{ minWidth: '160px' }}>
            <ProgressBar percent={attendanceRate} showLabel />
          </div>
        </div>

        {/* Desktop Table View (Hidden on mobile <768px) */}
        <div className="table-responsive d-none d-md-block">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr className="small text-muted">
                <th>#</th>
                <th>Session Topic</th>
                <th>Date & Schedule</th>
                <th>Location / Mode</th>
                <th>Status</th>
                <th>Check-in Details</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeCourse.sessions?.map((session) => (
                <tr key={session.sessionNumber || session._id}>
                  <td className="fw-bold text-muted">{session.sessionNumber}</td>
                  <td>
                    <div className="fw-semibold text-dark">{session.title}</div>
                    <small className="text-muted">{session.focus || 'Core Engineering'}</small>
                  </td>
                  <td>
                    <div className="small text-dark">
                      {session.date ? new Date(session.date).toLocaleDateString() : 'Scheduled'}
                    </div>
                    <small className="text-muted">{session.time}</small>
                  </td>
                  <td>
                    <span className="badge bg-light text-dark border small me-1">
                      {session.deliveryMode || 'Onsite'}
                    </span>
                    <small className="text-muted d-block">{session.location}</small>
                  </td>
                  <td>
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="small">
                    {session.checkInTime ? (
                      <div>
                        <div className="text-dark">
                          <i className="fa-regular fa-clock me-1 text-muted"></i>
                          {new Date(session.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <span className="badge bg-light text-muted border" style={{ fontSize: '10px' }}>
                          {session.checkInMethod || 'QR Scan'}
                        </span>
                      </div>
                    ) : session.isAttendanceWindowOpen ? (
                      <span className="badge bg-success-subtle text-success border border-success-subtle">
                        Window Open Now
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {session.isAttendanceWindowOpen ? (
                      <button
                        className="btn btn-sm btn-primary py-1 px-2 text-nowrap"
                        onClick={() => {
                          setSelectedSessionForQR(session);
                          setIsQRModalOpen(true);
                        }}
                      >
                        <i className="fa-solid fa-qrcode me-1"></i> Scan
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-link text-muted p-0 text-decoration-none"
                        onClick={() => setIsDisputeModalOpen(true)}
                        title="Report issue or excuse"
                      >
                        <i className="fa-regular fa-circle-question"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (Visible on <768px) */}
        <div className="d-md-none d-flex flex-column gap-3">
          {activeCourse.sessions?.map((session) => (
            <div key={session.sessionNumber || session._id} className="p-3 border rounded bg-white shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="badge bg-light text-primary-egsa border fw-bold">
                  Session #{session.sessionNumber}
                </span>
                <StatusBadge status={session.status} />
              </div>
              <h6 className="fw-bold text-dark mb-1">{session.title}</h6>
              <div className="small text-muted mb-2">
                <div>
                  <i className="fa-regular fa-calendar me-1"></i>
                  {session.date ? new Date(session.date).toLocaleDateString() : 'Scheduled'} · {session.time}
                </div>
                <div>
                  <i className="fa-solid fa-location-dot me-1"></i>
                  {session.location} ({session.deliveryMode || 'Onsite'})
                </div>
                {session.checkInTime && (
                  <div className="text-success mt-1">
                    <i className="fa-solid fa-check me-1"></i>
                    Checked in at {new Date(session.checkInTime).toLocaleTimeString()} ({session.checkInMethod || 'QR'})
                  </div>
                )}
              </div>
              {session.isAttendanceWindowOpen && (
                <button
                  className="btn btn-primary btn-sm w-100 mt-2"
                  onClick={() => {
                    setSelectedSessionForQR(session);
                    setIsQRModalOpen(true);
                  }}
                >
                  <i className="fa-solid fa-qrcode me-1"></i> Mark Attendance Now
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DISPUTES / EXCUSE REQUESTS HISTORY */}
      {disputes.length > 0 && (
        <div className="egsa-card p-4 mb-4">
          <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
            <i className="fa-solid fa-clipboard-question text-primary-egsa"></i>
            Attendance Review & Excuse History
          </h6>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr className="text-muted">
                  <th>Filed Date</th>
                  <th>Session</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Reviewer Remarks</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d._id}>
                    <td>{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="fw-semibold">{d.session?.title || 'Session'}</td>
                    <td>{d.type.replace('_', ' ')}</td>
                    <td className="text-muted">{d.reason}</td>
                    <td>
                      <span
                        className={`badge ${
                          d.status === 'Approved'
                            ? 'bg-success'
                            : d.status === 'Rejected'
                            ? 'bg-danger'
                            : 'bg-warning text-dark'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="text-muted">{d.reviewerNotes || 'Under academic review'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CENTRALIZED INSTITUTIONAL ATTENDANCE POLICY */}
      <div className="egsa-card p-4">
        <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
          <i className="fa-solid fa-scale-balanced text-primary-egsa"></i>
          EGSA Space Academy Attendance Policy & Governance
        </h6>
        <p className="text-muted small mb-3">
          This policy is established by the EGSA Academic Affairs Board. Configured thresholds are centrally enforced by Mission Control:
        </p>

        <div className="row g-3 small">
          <div className="col-md-3">
            <div className="p-3 bg-light rounded border h-100">
              <strong className="text-dark d-block mb-1">
                <i className="fa-solid fa-graduation-cap text-primary-egsa me-1"></i> Minimum Attendance
              </strong>
              <span className="fs-5 fw-bold text-primary-egsa">{minimumAttendance}%</span>
              <p className="text-muted mt-1 mb-0" style={{ fontSize: '11px' }}>
                Required for official certification clearance and academic endorsement.
              </p>
            </div>
          </div>

          <div className="col-md-3">
            <div className="p-3 bg-light rounded border h-100">
              <strong className="text-dark d-block mb-1">
                <i className="fa-solid fa-bell text-warning me-1"></i> Graduated Warnings
              </strong>
              <span className="text-dark fw-semibold">10% Attention / 15% Warning</span>
              <p className="text-muted mt-1 mb-0" style={{ fontSize: '11px' }}>
                Automated student alert dispatched upon reaching absence thresholds.
              </p>
            </div>
          </div>

          <div className="col-md-3">
            <div className="p-3 bg-light rounded border h-100">
              <strong className="text-dark d-block mb-1">
                <i className="fa-solid fa-clock text-accent-egsa me-1"></i> Late Arrival Policy
              </strong>
              <span className="text-dark fw-semibold">0.75x Session Credit</span>
              <p className="text-muted mt-1 mb-0" style={{ fontSize: '11px' }}>
                Arrivals within 15 minutes of start are logged as Late with weighted credit.
              </p>
            </div>
          </div>

          <div className="col-md-3">
            <div className="p-3 bg-light rounded border h-100">
              <strong className="text-dark d-block mb-1">
                <i className="fa-solid fa-shield-halved text-success me-1"></i> QR Attendance Security
              </strong>
              <span className="text-dark fw-semibold">Dynamic Time-limited QR</span>
              <p className="text-muted mt-1 mb-0" style={{ fontSize: '11px' }}>
                Tokens expire automatically. Duplicate and unauthorized proxy check-ins are rejected.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Check-in Modal */}
      <QRCheckInModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onSuccess={handleQRSuccess}
        initialSession={selectedSessionForQR}
      />

      {/* Attendance Dispute Modal */}
      <DisputeModal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        sessions={activeCourse.sessions || []}
        enrollmentId={activeCourse.enrollmentId}
        onSuccess={loadData}
      />
    </div>
  );
}
