import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Refined Quick Actions Grid for Egyptian Space Agency Dashboard.
 * Displays state-aware action tiles with Font Awesome icons, titles, and descriptions.
 */
export default function QuickActions({
  hasActiveEnrollment = false,
  hasActiveApplication = false,
  hasPendingPayment = false,
  hasPendingReadiness = false,
  currentApplicationId,
  readinessCourseId,
}) {
  const actions = [];

  // 1. High priority state-based actions
  if (hasPendingPayment) {
    actions.push({
      id: 'pay',
      title: 'Make Tuition Payment',
      description: 'Select logistics package and complete payment',
      icon: 'fa-credit-card',
      link: '/student/payments',
      priority: true,
      badge: 'Required',
    });
  }

  if (hasPendingReadiness) {
    actions.push({
      id: 'readiness',
      title: 'Complete Readiness Test',
      description: 'Fulfill prerequisite technical diagnostic',
      icon: 'fa-pen-to-square',
      link: `/student/readiness/start?courseId=${readinessCourseId}`,
      priority: true,
      badge: 'Action Needed',
    });
  }

  if (hasActiveEnrollment) {
    actions.push({
      id: 'training',
      title: 'My Enrolled Training',
      description: 'Access active coursework, syllabus, and dates',
      icon: 'fa-graduation-cap',
      link: '/student/training',
    });
    actions.push({
      id: 'attendance',
      title: 'Attendance Records',
      description: 'Audit session presence & qualification status',
      icon: 'fa-calendar-check',
      link: '/student/attendance',
    });
    actions.push({
      id: 'assessments',
      title: 'Assessments & Labs',
      description: 'Review technical quizzes and capstone submissions',
      icon: 'fa-list-check',
      link: '/student/assessments',
    });
    actions.push({
      id: 'evaluation',
      title: 'Course Evaluation',
      description: 'Submit mandatory feedback for certificate release',
      icon: 'fa-star-half-stroke',
      link: '/student/evaluation',
    });
  }

  // 2. Foundation Actions always relevant
  actions.push({
    id: 'programs',
    title: 'Explore Space Programs',
    description: 'Browse EGSA aerospace & satellite engineering curriculum',
    icon: 'fa-compass',
    link: '/student/programs',
  });

  if (hasActiveApplication && !hasPendingPayment && !hasPendingReadiness) {
    actions.push({
      id: 'applications',
      title: 'Track Application Status',
      description: 'Monitor review progress and admissions milestones',
      icon: 'fa-file-lines',
      link: currentApplicationId
        ? `/student/applications/${currentApplicationId}`
        : '/student/applications',
    });
  }

  actions.push({
    id: 'certificate',
    title: 'Official Certificates',
    description: 'Request, confirm, and download EGSA credentials',
    icon: 'fa-award',
    link: '/student/certificate',
  });

  actions.push({
    id: 'media',
    title: 'Training Media & Materials',
    description: 'Access lectures, presentations, and technical documentation',
    icon: 'fa-photo-film',
    link: '/student/media',
  });

  // Limit to top 6 most relevant to avoid visual clutter
  const displayedActions = actions.slice(0, 6);

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="quick-actions-heading">
      <div className="card-header-clean">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-solid fa-bolt-lightning text-primary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Portal Navigation</span>
            <h2 id="quick-actions-heading" className="card-heading-title">Quick Operational Actions</h2>
          </div>
        </div>
      </div>

      <div className="quick-actions-grid">
        {displayedActions.map((act) => (
          <Link
            key={act.id}
            to={act.link}
            className={`quick-action-tile ${act.priority ? 'tile-priority' : ''}`}
            title={act.title}
          >
            <div className="tile-icon-box">
              <i className={`fa-solid ${act.icon}`}></i>
            </div>
            <div className="tile-text-box">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="tile-title">{act.title}</span>
                {act.badge && <span className="tile-priority-badge">{act.badge}</span>}
              </div>
              <p className="tile-desc">{act.description}</p>
            </div>
            <div className="tile-arrow">
              <i className="fa-solid fa-chevron-right"></i>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
