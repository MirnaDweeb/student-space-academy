import React from 'react';
import { Link } from 'react-router-dom';

export default function CourseCard({ course }) {
  return (
    <div className="egsa-card p-4 h-100 d-flex flex-column">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <span className="badge bg-primary-egsa">{course.level}</span>
        <span className="text-accent-egsa fw-bold">{course.price != null ? `${course.price} ${course.currency || 'EGP'}` : 'Pricing TBA'}</span>
      </div>
      <h5 className="mb-1 text-dark fw-bold">{course.title}</h5>
      {course.tagline && (
        <small className="text-secondary-egsa fw-semibold d-block mb-1 text-truncate">
          {course.tagline}
        </small>
      )}
      <p className="text-muted small flex-grow-1">{course.shortDescription}</p>
      <ul className="list-unstyled small text-muted mb-3">
        <li>
          <i className="fa-regular fa-clock me-2"></i>
          {course.duration != null ? `${course.duration} ${course.durationUnit || 'Days'}` : 'Duration TBA'}
          {course.hoursPerDay ? ` · ${course.hoursPerDay}` : ''}
        </li>
        <li><i className="fa-solid fa-location-dot me-2"></i>{course.deliveryMode}</li>
        {course.startDate && (
          <li><i className="fa-regular fa-calendar me-2"></i>{new Date(course.startDate).toLocaleDateString()}</li>
        )}
        {course.capacity != null && (
          <li><i className="fa-solid fa-chair me-2"></i>{course.availableSeats ?? course.capacity} seats available</li>
        )}
      </ul>
      <div className="d-flex gap-2 mt-auto">
        <Link to={`/student/courses/${course._id}`} className="btn btn-outline-primary btn-sm flex-grow-1">
          View Details
        </Link>
        {course.price != null ? (
          <Link to={`/student/courses/${course._id}/fit`} className="btn btn-primary btn-sm flex-grow-1">
            Check My Fit
          </Link>
        ) : (
          <button className="btn btn-primary btn-sm flex-grow-1" disabled title="Applications open once pricing is published">
            Coming Soon
          </button>
        )}
      </div>
    </div>
  );
}
