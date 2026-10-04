import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ConfirmModal } from '../components/StateComponents.jsx';
import BrandLogo from '../components/BrandLogo.jsx';

const ADMIN_NAV_ITEMS = [
  { to: '/admin/dashboard', icon: 'fa-gauge-high', label: 'Command Overview' },
  { to: '/admin/applications', icon: 'fa-file-signature', label: 'Admissions' },
  { to: '/admin/cohorts', icon: 'fa-layer-group', label: 'Cohorts & Capacity' },
  { to: '/admin/attendance', icon: 'fa-clipboard-user', label: 'Sessions & Attendance' },
  { to: '/admin/assessments', icon: 'fa-graduation-cap', label: 'Assessments & Grading' },
  { to: '/admin/media', icon: 'fa-photo-film', label: 'Media Moderation' },
  { to: '/admin/payments', icon: 'fa-credit-card', label: 'Tuition & Payments' },
  { to: '/admin/certificates', icon: 'fa-award', label: 'Certificate Queue' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="min-vh-100 bg-surface-subtle d-flex flex-column">
      {/* Institutional Admin Top Header */}
      <header className="bg-primary-egsa text-white py-2 px-4 shadow-sm border-bottom border-accent-subtle">
        <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/admin/dashboard" className="text-decoration-none d-flex align-items-center gap-2 text-white">
              <BrandLogo height={32} className="me-2" />
              <div>
                <span className="fw-bold tracking-wider fs-6 text-uppercase d-block lh-1">EGSA Space Academy</span>
                <small className="text-secondary-egsa" style={{ fontSize: '0.75rem' }}>Administration Command Center</small>
              </div>
            </Link>
            <span className="badge bg-secondary-egsa text-dark fw-bold text-uppercase px-2 py-1 small">
              {user?.role === 'superadmin' ? 'SUPER ADMIN' : 'ACADEMIC ADMIN'}
            </span>
          </div>

          <div className="d-flex align-items-center gap-3">
            <Link to="/student/dashboard" className="btn btn-sm btn-outline-light d-none d-sm-inline-flex align-items-center gap-1">
              <i className="fa-solid fa-graduation-cap"></i> Student Portal
            </Link>
            <div className="d-flex align-items-center gap-2">
              <div className="d-none d-md-block text-end lh-sm">
                <div className="small fw-bold text-white">{user?.fullName || 'Administrator'}</div>
                <small className="text-muted" style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{user?.email}</small>
              </div>
              <button
                className="btn btn-sm btn-outline-danger text-light border-light-subtle"
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign out of Administration"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Primary Admin Navigation Strip */}
      <nav className="bg-white border-bottom shadow-sm px-4 overflow-auto">
        <div className="container-fluid">
          <ul className="nav nav-pills flex-nowrap py-2 gap-1">
            {ADMIN_NAV_ITEMS.map((item) => (
              <li key={item.to} className="nav-item">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `nav-link py-2 px-3 text-nowrap rounded-3 d-flex align-items-center gap-2 small fw-medium transition-all ${
                      isActive
                        ? 'bg-primary-egsa text-white shadow-sm'
                        : 'text-dark hover-bg-light'
                    }`
                  }
                >
                  <i className={`fa-solid ${item.icon}`}></i>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main Routed Content */}
      <main className="flex-grow-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="py-3 bg-white border-top text-center text-muted small mt-auto">
        <div className="container-fluid">
          <span>Egyptian Space Agency (EGSA) — Space Academy Institutional Portal © {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        show={showLogoutConfirm}
        title="Sign Out of Administration"
        message="Are you sure you want to end your administrative session?"
        confirmText="Logout"
        confirmVariant="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
