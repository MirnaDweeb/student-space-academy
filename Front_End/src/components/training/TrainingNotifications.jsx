import React from 'react';
import { Link } from 'react-router-dom';

export default function TrainingNotifications({ notifications = [], courseId }) {
  // Filter notifications relevant to training or this course
  const trainingItems = notifications.filter((n) => {
    if (n.relatedCourse && String(n.relatedCourse) === String(courseId)) return true;
    const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
    return (
      text.includes('training') ||
      text.includes('session') ||
      text.includes('cohort') ||
      text.includes('schedule') ||
      text.includes('lab') ||
      text.includes('assessment')
    );
  });

  if (trainingItems.length === 0) return null;

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <i className="fa-solid fa-bell text-primary-egsa"></i>
          Training Dispatch & Notices
        </h6>
        <Link to="/student/notifications" className="small text-decoration-none">
          All Notifications <i className="fa-solid fa-chevron-right small"></i>
        </Link>
      </div>

      <div className="d-flex flex-column gap-2 mb-2">
        {trainingItems.slice(0, 3).map((n) => (
          <div key={n._id} className="p-3 border rounded bg-white shadow-xs">
            <div className="d-flex justify-content-between align-items-start mb-1">
              <strong className="text-dark small d-block">{n.title}</strong>
              {n.createdAt && (
                <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="text-muted small mb-0 leading-snug">
              {n.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
