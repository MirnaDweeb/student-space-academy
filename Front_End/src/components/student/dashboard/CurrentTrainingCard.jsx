import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Current Training / Program Card for Egyptian Space Agency Dashboard.
 * Displays real enrolled course, cohort cycle, dates, attendance health,
 * and next operational milestone. Includes a dignified institutional empty state.
 */
export default function CurrentTrainingCard({
  enrollments = [],
  attendanceData,
  upcomingSessions = [],
  upcomingAssessments = [],
}) {
  const activeEnrollment = enrollments[0];

  // If no enrolled program, render institutional empty state
  if (!activeEnrollment) {
    return (
      <div className="egsa-institutional-card mb-4" aria-labelledby="training-heading">
        <div className="card-header-clean">
          <div className="d-flex align-items-center gap-2">
            <span className="card-header-icon-pill">
              <i className="fa-solid fa-graduation-cap text-primary-egsa"></i>
            </span>
            <div>
              <span className="card-overline">Current Academic Track</span>
              <h2 id="training-heading" className="card-heading-title">Active Training Program</h2>
            </div>
          </div>
          <Link to="/student/programs" className="clean-action-link">
            Browse Programs <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>

        <div className="empty-training-state">
          <div className="empty-state-icon-circle">
            <i className="fa-solid fa-satellite-dish"></i>
          </div>
          <h3 className="empty-state-title">No Active Training Enrollment</h3>
          <p className="empty-state-description">
            You are not currently enrolled in an active Egyptian Space Agency training cycle.
            Explore available accredited space programs, review prerequisites, and submit an application.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2 pt-2">
            <Link to="/student/programs" className="btn btn-primary btn-sm px-3">
              <i className="fa-solid fa-compass me-1"></i> Explore Space Programs
            </Link>
            <Link to="/student/applications" className="btn btn-outline-primary btn-sm px-3">
              <i className="fa-solid fa-file-lines me-1"></i> Check Applications
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const course = activeEnrollment.course || {};
  const cohort = activeEnrollment.cohort || {};
  const attendanceRate = attendanceData?.overallPercentage;

  // Determine next milestone from real sessions or assessments
  let nextMilestone = null;
  if (upcomingAssessments.length > 0) {
    const nextAss = upcomingAssessments[0];
    nextMilestone = {
      label: nextAss.title || 'Technical Assessment',
      type: nextAss.type || 'Assessment',
      date: nextAss.dueDate || nextAss.assessmentDate,
      icon: 'fa-flask-vial',
      link: '/student/assessments',
    };
  } else if (upcomingSessions.length > 0) {
    const nextSess = upcomingSessions[0];
    nextMilestone = {
      label: nextSess.title || `Session ${nextSess.sessionNumber}`,
      type: 'Training Session',
      date: nextSess.date,
      icon: 'fa-chalkboard-user',
      link: '/student/training',
    };
  }

  const startDateFormatted = cohort.startDate
    ? new Date(cohort.startDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : course.startDate
    ? new Date(course.startDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Scheduled';

  const endDateFormatted = cohort.endDate
    ? new Date(cohort.endDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : course.endDate
    ? new Date(course.endDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="training-heading">
      <div className="card-header-clean">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-solid fa-graduation-cap text-primary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Current Academic Track</span>
            <h2 id="training-heading" className="card-heading-title">Active Training Program</h2>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge-egsa-status badge-status-confirmed">
            <i className="fa-solid fa-circle-check me-1"></i>
            {activeEnrollment.status || 'Confirmed'}
          </span>
          <Link to="/student/training" className="clean-action-link d-none d-sm-inline-flex">
            All Enrollments ({enrollments.length}) <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>

      <div className="active-training-card-body">
        <div className="row g-4 align-items-center">
          {/* Main Course Info */}
          <div className="col-lg-7">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              {course.code && (
                <span className="code-pill">
                  <i className="fa-solid fa-fingerprint me-1"></i>
                  {course.code}
                </span>
              )}
              {course.level && (
                <span className="badge-egsa-subtle">
                  Level: {course.level}
                </span>
              )}
              <span className="badge-egsa-subtle">
                <i className="fa-solid fa-location-dot me-1 text-primary-egsa"></i>
                {course.deliveryMode || 'Onsite'} · {course.location || 'EGSA Cairo'}
              </span>
            </div>

            <h3 className="training-program-title mb-2">
              {course.title || 'Egyptian Space Agency Training Program'}
            </h3>

            {course.overview && (
              <p className="training-program-desc text-muted mb-3">
                {course.overview}
              </p>
            )}

            {/* Metadata Grid */}
            <div className="training-metadata-strip">
              <div className="meta-item">
                <span className="meta-label">Cohort / Cycle</span>
                <span className="meta-value">
                  {cohort.name || 'Autumn Cycle 2026/27'}
                </span>
              </div>

              <div className="meta-item">
                <span className="meta-label">Start Date</span>
                <span className="meta-value">{startDateFormatted}</span>
              </div>

              {endDateFormatted && (
                <div className="meta-item d-none d-sm-block">
                  <span className="meta-label">Completion Target</span>
                  <span className="meta-value">{endDateFormatted}</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress & Milestone Column */}
          <div className="col-lg-5">
            <div className="training-telemetry-box">
              {/* Attendance Indicator */}
              <div className="telemetry-row mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="telemetry-label">
                    <i className="fa-solid fa-calendar-check me-1 text-primary-egsa"></i>
                    Attendance Health
                  </span>
                  <span className="telemetry-value">
                    {attendanceRate != null ? `${attendanceRate}%` : 'Awaiting Records'}
                  </span>
                </div>
                <div className="training-progress-track">
                  <div
                    className={`training-progress-fill ${
                      attendanceRate >= 85 ? 'fill-qualified' : 'fill-standard'
                    }`}
                    style={{ width: `${Math.min(100, attendanceRate || 0)}%` }}
                  />
                </div>
                <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
                  <span>Required: 85% for Certificate</span>
                  <span>{attendanceRate >= 85 ? 'Qualified' : 'In Progress'}</span>
                </div>
              </div>

              {/* Next Milestone */}
              {nextMilestone ? (
                <div className="next-milestone-box mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="milestone-tag">
                      <i className={`fa-solid ${nextMilestone.icon} me-1`}></i>
                      NEXT MILESTONE
                    </span>
                    {nextMilestone.date && (
                      <span className="milestone-date">
                        {new Date(nextMilestone.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  <div className="milestone-title">{nextMilestone.label}</div>
                  <div className="milestone-type">{nextMilestone.type}</div>
                </div>
              ) : (
                <div className="next-milestone-box mb-3">
                  <div className="milestone-tag">
                    <i className="fa-solid fa-circle-check me-1"></i>
                    COURSE STATUS
                  </div>
                  <div className="milestone-title">Class Active & On Schedule</div>
                  <div className="milestone-type">Follow weekly syllabus in the training portal</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="d-flex flex-wrap gap-2 pt-1">
                <Link to="/student/training" className="btn btn-primary btn-sm flex-grow-1">
                  <i className="fa-solid fa-graduation-cap me-1"></i> My Training
                </Link>
                <Link to="/student/attendance" className="btn btn-outline-primary btn-sm">
                  <i className="fa-solid fa-calendar-check me-1"></i> Attendance
                </Link>
                <Link to="/student/media" className="btn btn-outline-secondary btn-sm" title="Course Materials">
                  <i className="fa-solid fa-folder-open me-1"></i> Media
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
