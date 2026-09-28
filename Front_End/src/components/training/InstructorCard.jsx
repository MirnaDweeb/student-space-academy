import React from 'react';

export default function InstructorCard({ course }) {
  if (!course || !course.instructor || course.instructor === 'TBD') {
    return null;
  }

  return (
    <div className="egsa-card p-4 mb-4">
      <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
        <i className="fa-solid fa-chalkboard-user text-primary-egsa"></i>
        Program Instructor & Faculty
      </h6>

      <div className="d-flex align-items-center gap-3">
        <div
          className="rounded-circle bg-primary-subtle text-primary-egsa d-flex align-items-center justify-content-center fw-bold fs-5 shadow-xs"
          style={{ width: '48px', height: '48px', flexShrink: 0 }}
        >
          <i className="fa-solid fa-user-astronaut"></i>
        </div>

        <div>
          <h6 className="fw-bold text-dark mb-0">{course.instructor}</h6>
          <span className="small text-muted d-block">
            EGSA Space Academy Faculty
          </span>
          <span className="badge bg-light text-secondary-egsa border mt-1" style={{ fontSize: '0.7rem' }}>
            {course.category}
          </span>
        </div>
      </div>
    </div>
  );
}
