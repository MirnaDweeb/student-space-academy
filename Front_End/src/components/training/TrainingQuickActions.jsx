import React from 'react';
import { Link } from 'react-router-dom';

export default function TrainingQuickActions({ enrollment, isCertified = false }) {
  if (!enrollment) return null;

  const course = enrollment.course || {};
  const isCompleted = enrollment.status === 'Completed';

  return (
    <div className="egsa-card p-4 mb-4">
      <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
        <i className="fa-solid fa-compass text-primary-egsa"></i>
        Training Mission Actions
      </h6>

      <div className="row g-2">
        <div className="col-6 col-md-4">
          <Link
            to="/student/attendance"
            className="btn btn-light w-100 p-2 text-start border d-flex align-items-center gap-2 h-100 shadow-xs"
          >
            <i className="fa-solid fa-calendar-check text-primary-egsa fs-5"></i>
            <div>
              <div className="fw-semibold small text-dark">Attendance</div>
              <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Session Logs</small>
            </div>
          </Link>
        </div>

        <div className="col-6 col-md-4">
          <Link
            to="/student/assessments"
            className="btn btn-light w-100 p-2 text-start border d-flex align-items-center gap-2 h-100 shadow-xs"
          >
            <i className="fa-solid fa-list-check text-secondary-egsa fs-5"></i>
            <div>
              <div className="fw-semibold small text-dark">Assessments</div>
              <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Quizzes & Labs</small>
            </div>
          </Link>
        </div>

        <div className="col-6 col-md-4">
          <Link
            to="/student/media"
            className="btn btn-light w-100 p-2 text-start border d-flex align-items-center gap-2 h-100 shadow-xs"
          >
            <i className="fa-solid fa-photo-film text-primary-egsa fs-5"></i>
            <div>
              <div className="fw-semibold small text-dark">My Media</div>
              <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Course Handouts</small>
            </div>
          </Link>
        </div>

        <div className="col-6 col-md-4">
          <Link
            to="/student/evaluation"
            className="btn btn-light w-100 p-2 text-start border d-flex align-items-center gap-2 h-100 shadow-xs"
          >
            <i className="fa-solid fa-star-half-stroke text-accent-egsa fs-5"></i>
            <div>
              <div className="fw-semibold small text-dark">Evaluation</div>
              <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Course Feedback</small>
            </div>
          </Link>
        </div>

        <div className="col-6 col-md-4">
          <Link
            to="/student/progress"
            className="btn btn-light w-100 p-2 text-start border d-flex align-items-center gap-2 h-100 shadow-xs"
          >
            <i className="fa-solid fa-bars-progress text-success fs-5"></i>
            <div>
              <div className="fw-semibold small text-dark">My Progress</div>
              <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Roadmap & Goals</small>
            </div>
          </Link>
        </div>

        {course._id && (
          <div className="col-6 col-md-4">
            <Link
              to={`/student/courses/${course._id}`}
              className="btn btn-light w-100 p-2 text-start border d-flex align-items-center gap-2 h-100 shadow-xs"
            >
              <i className="fa-solid fa-circle-info text-primary-egsa fs-5"></i>
              <div>
                <div className="fw-semibold small text-dark">Course Specs</div>
                <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Official Details</small>
              </div>
            </Link>
          </div>
        )}

        {/* Certificate link only if training is completed or certified */}
        {(isCompleted || isCertified) && (
          <div className="col-12 mt-2">
            <Link
              to="/student/certificates"
              className="btn btn-success-subtle text-success border border-success-subtle w-100 p-2 text-start d-flex align-items-center justify-content-between"
            >
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-certificate fs-5"></i>
                <div>
                  <div className="fw-bold small">Official Certificate Available</div>
                  <small style={{ fontSize: '0.7rem' }}>Download credentials and credentials badge</small>
                </div>
              </div>
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
