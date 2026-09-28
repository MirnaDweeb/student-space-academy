import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const ROUTE_INFO_MAP = {
  '/student/dashboard': { title: 'Student Dashboard', breadcrumb: 'Dashboard' },
  '/student/programs': { title: 'Explore Space Programs', breadcrumb: 'Explore Programs' },
  '/student/courses': { title: 'Course Catalog', breadcrumb: 'Courses' },
  '/student/applications': { title: 'My Applications', breadcrumb: 'Applications' },
  '/student/training': { title: 'My Enrolled Training', breadcrumb: 'Training' },
  '/student/enrollments': { title: 'My Enrollments', breadcrumb: 'Enrollments' },
  '/student/attendance': { title: 'Attendance Records', breadcrumb: 'Attendance' },
  '/student/assessments': { title: 'Assessments & Evaluations', breadcrumb: 'Assessments' },
  '/student/progress': { title: 'My Academic Progress', breadcrumb: 'Progress' },
  '/student/goal': { title: 'Select Learning Goal', breadcrumb: 'Goal' },
  '/student/learning-path': { title: 'Recommended Learning Path', breadcrumb: 'Learning Path' },
  '/student/evaluation': { title: 'Course & Instructor Evaluation', breadcrumb: 'Evaluation' },
  '/student/payments': { title: 'Invoices & Payments', breadcrumb: 'Payments' },
  '/student/media': { title: 'Training Media & Materials', breadcrumb: 'My Media' },
  '/student/certificate': { title: 'Certificates & Credentials', breadcrumb: 'Certificate' },
  '/student/certificates': { title: 'Certificates & Credentials', breadcrumb: 'Certificate' },
  '/student/notifications': { title: 'System Notifications', breadcrumb: 'Notifications' },
  '/student/profile': { title: 'My Student Profile', breadcrumb: 'Profile' },
};

export default function StudentHeader({
  onToggleMobileSidebar,
  onToggleCollapseDesktop,
  isCollapsed,
  unreadCount = 0,
  user,
}) {
  const location = useLocation();
  const currentPath = location.pathname;

  // Derive route title and breadcrumb
  let routeMeta = ROUTE_INFO_MAP[currentPath];
  if (!routeMeta) {
    if (currentPath.startsWith('/student/courses/')) {
      if (currentPath.endsWith('/fit')) {
        routeMeta = { title: 'Course Fit Assessment', breadcrumb: 'Course Fit' };
      } else {
        routeMeta = { title: 'Course Details', breadcrumb: 'Course Details' };
      }
    } else if (currentPath.startsWith('/student/applications/')) {
      routeMeta = { title: 'Application Details', breadcrumb: 'Application' };
    } else if (currentPath.startsWith('/student/readiness/')) {
      routeMeta = { title: 'Readiness Assessment', breadcrumb: 'Readiness' };
    } else {
      routeMeta = { title: 'Student Portal', breadcrumb: 'Portal' };
    }
  }

  const getInitials = (name) => {
    if (!name) return 'S';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  };

  return (
    <header className="student-top-header">
      <div className="d-flex align-items-center gap-3">
        {/* Mobile sidebar toggle button */}
        <button
          type="button"
          className="btn btn-light d-lg-none p-2 rounded-circle"
          onClick={onToggleMobileSidebar}
          aria-label="Open navigation menu"
        >
          <i className="fa-solid fa-bars fa-lg text-primary-egsa"></i>
        </button>

        {/* Desktop collapse toggle */}
        <button
          type="button"
          className="btn btn-light d-none d-lg-flex p-2 rounded-circle border-0 text-muted"
          onClick={onToggleCollapseDesktop}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar width"
        >
          <i className={`fa-solid ${isCollapsed ? 'fa-indent' : 'fa-outdent'}`}></i>
        </button>

        {/* Breadcrumb & Title */}
        <div className="header-breadcrumbs">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 small">
              <li className="breadcrumb-item">
                <Link to="/student/dashboard" className="text-decoration-none text-muted">
                  <i className="fa-solid fa-house-chimney me-1 small"></i>Portal
                </Link>
              </li>
              <li className="breadcrumb-item active text-dark fw-semibold" aria-current="page">
                {routeMeta.breadcrumb}
              </li>
            </ol>
          </nav>
          <h1 className="h5 fw-bold mb-0 text-dark header-page-title">{routeMeta.title}</h1>
        </div>
      </div>

      {/* Right Shortcuts: Search, Notifications, Profile */}
      <div className="d-flex align-items-center gap-2 gap-sm-3">
        {/* Mission / Academic cycle badge */}
        <div className="d-none d-xl-flex align-items-center gap-2 telemetry-chip px-2 py-1">
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--color-secondary)',
              display: 'inline-block',
            }}
          />
          <span>MISSION 2026/27 · ACTIVE</span>
        </div>

        {/* Quick link to Explore Programs */}
        <Link
          to="/student/programs"
          className="btn btn-outline-primary btn-sm d-none d-md-inline-flex align-items-center gap-1"
        >
          <i className="fa-solid fa-compass"></i>
          <span>Explore Programs</span>
        </Link>

        {/* Notifications Shortcut */}
        <Link
          to="/student/notifications"
          className="position-relative btn btn-light rounded-circle p-2"
          title="Notifications"
          aria-label="View notifications"
        >
          <i className="fa-regular fa-bell fa-lg text-primary-egsa"></i>
          {unreadCount > 0 && (
            <span
              className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-white"
              style={{ fontSize: '0.65rem' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
              <span className="visually-hidden">unread notifications</span>
            </span>
          )}
        </Link>

        {/* Student Profile Shortcut */}
        <Link
          to="/student/profile"
          className="d-flex align-items-center gap-2 text-decoration-none p-1 ps-2 pe-2 rounded-pill profile-shortcut-btn"
          title="View My Profile"
        >
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold small"
            style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            }}
          >
            {getInitials(user?.fullName)}
          </div>
          <span className="small fw-semibold text-dark d-none d-sm-inline">
            {user?.fullName?.split(' ')[0] || 'Cadet'}
          </span>
          <i className="fa-solid fa-chevron-down small text-muted d-none d-sm-inline" style={{ fontSize: '0.7rem' }}></i>
        </Link>
      </div>
    </header>
  );
}
