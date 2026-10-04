import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Institutional Dashboard Hero for Egyptian Space Agency Platform
 * Displays authenticated student welcome, active academic status,
 * current enrolled or applied program context, and direct primary/secondary actions.
 */
export default function DashboardHero({
  user,
  profile,
  currentApplication,
  upcomingEnrollments = [],
  urgentGate,
}) {
  const studentName = user?.fullName || profile?.user?.fullName || 'Student';
  const firstName = studentName.split(' ')[0] || 'Student';

  // Determine current academic status
  let statusBadge = {
    label: 'Academic Candidate',
    colorClass: 'status-candidate',
    icon: 'fa-user-check',
  };

  if (upcomingEnrollments.length > 0) {
    statusBadge = {
      label: 'Active Enrolled Student',
      colorClass: 'status-enrolled',
      icon: 'fa-user-graduate',
    };
  } else if (urgentGate) {
    statusBadge = {
      label: urgentGate.badge || 'Action Required',
      colorClass: 'status-action-required',
      icon: 'fa-circle-exclamation',
    };
  } else if (currentApplication) {
    statusBadge = {
      label: `Application: ${currentApplication.status}`,
      colorClass: 'status-review',
      icon: 'fa-clipboard-list',
    };
  }

  // Derive current primary context (active course or pending application)
  const activeEnrollment = upcomingEnrollments[0];
  const activeProgramTitle =
    activeEnrollment?.course?.title || currentApplication?.course?.title || null;
  const activeCohortName =
    activeEnrollment?.cohort?.name || currentApplication?.cohort?.name || null;

  return (
    <section className="egsa-dashboard-hero mb-4" aria-labelledby="hero-welcome-title">
      <div className="hero-content-wrapper">
        <div className="hero-main-column">
          {/* Institutional Status Badge & Telemetry Bar */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className={`hero-status-pill ${statusBadge.colorClass}`}>
              <i className={`fa-solid ${statusBadge.icon} me-1`}></i>
              {statusBadge.label}
            </span>

            <span className="hero-institutional-tag">
              <i className="fa-solid fa-building-columns me-1 text-accent-egsa"></i>
              Egyptian Space Agency · National Academy
            </span>

            {profile?.learningGoal?.title && (
              <span className="hero-specialization-tag d-none d-md-inline-flex">
                <i className="fa-solid fa-bullseye me-1"></i>
                Track: {profile.learningGoal.title}
              </span>
            )}
          </div>

          {/* Heading & Welcome */}
          <h1 id="hero-welcome-title" className="hero-title">
            Welcome back, <span className="hero-title-name">{firstName}</span>.
          </h1>
          <p className="hero-subtitle">
            {activeProgramTitle ? (
              <>
                Active program: <strong className="text-white">{activeProgramTitle}</strong>
                {activeCohortName && <span className="text-white-50"> ({activeCohortName})</span>}.
                Continue your space technology training trajectory.
              </>
            ) : (
              'Welcome to the Egyptian Space Agency portal. Manage your academic journey, active applications, and specialized space technology coursework.'
            )}
          </p>

          {/* Action CTAs */}
          <div className="hero-actions-row">
            {urgentGate ? (
              <Link to={urgentGate.actionLink} className="btn hero-btn-primary">
                <i className="fa-solid fa-arrow-right-to-bracket me-2"></i>
                {urgentGate.actionLabel}
              </Link>
            ) : activeEnrollment ? (
              <Link to="/student/training" className="btn hero-btn-primary">
                <i className="fa-solid fa-graduation-cap me-2"></i>
                Continue Training
              </Link>
            ) : currentApplication ? (
              <Link
                to={`/student/applications/${currentApplication._id}`}
                className="btn hero-btn-primary"
              >
                <i className="fa-solid fa-file-lines me-2"></i>
                View Application Status
              </Link>
            ) : (
              <Link to="/student/programs" className="btn hero-btn-primary">
                <i className="fa-solid fa-compass me-2"></i>
                Explore Programs
              </Link>
            )}

            {/* Secondary Action */}
            {activeEnrollment ? (
              <Link to="/student/attendance" className="btn hero-btn-secondary">
                <i className="fa-solid fa-calendar-check me-2"></i>
                Attendance Records
              </Link>
            ) : (
              <Link to="/student/programs" className="btn hero-btn-secondary">
                <i className="fa-solid fa-compass me-2"></i>
                Course Catalog
              </Link>
            )}

            {!profile?.learningGoal && (
              <Link to="/student/goal" className="btn hero-btn-accent">
                <i className="fa-solid fa-bullseye me-2"></i>
                Set Specialization Goal
              </Link>
            )}
          </div>
        </div>

        {/* Hero Context Widget (Summary Tile) */}
        <div className="hero-side-widget d-none d-lg-flex">
          <div className="hero-widget-card">
            <div className="hero-widget-header">
              <span className="hero-widget-label">Training Cycle</span>
              <span className="hero-widget-status">
                <span className="status-indicator-dot"></span> Active
              </span>
            </div>
            <div className="hero-widget-body">
              <div className="hero-widget-metric">
                {upcomingEnrollments.length > 0
                  ? `${upcomingEnrollments.length} Enrolled`
                  : currentApplication
                  ? 'In Review'
                  : 'Open Intake'}
              </div>
              <div className="hero-widget-desc">
                {upcomingEnrollments.length > 0
                  ? activeCohortName || 'Academic Cohort'
                  : currentApplication?.course?.title || 'Egyptian Space Academy 2026/27'}
              </div>
            </div>
            <div className="hero-widget-footer">
              <i className="fa-solid fa-satellite text-accent-egsa me-2"></i>
              <span>EGSA Operational HQ</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
