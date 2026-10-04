import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ allowedRoles = ['student'] }) {
  const { isAuthenticated, isInitialized, user } = useAuth();
  const location = useLocation();

  // Prevent flash of login while verifying session from /me
  if (!isInitialized) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 bg-surface-subtle">
        <div className="text-center p-4">
          <div className="spinner-border text-primary-egsa mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
            <span className="visually-hidden">Loading EGSA Session...</span>
          </div>
          <h6 className="fw-bold text-dark mb-1">Egyptian Space Agency</h6>
          <p className="text-muted small mb-0 font-monospace">Authenticating session security credentials...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role authorization (superadmin inherits admin permissions)
  const effectiveRoles = [...allowedRoles];
  if (effectiveRoles.includes('admin') && !effectiveRoles.includes('superadmin')) {
    effectiveRoles.push('superadmin');
  }
  if (effectiveRoles.length > 0 && !effectiveRoles.includes(user.role)) {
    return (
      <div className="container py-5 text-center">
        <div className="card shadow-sm border-0 p-5 mx-auto" style={{ maxWidth: 480 }}>
          <i className="fa-solid fa-shield-halved text-danger-egsa fa-3x mb-3"></i>
          <h4 className="fw-bold mb-2">Access Denied (403)</h4>
          <p className="text-muted small mb-4">
            Your user role (<strong>{user.role}</strong>) does not have authorization to view this section of the Space Academy platform.
          </p>
          <a href="/" className="btn btn-primary">Return to Academy Home</a>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

