import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import './studentSidebar.css';

// Grouped navigation per prompt specification
const SIDEBAR_SECTIONS = [
  {
    category: 'Overview',
    items: [
      {
        name: 'Dashboard',
        path: '/student/dashboard',
        icon: 'fa-gauge-high',
      },
    ],
  },
  {
    category: 'Learning & Missions',
    items: [
      {
        name: 'Explore Programs',
        path: '/student/programs',
        icon: 'fa-compass',
        matchPrefixes: ['/student/programs', '/student/courses'],
      },
      {
        name: 'My Applications',
        path: '/student/applications',
        icon: 'fa-file-lines',
        matchPrefixes: ['/student/applications'],
      },
      {
        name: 'My Training',
        path: '/student/training',
        icon: 'fa-graduation-cap',
        matchPrefixes: ['/student/training', '/student/enrollments'],
      },
      {
        name: 'Attendance',
        path: '/student/attendance',
        icon: 'fa-calendar-check',
      },
      {
        name: 'Assessments',
        path: '/student/assessments',
        icon: 'fa-list-check',
        matchPrefixes: ['/student/assessments', '/student/readiness'],
      },
      {
        name: 'My Progress',
        path: '/student/progress',
        icon: 'fa-chart-line',
        matchPrefixes: ['/student/progress', '/student/learning-path', '/student/goal'],
      },
      {
        name: 'Evaluation',
        path: '/student/evaluation',
        icon: 'fa-star-half-stroke',
      },
    ],
  },
  {
    category: 'Records & Account',
    items: [
      {
        name: 'Payments',
        path: '/student/payments',
        icon: 'fa-credit-card',
      },
      {
        name: 'My Media',
        path: '/student/media',
        icon: 'fa-photo-film',
      },
      {
        name: 'Certificate',
        path: '/student/certificate',
        icon: 'fa-award',
        matchPrefixes: ['/student/certificate', '/student/certificates'],
      },
      {
        name: 'Notifications',
        path: '/student/notifications',
        icon: 'fa-bell',
        hasBadge: true,
      },
      {
        name: 'My Profile',
        path: '/student/profile',
        icon: 'fa-circle-user',
      },
    ],
  },
];

export default function StudentSidebar({
  isCollapsed = false,
  setIsCollapsed,
  isMobileOpen = false,
  setIsMobileOpen,
  unreadCount = 0,
  user,
  onLogout,
}) {
  const handleNavClick = () => {
    // Close mobile drawer when a link is clicked
    if (isMobileOpen && setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'S';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop d-lg-none"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Persistent Sidebar */}
      <aside
        className={`student-sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
        aria-label="Student Portal Navigation"
      >
        {/* Brand Header */}
        <Link to="/student/dashboard" className="sidebar-brand" onClick={handleNavClick}>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-icon">
              <i className="fa-solid fa-satellite-dish"></i>
            </div>
            {!isCollapsed && <span>EGSA Academy</span>}
          </div>
          {isMobileOpen && (
            <button
              className="btn btn-sm btn-link text-muted d-lg-none p-0"
              onClick={(e) => {
                e.preventDefault();
                setIsMobileOpen(false);
              }}
              aria-label="Close menu"
            >
              <i className="fa-solid fa-xmark fa-lg"></i>
            </button>
          )}
        </Link>

        {/* Student Identity Card */}
        <div className="sidebar-user">
          <div className="sidebar-user-avatar" title={user?.fullName || 'Student'}>
            {getInitials(user?.fullName)}
          </div>
          {!isCollapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" title={user?.fullName}>
                {user?.fullName || 'Academy Student'}
              </div>
              <div className="sidebar-user-role">Space Academy Student</div>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <div className="sidebar-nav-container">
          {SIDEBAR_SECTIONS.map((section, sIdx) => (
            <div key={section.category} className="sidebar-nav-group">
              {!isCollapsed ? (
                <div className="sidebar-section-title">{section.category}</div>
              ) : (
                sIdx > 0 && <div className="sidebar-section-divider" />
              )}
              <ul className="sidebar-menu">
                {section.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={handleNavClick}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'active' : ''}`
                      }
                      title={isCollapsed ? item.name : undefined}
                    >
                      <span className="sidebar-link-icon">
                        <i className={`fa-solid ${item.icon}`}></i>
                      </span>
                      <span className="sidebar-link-text">{item.name}</span>
                      {item.hasBadge && unreadCount > 0 && (
                        <span className="sidebar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Sidebar Footer with Collapse & Logout */}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-collapse-btn d-none d-lg-flex"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <i
              className={`fa-solid ${
                isCollapsed ? 'fa-angles-right' : 'fa-angles-left'
              } me-1`}
            ></i>
            {!isCollapsed && <span>Collapse Sidebar</span>}
          </button>

          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => {
              if (onLogout) onLogout();
            }}
            title="Log out of EGSA Portal"
          >
            <span className="sidebar-link-icon text-danger-egsa">
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
            </span>
            <span className="sidebar-logout-text">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
