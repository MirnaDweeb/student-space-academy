import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function CurriculumProgress({ course, enrollment, attendanceRecord }) {
  const [expandedDay, setExpandedDay] = useState(null);

  if (!course) return null;

  const isCompleted = enrollment?.status === 'Completed';
  const isUpcoming = enrollment?.status === 'Confirmed';

  const modules = course.modules && course.modules.length > 0
    ? course.modules
    : (course.syllabus || []).map((topic, idx) => ({
        day: idx + 1,
        title: topic,
        focus: `Topic ${idx + 1}`,
        activities: [],
      }));

  if (modules.length === 0) return null;

  const pastSessionsCount = attendanceRecord?.sessions?.filter((s) => s.status !== 'Upcoming').length || 0;
  const currentModuleIdx = isCompleted ? modules.length : isUpcoming ? 0 : Math.min(pastSessionsCount, modules.length - 1);

  const toggleExpand = (dayNum) => {
    setExpandedDay((prev) => (prev === dayNum ? null : dayNum));
  };

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <i className="fa-solid fa-book-open-reader text-primary-egsa"></i>
          Official Curriculum & Module Topics
        </h6>
        {course._id && (
          <Link to={`/student/courses/${course._id}`} className="small text-decoration-none">
            Specification Page <i className="fa-solid fa-chevron-right small"></i>
          </Link>
        )}
      </div>

      <div className="d-flex flex-column gap-2">
        {modules.map((mod, idx) => {
          const dayNum = mod.day || idx + 1;
          const isExpanded = expandedDay === dayNum;

          let statusLabel = 'Upcoming';
          let badgeClass = 'bg-light text-muted border';

          if (isCompleted || idx < currentModuleIdx) {
            statusLabel = 'Completed';
            badgeClass = 'bg-success-subtle text-success border border-success-subtle';
          } else if (idx === currentModuleIdx && !isUpcoming) {
            statusLabel = 'In Progress';
            badgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
          }

          return (
            <div key={dayNum} className="border rounded bg-white overflow-hidden shadow-xs">
              <button
                type="button"
                className="w-100 p-3 text-start bg-white border-0 d-flex justify-content-between align-items-center"
                onClick={() => toggleExpand(dayNum)}
                aria-expanded={isExpanded}
              >
                <div className="d-flex align-items-center gap-3">
                  <span className="badge bg-light text-primary-egsa border rounded-pill px-2 py-1">
                    Day {dayNum}
                  </span>
                  <div>
                    <strong className="text-dark small d-block">{mod.title}</strong>
                    {mod.focus && (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Focus: {mod.focus}
                      </span>
                    )}
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className={`badge small ${badgeClass}`}>{statusLabel}</span>
                  <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-muted small`}></i>
                </div>
              </button>

              {isExpanded && mod.activities && mod.activities.length > 0 && (
                <div className="p-3 bg-light-subtle border-top">
                  <small className="text-muted fw-bold text-uppercase d-block mb-2" style={{ fontSize: '0.7rem' }}>
                    Scheduled Lectures & Activities:
                  </small>
                  <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                    {mod.activities.map((act, actIdx) => (
                      <li key={actIdx} className="d-flex align-items-start gap-2">
                        <i className="fa-solid fa-play text-primary-egsa mt-1" style={{ fontSize: '0.6rem' }}></i>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
