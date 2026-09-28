import React from 'react';
import { Link } from 'react-router-dom';
import TrainingStatus from './TrainingStatus';

export default function StudentTrainingHero({
  enrollment,
  allEnrollments = [],
  selectedIndex = 0,
  onSelectIndex,
}) {
  if (!enrollment) return null;

  const course = enrollment.course || {};
  const cohort = enrollment.cohort || {};

  const startDateStr = cohort.startDate
    ? new Date(cohort.startDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : course.startDate
    ? new Date(course.startDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'To be announced';

  const endDateStr = cohort.endDate
    ? new Date(cohort.endDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : course.courseEndDate
    ? new Date(course.courseEndDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="egsa-card p-4 p-md-5 mb-4 border-start border-4 border-primary-egsa bg-gradient-light shadow-sm">
      {/* Top telemetry & Multi-Course Switcher */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3 pb-3 border-bottom">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="badge bg-primary-egsa px-2 py-1 small">
            <i className="fa-solid fa-satellite me-1"></i> EGSA Space Academy
          </span>
          <span className="badge bg-light text-primary-egsa border border-primary-subtle small fw-semibold">
            {course.category || 'Specialized Track'}
          </span>
          <span className="badge bg-secondary-egsa text-white small">
            {course.level || 'Core Skills'}
          </span>
          {course.titleAr && (
            <span className="badge bg-light text-dark border small" dir="rtl">
              {course.titleAr}
            </span>
          )}
        </div>

        {/* Multi-Course Switcher (if enrolled in > 1 program) */}
        {allEnrollments.length > 1 && (
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted fw-semibold">Enrolled Program:</span>
            <select
              className="form-select form-select-sm"
              style={{ minWidth: '220px', maxWidth: '320px' }}
              value={selectedIndex}
              onChange={(e) => onSelectIndex && onSelectIndex(Number(e.target.value))}
            >
              {allEnrollments.map((enr, idx) => (
                <option key={enr._id} value={idx}>
                  {enr.course?.title || `Program #${idx + 1}`} ({enr.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Title, Subtitle & Status */}
      <div className="row g-4 align-items-center justify-content-between">
        <div className="col-lg-8">
          <div className="d-flex align-items-center gap-3 flex-wrap mb-2">
            <small className="text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.08em' }}>
              Training Mission Control
            </small>
            <TrainingStatus status={enrollment.status} />
          </div>

          <h2 className="fw-bold text-dark mb-2">{course.title}</h2>

          {course.tagline && (
            <p className="text-secondary-egsa fw-semibold mb-2 fs-6">
              <i className="fa-solid fa-crosshairs me-1 text-primary-egsa"></i> {course.tagline}
            </p>
          )}

          {course.subtitle && (
            <p className="text-muted small mb-3">
              {course.subtitle}
            </p>
          )}

          {/* Operational Meta Chips */}
          <div className="d-flex flex-wrap gap-2 pt-1">
            <div className="p-2 px-3 border rounded bg-white small d-flex align-items-center gap-2 shadow-xs">
              <i className="fa-solid fa-users text-primary-egsa"></i>
              <div>
                <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Cohort</span>
                <strong className="text-dark">{cohort.name || 'Official Academy Cohort'}</strong>
              </div>
            </div>

            <div className="p-2 px-3 border rounded bg-white small d-flex align-items-center gap-2 shadow-xs">
              <i className="fa-regular fa-calendar-check text-primary-egsa"></i>
              <div>
                <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Timeline</span>
                <strong className="text-dark">
                  {startDateStr}
                  {endDateStr ? ` – ${endDateStr}` : ''}
                </strong>
              </div>
            </div>

            <div className="p-2 px-3 border rounded bg-white small d-flex align-items-center gap-2 shadow-xs">
              <i className="fa-regular fa-clock text-primary-egsa"></i>
              <div>
                <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Daily Schedule</span>
                <strong className="text-dark">
                  {course.hoursPerDay || (course.duration ? `${course.duration} ${course.durationUnit || 'Days'}` : 'Schedule Confirmed')}
                </strong>
              </div>
            </div>

            <div className="p-2 px-3 border rounded bg-white small d-flex align-items-center gap-2 shadow-xs">
              <i className="fa-solid fa-location-dot text-primary-egsa"></i>
              <div>
                <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Delivery & Location</span>
                <strong className="text-dark">
                  {course.deliveryMode || 'Onsite'} · {course.location || 'EGSA Cairo'}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="col-lg-4 text-lg-end">
          <div className="d-flex flex-column flex-sm-row flex-lg-column gap-2 justify-content-lg-end">
            {course._id && (
              <Link
                to={`/student/courses/${course._id}`}
                className="btn btn-outline-primary btn-sm px-3"
              >
                <i className="fa-solid fa-arrow-up-right-from-square me-1"></i> Full Course Specification
              </Link>
            )}
            <Link
              to="/student/attendance"
              className="btn btn-primary btn-sm px-3"
            >
              <i className="fa-solid fa-clipboard-user me-1"></i> Session Check-In & Log
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
