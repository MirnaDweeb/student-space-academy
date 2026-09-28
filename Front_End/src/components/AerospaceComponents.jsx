import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Visual Learning Trajectory (Aerospace Journey)
 * Shows: Application -> Selection -> Enrollment -> Training -> Assessment -> Accreditation
 */
export function LearningTrajectory({ currentStage = 'training' }) {
  const STAGES = [
    {
      id: 'application',
      label: 'Application',
      sublabel: 'Submission',
      icon: 'fa-file-lines',
    },
    {
      id: 'selection',
      label: 'Selection',
      sublabel: 'Readiness Gate',
      icon: 'fa-list-check',
    },
    {
      id: 'enrollment',
      label: 'Enrollment',
      sublabel: 'Seat Confirmed',
      icon: 'fa-circle-check',
    },
    {
      id: 'training',
      label: 'Training',
      sublabel: 'Active Missions',
      icon: 'fa-user-astronaut',
    },
    {
      id: 'assessment',
      label: 'Assessment',
      sublabel: 'Labs & Capstone',
      icon: 'fa-flask-vial',
    },
    {
      id: 'accreditation',
      label: 'Accreditation',
      sublabel: 'EGSA Credential',
      icon: 'fa-award',
    },
  ];

  const stageOrder = ['application', 'selection', 'enrollment', 'training', 'assessment', 'accreditation'];
  const currentIndex = stageOrder.indexOf(currentStage.toLowerCase());

  return (
    <div className="trajectory-container mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span className="telemetry-chip pulse mb-1">
            <span className="status-dot"></span>
            <span>LEARNING TRAJECTORY</span>
          </span>
          <h6 className="fw-bold mb-0 text-dark">Cadet Mission Milestone Path</h6>
        </div>
        <span className="text-muted small d-none d-sm-inline">
          Stage {currentIndex >= 0 ? currentIndex + 1 : 1} of {STAGES.length}
        </span>
      </div>

      <div className="trajectory-steps">
        {STAGES.map((s, idx) => {
          let state = 'upcoming';
          if (idx < currentIndex) state = 'completed';
          else if (idx === currentIndex) state = 'active';
          else if (idx > currentIndex + 1) state = 'locked';

          return (
            <div key={s.id} className={`trajectory-step ${state}`}>
              <div className="trajectory-step-indicator" title={`${s.label}: ${state}`}>
                {state === 'completed' ? (
                  <i className="fa-solid fa-check"></i>
                ) : (
                  <i className={`fa-solid ${s.icon} small`}></i>
                )}
              </div>
              <span className="trajectory-step-title">{s.label}</span>
              <span className="trajectory-step-subtitle d-none d-md-block">{s.sublabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * High-Precision Orbital Progress Ring (SVG)
 */
export function ProgressRing({ percent = 0, size = 110, strokeWidth = 8, label = 'Path Progress' }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="d-inline-flex flex-column align-items-center justify-content-center position-relative">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeOpacity="0.6"
        />
        {/* Orbital Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-secondary)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      {/* Centered Metric */}
      <div
        className="position-absolute d-flex flex-column align-items-center justify-content-center text-center"
        style={{ inset: 0 }}
      >
        <span className="fw-bold fs-4 text-dark lh-1">{clamped}%</span>
        <span className="text-muted" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * Attendance Health Gauge with 85% Qualification Gate
 */
export function AttendanceHealth({ rate = 0, sessionsAttended = 0, totalSessions = 0 }) {
  const isQualified = rate >= 85;

  return (
    <div className="egsa-card p-3 h-100 d-flex flex-column justify-content-between">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <span className="text-muted small fw-semibold text-uppercase tracking-wider">
            Attendance Health
          </span>
          <h4 className="fw-bold text-dark mb-0">{rate}%</h4>
        </div>
        <span
          className={`badge small px-2 py-1 ${
            isQualified ? 'bg-secondary-egsa' : 'bg-warning text-dark'
          }`}
        >
          {isQualified ? 'Accreditation Qualified' : 'Below 85% Threshold'}
        </span>
      </div>

      <div className="my-2">
        <div className="d-flex justify-content-between text-muted small mb-1">
          <span>
            {sessionsAttended} of {totalSessions} Sessions Complete
          </span>
          <span className="fw-semibold text-dark">Gate: 85%</span>
        </div>
        {/* Progress Bar with Gate Line */}
        <div className="position-relative">
          <div className="progress-track" style={{ height: 8 }}>
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, rate)}%`,
                backgroundColor: isQualified ? 'var(--color-secondary)' : 'var(--color-warning)',
              }}
            />
          </div>
          {/* 85% Threshold Marker Line */}
          <div
            className="position-absolute top-0 bottom-0"
            style={{
              left: '85%',
              width: '2px',
              backgroundColor: 'var(--color-black)',
              zIndex: 3,
            }}
            title="85% Certification Requirement"
          />
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center text-muted small mt-2 pt-2 border-top">
        <span>Min. 85% required for Certificate</span>
        <Link to="/student/attendance" className="fw-semibold text-primary-egsa text-decoration-none">
          Audit Records <i className="fa-solid fa-arrow-right ms-1"></i>
        </Link>
      </div>
    </div>
  );
}

/**
 * Mission Gate Alert Box
 */
export function MissionGateAlert({
  type = 'info', // 'urgent' | 'info'
  badge = 'ACTION REQUIRED',
  title,
  message,
  deadline,
  actionLabel,
  actionLink,
  onAction,
}) {
  return (
    <div className={`mission-gate-alert ${type} mb-4`}>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className={`badge ${
                type === 'urgent' ? 'bg-danger text-white' : 'bg-primary-egsa'
              } small px-2 py-1 fw-bold`}
            >
              {badge}
            </span>
            {deadline && (
              <span className="telemetry-chip small">
                <i className="fa-regular fa-clock me-1"></i> {deadline}
              </span>
            )}
          </div>
          <h6 className="fw-bold text-dark mb-1">{title}</h6>
          <p className="text-muted small mb-0">{message}</p>
        </div>

        {actionLabel && (
          <div className="flex-shrink-0">
            {actionLink ? (
              <Link
                to={actionLink}
                className={`btn btn-sm ${
                  type === 'urgent' ? 'btn-danger' : 'btn-primary'
                } px-3 fw-bold`}
              >
                {actionLabel} <i className="fa-solid fa-arrow-right ms-1"></i>
              </Link>
            ) : (
              <button
                type="button"
                className={`btn btn-sm ${
                  type === 'urgent' ? 'btn-danger' : 'btn-primary'
                } px-3 fw-bold`}
                onClick={onAction}
              >
                {actionLabel} <i className="fa-solid fa-arrow-right ms-1"></i>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Aerospace Skeleton Loading Card
 */
export function SkeletonCard({ height = '180px' }) {
  return (
    <div className="egsa-card p-4 mb-3" style={{ minHeight: height }}>
      <div className="skeleton-shimmer mb-3" style={{ width: '40%', height: '18px' }} />
      <div className="skeleton-shimmer mb-2" style={{ width: '80%', height: '14px' }} />
      <div className="skeleton-shimmer mb-4" style={{ width: '60%', height: '14px' }} />
      <div className="d-flex gap-2">
        <div className="skeleton-shimmer" style={{ width: '90px', height: '32px' }} />
        <div className="skeleton-shimmer" style={{ width: '120px', height: '32px' }} />
      </div>
    </div>
  );
}
