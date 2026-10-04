import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from './BrandLogo.jsx';

export default function Navbar() {
  const { isAuthenticated, user, logout, language = 'en', toggleLanguage = () => {} } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg egsa-navbar sticky-top">
      <div className="container">
        <Link className="navbar-brand brand d-flex align-items-center" to="/">
          <BrandLogo height={32} className="me-2" />
          <span>EGSA Space Academy</span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#egsaNav"
          aria-controls="egsaNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="egsaNav">
          <ul className="navbar-nav me-auto ms-lg-4">
            <li className="nav-item">
              <Link className="nav-link" to="/">Home</Link>
            </li>
            {isAuthenticated && (
              <li className="nav-item">
                <Link className="nav-link fw-semibold text-primary-egsa" to="/student/dashboard">
                  <i className="fa-solid fa-gauge-high me-1"></i> Student Portal
                </Link>
              </li>
            )}
          </ul>
          <div className="d-flex ms-auto gap-2 align-items-center">
            <button
              type="button"
              className="lang-switch-pill me-1"
              onClick={toggleLanguage}
              aria-label="Toggle language"
            >
              <i className="fa-solid fa-globe text-secondary-egsa"></i>
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            {isAuthenticated ? (
              <>
                <span className="navbar-text text-muted small me-2">
                  <i className="fa-regular fa-user me-1"></i> {user?.fullName?.split(' ')[0]}
                </span>
                <Link to="/student/dashboard" className="btn btn-primary btn-sm">
                  {language === 'ar' ? 'البوابة التدريبية' : 'Go to Portal'}
                </Link>
                <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
                  {language === 'ar' ? 'خروج' : 'Logout'}
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-outline-primary btn-sm" to="/login">
                  {language === 'ar' ? 'تسجيل الدخول' : 'Login'}
                </Link>
                <Link className="btn btn-primary btn-sm" to="/register">
                  {language === 'ar' ? 'حساب جديد' : 'Register'}
                </Link>
              </>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
