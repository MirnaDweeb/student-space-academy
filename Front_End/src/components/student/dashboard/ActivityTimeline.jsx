import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Activity / Journey Timeline for Egyptian Space Agency Dashboard.
 * Displays only authentic chronological events derived from real Application status transitions,
 * cohort enrollment events, and official certificate milestones.
 */
export default function ActivityTimeline({ timeline = [] }) {
  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="activity-heading">
      <div className="card-header-clean">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-solid fa-clock-rotate-left text-primary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Audit Trail</span>
            <h2 id="activity-heading" className="card-heading-title">Recent Academic Activity</h2>
          </div>
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="empty-training-state py-4 text-center">
          <div className="empty-state-icon-circle-sm">
            <i className="fa-solid fa-timeline text-muted"></i>
          </div>
          <p className="empty-state-description mb-0">
            No academic lifecycle activity recorded yet. Activity will be logged as you submit applications and enroll in programs.
          </p>
        </div>
      ) : (
        <div className="institutional-timeline-tree">
          {timeline.map((event, idx) => (
            <div key={event.id || idx} className="timeline-node-item">
              {/* Vertical connector line */}
              <div className="timeline-node-rail">
                <div className="timeline-node-marker">
                  <i className={`fa-solid ${event.icon || 'fa-circle-dot'}`}></i>
                </div>
                {idx < timeline.length - 1 && <div className="timeline-node-connector"></div>}
              </div>

              {/* Node content */}
              <div className="timeline-node-content">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                  <span className="timeline-event-title">{event.title}</span>
                  <span className="timeline-event-time">
                    {new Date(event.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="timeline-event-desc text-muted mb-1">{event.description}</p>
                {event.link && (
                  <Link to={event.link} className="timeline-event-link">
                    Review Details <i className="fa-solid fa-chevron-right ms-1"></i>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
