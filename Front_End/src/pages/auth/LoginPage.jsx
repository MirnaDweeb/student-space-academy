import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authTranslations } from '../../utils/authTranslations.js';
import BrandLogo from '../../components/BrandLogo.jsx';

export default function LoginPage() {
  const { login, language = 'en', toggleLanguage = () => {} } = useAuth();
  const t = authTranslations[language] || authTranslations.en;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('sara.demo@egsa-academy.example');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState(location.state?.message || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync registration success state or URL flags
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMsg(location.state.message);
    }
    if (location.state?.email) {
      setEmail(location.state.email);
      setPassword('');
    }
  }, [location.state]);

  useEffect(() => {
    if (searchParams.get('session_expired') === '1') {
      setError(
        language === 'ar'
          ? 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مجدداً للمتابعة.'
          : 'Your security session has expired. Please sign in again to continue.'
      );
    }
  }, [searchParams, language]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const user = await login(email, password);

      // Role-based redirection - ensure destination is never /login
      const fromPath = location.state?.from?.pathname;
      const validFrom = fromPath && !fromPath.startsWith('/login') ? fromPath : null;

      const destination = validFrom || (
        user?.role === 'admin'
          ? '/admin'
          : user?.role === 'instructor'
          ? '/instructor'
          : '/student/dashboard'
      );

      navigate(destination, { replace: true });
    } catch (err) {
      const responseData = err.response?.data;
      setError(
        responseData?.message ||
          (language === 'ar'
            ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
            : 'The email or password is incorrect.')
      );
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="auth-container-wrapper">
      <div className="auth-card-shell" style={{ maxWidth: 480 }}>
        <div className="p-4 p-md-5">
          {/* Header Bar */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center gap-2">
              <BrandLogo height={28} className="me-1" />
              <span className="fw-bold text-dark small">{t.portalName}</span>
            </div>
            <button
              type="button"
              className="lang-switch-pill"
              onClick={toggleLanguage}
              aria-label="Toggle language"
            >
              <i className="fa-solid fa-globe text-secondary-egsa"></i>
              <span>{t.switchLang}</span>
            </button>
          </div>

          {/* Heading */}
          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center mb-3"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--color-primary-subtle)',
                border: '1px solid rgba(58, 105, 133, 0.2)',
              }}
            >
              <i className="fa-solid fa-shield-halved fa-2x text-primary-egsa"></i>
            </div>
            <h3 className="fw-bold mb-1 text-dark">{t.loginTitle}</h3>
            <p className="text-muted small mb-0">{t.loginSubtitle}</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center gap-2 small mb-4" role="alert">
              <i className="fa-solid fa-triangle-exclamation flex-shrink-0"></i>
              <div>{error}</div>
            </div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <div className="alert alert-success py-2 d-flex align-items-center gap-2 small mb-4" role="alert">
              <i className="fa-solid fa-circle-check text-success flex-shrink-0"></i>
              <div>{successMsg}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label small fw-semibold" htmlFor="loginEmail">
                {t.loginEmailLabel} <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-group-text bg-surface-subtle text-muted">
                  <i className="fa-regular fa-envelope"></i>
                </span>
                <input
                  id="loginEmail"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small fw-semibold mb-0" htmlFor="loginPassword">
                  {t.loginPasswordLabel} <span className="text-danger">*</span>
                </label>
                <Link to="/forgot-password" className="small text-primary-egsa text-decoration-none">
                  {t.forgotPasswordLink}
                </Link>
              </div>
              <div className="input-group">
                <span className="input-group-text bg-surface-subtle text-muted">
                  <i className="fa-solid fa-lock"></i>
                </span>
                <input
                  id="loginPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                >
                  <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-semibold shadow-sm mt-4"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {t.signingInBtn}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrow-right-to-bracket me-2"></i>
                  {t.signInBtn}
                </>
              )}
            </button>
          </form>

          {/* Footer Actions */}
          <div className="text-center mt-4 pt-3 border-top">
            <span className="text-muted small me-2">{t.dontHaveAccount}</span>
            <Link to="/register" className="small fw-bold text-primary-egsa">
              {t.createOneLink}
            </Link>
          </div>

          <div className="text-center mt-4">
            <span className="badge bg-surface-subtle text-muted px-3 py-1 rounded-pill small border" style={{ fontSize: '0.72rem' }}>
              <i className="fa-solid fa-satellite me-1 text-primary-egsa"></i>
              EGSA Space Academy Credential System
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

