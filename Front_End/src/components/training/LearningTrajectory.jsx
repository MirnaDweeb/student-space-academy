import React from 'react';

export default function LearningTrajectory({ enrollment, attendanceRecord }) {
  if (!enrollment) return null;

  const course = enrollment.course || {};
  const isCompleted = enrollment.status === 'Completed';
  const isUpcoming = enrollment.status === 'Confirmed';

  const modules = course.modules && course.modules.length > 0
    ? course.modules
    : (course.syllabus || []).map((topic, idx) => ({
        day: idx + 1,
        title: topic,
        focus: `Topic ${idx + 1}`,
      }));

  if (modules.length === 0) return null;

  // Active module index derived from attendance/past sessions
  const pastSessionsCount = attendanceRecord?.sessions?.filter((s) => s.status !== 'Upcoming').length || 0;
  const currentModuleIdx = isCompleted ? modules.length : isUpcoming ? 0 : Math.min(pastSessionsCount, modules.length - 1);

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <i className="fa-solid fa-route text-primary-egsa"></i>
          Curriculum Learning Trajectory
        </h6>
        <span className="badge bg-light text-muted border small">
          {modules.length} Milestone Stages
        </span>
      </div>

      <p className="text-muted small mb-4">
        Track your progression across each day of the syllabus, from fundamental principles to final project validation.
      </p>

      {/* Trajectory Timeline Cards */}
      <div className="d-flex flex-column gap-3">
        {modules.map((mod, idx) => {
          let stageStatus = 'Upcoming';
          let badgeClass = 'bg-light text-muted border';
          let borderClass = 'border-light-subtle bg-light-subtle';
          let icon = 'fa-circle-notch';

          if (isCompleted || idx < currentModuleIdx) {
            stageStatus = 'Completed';
            badgeClass = 'bg-success-subtle text-success border border-success-subtle';
            borderClass = 'border-success-subtle bg-white';
            icon = 'fa-circle-check text-success';
          } else if (idx === currentModuleIdx && !isUpcoming) {
            stageStatus = 'In Progress';
            badgeClass = 'bg-primary text-white';
            borderClass = 'border-primary border-2 bg-white shadow-sm';
            icon = 'fa-spinner fa-spin text-primary';
          }

          return (
            <div
              key={idx}
              className={`p-3 border rounded d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 ${borderClass}`}
            >
              <div className="d-flex align-items-start gap-3">
                <span
                  className="rounded-circle d-flex align-items-center justify-content-center fw-bold small mt-1"
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: stageStatus === 'Completed' ? 'var(--color-primary-light, #e0f2fe)' : stageStatus === 'In Progress' ? 'var(--color-primary-egsa, #0f3d64)' : '#f1f5f9',
                    color: stageStatus === 'In Progress' ? '#ffffff' : 'var(--color-primary-egsa, #0f3d64)',
                    flexShrink: 0,
                  }}
                >
                  {mod.day || idx + 1}
                </span>

                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                    <h6 className="fw-bold text-dark mb-0">{mod.title || `Module ${idx + 1}`}</h6>
                    {mod.focus && (
                      <span className="badge bg-light text-secondary-egsa border small">
                        {mod.focus}
                      </span>
                    )}
                  </div>
                  {mod.activities && mod.activities.length > 0 && (
                    <small className="text-muted d-block">
                      {mod.activities.slice(0, 3).join(' · ')}
                      {mod.activities.length > 3 ? ` (+${mod.activities.length - 3} more)` : ''}
                    </small>
                  )}
                </div>
              </div>

              <div className="align-self-end align-self-md-center">
                <span className={`badge px-3 py-1 ${badgeClass}`}>
                  <i className={`fa-solid ${icon} me-1 small`}></i> {stageStatus}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
