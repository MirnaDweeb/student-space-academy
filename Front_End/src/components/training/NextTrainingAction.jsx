import React from 'react';
import { Link } from 'react-router-dom';

export default function NextTrainingAction({
  enrollment,
  attendanceRecord,
  assessments = [],
  evaluationStatus,
  onMarkAttendance,
}) {
  if (!enrollment) return null;

  const isCompleted = enrollment.status === 'Completed';

  // 1. Check for active session with open attendance window first, then next upcoming session
  const activeWindowSession = attendanceRecord?.sessions?.find((s) => s.isAttendanceWindowOpen);
  const nextSession = activeWindowSession || attendanceRecord?.sessions?.find((s) => s.status === 'Upcoming');

  // 2. Check for next urgent assessment
  const nextAssessment = assessments.find((a) => a.status === 'In Progress' || a.status === 'Not Started');

  // 3. If course is completed, check evaluation
  const pendingEvaluation = isCompleted && !evaluationStatus?.isCompleted;

  if (pendingEvaluation) {
    return (
      <div className="egsa-card p-4 mb-4 border-start border-4 border-accent-egsa bg-accent-subtle">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-accent-egsa text-white">
                <i className="fa-solid fa-star me-1"></i> Action Required
              </span>
              <span className="small text-muted fw-semibold">End-of-Course Feedback</span>
            </div>
            <h5 className="fw-bold text-dark mb-1">Course & Instructor Evaluation</h5>
            <p className="text-muted small mb-0">
              Your cohort training is complete. Please submit your academic evaluation to finalize clearance for official certificate issuance.
            </p>
          </div>
          <Link to="/student/evaluation" className="btn btn-warning btn-sm px-4 fw-semibold text-dark text-nowrap">
            <i className="fa-solid fa-pen-to-square me-1"></i> Complete Evaluation
          </Link>
        </div>
      </div>
    );
  }

  if (nextSession) {
    const sessionDateFormatted = nextSession.date
      ? new Date(nextSession.date).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Scheduled';

    const isOpenNow = Boolean(nextSession.isAttendanceWindowOpen);
    const windowOpensAt = nextSession.attendanceWindow?.opensAt ? new Date(nextSession.attendanceWindow.opensAt) : null;
    const windowClosesAt = nextSession.attendanceWindow?.closesAt ? new Date(nextSession.attendanceWindow.closesAt) : null;
    const now = new Date();

    let windowStatusText = null;
    if (isOpenNow) {
      windowStatusText = (
        <span className="badge bg-success text-white py-1 px-2">
          <i className="fa-solid fa-circle-dot me-1"></i> Attendance Window Open Now
        </span>
      );
    } else if (windowOpensAt && now < windowOpensAt) {
      windowStatusText = (
        <span className="badge bg-light text-muted border py-1 px-2">
          <i className="fa-regular fa-clock me-1"></i> Attendance opens at {windowOpensAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      );
    } else if (windowClosesAt && now > windowClosesAt) {
      windowStatusText = (
        <span className="badge bg-light text-muted border py-1 px-2">
          <i className="fa-solid fa-lock me-1"></i> Attendance window closed
        </span>
      );
    }

    return (
      <div className={`egsa-card p-4 mb-4 border-start border-4 ${isOpenNow ? 'border-success' : 'border-primary-egsa'} bg-gradient-light shadow-sm`}>
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <span className={`badge ${isOpenNow ? 'bg-success' : 'bg-primary-egsa'}`}>
                <i className="fa-solid fa-satellite-dish me-1"></i> UP NEXT · SESSION #{nextSession.sessionNumber}
              </span>
              <span className="badge bg-light text-primary-egsa border border-primary-subtle small">
                {nextSession.focus || 'Laboratory Session'}
              </span>
              {windowStatusText}
            </div>

            <h5 className="fw-bold text-dark mb-2">{nextSession.title}</h5>

            <div className="d-flex flex-wrap gap-3 text-muted small">
              <span className="d-flex align-items-center gap-1">
                <i className="fa-regular fa-calendar text-primary-egsa"></i>
                <strong className="text-dark">{sessionDateFormatted}</strong>
              </span>
              <span className="d-flex align-items-center gap-1">
                <i className="fa-regular fa-clock text-primary-egsa"></i>
                <strong className="text-dark">{nextSession.time}</strong>
              </span>
              <span className="d-flex align-items-center gap-1">
                <i className="fa-solid fa-location-dot text-primary-egsa"></i>
                <span>{nextSession.location}</span>
              </span>
              <span className="d-flex align-items-center gap-1">
                <i className="fa-solid fa-chalkboard-user text-primary-egsa"></i>
                <span>{nextSession.instructor || 'EGSA Faculty'}</span>
              </span>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 align-self-start align-self-lg-center">
            {isOpenNow && onMarkAttendance ? (
              <button
                className="btn btn-success btn-sm px-3 text-nowrap fw-semibold shadow-sm"
                onClick={() => onMarkAttendance(nextSession)}
              >
                <i className="fa-solid fa-qrcode me-1"></i> Mark Attendance
              </button>
            ) : null}
            <Link to="/student/attendance" className="btn btn-primary btn-sm px-3 text-nowrap">
              <i className="fa-solid fa-calendar-check me-1"></i> View Full Schedule
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (nextAssessment) {
    const dueFormatted = nextAssessment.dueDate
      ? new Date(nextAssessment.dueDate).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })
      : 'Upcoming';

    return (
      <div className="egsa-card p-4 mb-4 border-start border-4 border-accent-egsa bg-accent-subtle shadow-sm">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-accent-egsa text-white">
                <i className="fa-solid fa-pen-ruler me-1"></i> Assessment Pending
              </span>
              <span className="badge bg-light text-dark border small">{nextAssessment.type}</span>
            </div>

            <h5 className="fw-bold text-dark mb-1">{nextAssessment.title}</h5>
            <p className="text-muted small mb-0">
              Satisfies mandatory grading milestones. Weight: {nextAssessment.weight || '15%'} · Due {dueFormatted}.
            </p>
          </div>

          <div className="d-flex gap-2 align-self-start align-self-lg-center">
            <Link to="/student/assessments" className="btn btn-warning btn-sm px-3 fw-semibold text-dark text-nowrap">
              <i className="fa-solid fa-play me-1"></i> Open Assessment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
