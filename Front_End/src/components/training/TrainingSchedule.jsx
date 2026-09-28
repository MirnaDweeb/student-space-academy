import React from 'react';
import { Link } from 'react-router-dom';

export default function TrainingSchedule({ attendanceRecord, course }) {
  const sessions = attendanceRecord?.sessions || [];

  if (sessions.length === 0) {
    return (
      <div className="egsa-card p-4 mb-4">
        <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
          <i className="fa-regular fa-calendar-days text-primary-egsa"></i>
          Cohort Training Schedule
        </h6>
        <p className="text-muted small mb-0">
          Official session timetable will be confirmed once cohort onboarding is finalized by the Space Academy registrar.
        </p>
      </div>
    );
  }

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <i className="fa-regular fa-calendar-days text-primary-egsa"></i>
          Cohort Session Schedule & Agendas
        </h6>
        <Link to="/student/attendance" className="small text-decoration-none">
          Full Attendance Logs <i className="fa-solid fa-chevron-right small"></i>
        </Link>
      </div>

      <div className="d-flex flex-column gap-2">
        {sessions.map((s) => {
          const isUpcoming = s.status === 'Upcoming';
          const isPast = !isUpcoming;

          const dateFormatted = s.date
            ? new Date(s.date).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            : 'Date TBA';

          return (
            <div
              key={s.sessionNumber}
              className={`p-3 border rounded d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 ${
                isUpcoming ? 'bg-light-subtle' : 'bg-white'
              }`}
            >
              <div className="d-flex align-items-start gap-3">
                <span
                  className="badge bg-light text-primary-egsa border rounded-pill mt-1"
                  style={{ minWidth: '70px', textAlign: 'center' }}
                >
                  Day {s.sessionNumber}
                </span>

                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                    <strong className="text-dark small">{s.title}</strong>
                    {s.focus && (
                      <span className="badge bg-light text-secondary-egsa border" style={{ fontSize: '0.7rem' }}>
                        {s.focus}
                      </span>
                    )}
                  </div>
                  <div className="d-flex flex-wrap gap-3 text-muted small" style={{ fontSize: '0.8rem' }}>
                    <span><i className="fa-regular fa-calendar me-1 text-primary-egsa"></i>{dateFormatted}</span>
                    <span><i className="fa-regular fa-clock me-1 text-primary-egsa"></i>{s.time}</span>
                    <span><i className="fa-solid fa-location-dot me-1 text-primary-egsa"></i>{s.location}</span>
                  </div>
                </div>
              </div>

              <div className="align-self-end align-self-md-center">
                <span
                  className={`badge px-2 py-1 small ${
                    s.status === 'Present'
                      ? 'bg-success-subtle text-success border border-success-subtle'
                      : s.status === 'Late'
                      ? 'bg-warning-subtle text-warning border border-warning-subtle'
                      : s.status === 'Absent'
                      ? 'bg-danger-subtle text-danger border border-danger-subtle'
                      : 'bg-light text-muted border'
                  }`}
                >
                  {s.status === 'Present' && <i className="fa-solid fa-check me-1 small"></i>}
                  {s.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
