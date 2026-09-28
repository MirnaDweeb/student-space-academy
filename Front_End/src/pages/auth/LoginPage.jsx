import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authTranslations } from '../../utils/authTranslations.js';

export default function LoginPage() {
  const { login, resendVerification, language = 'en', toggleLanguage = () => {} } = useAuth();
  const t = authTranslations[language] || authTranslations.en;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('sara.demo@egsa-academy.example');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Unverified account state
  const [isUnverified, setIsUnverified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  // Handle URL query flags (e.g. ?session_expired=1 or ?unverified=1)
  useEffect(() => {
    if (searchParams.get('session_expired') === '1') {
      setError(
        language === 'ar'
          ? 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مجدداً للمتابعة.'
          : 'Your security session has expired. Please sign in again to continue.'
      );
    } else if (searchParams.get('unverified') === '1') {
      setIsUnverified(true);
    }
  }, [searchParams, language]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsUnverified(false);
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
      if (responseData?.code === 'EMAIL_NOT_VERIFIED') {
        setIsUnverified(true);
        setUnverifiedEmail(responseData?.data?.email || email);
      } else {
        setError(
          responseData?.message ||
            (language === 'ar'
              ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
              : 'The email or password is incorrect.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendMsg('');
    try {
      const targetEmail = unverifiedEmail.includes('***') ? email : unverifiedEmail;
      const res = await resendVerification(targetEmail);
      setResendMsg(res?.message || t.resendSuccess);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setResendMsg(err.response?.data?.message || (language === 'ar' ? 'فشل إعادة الإرسال.' : 'Failed to resend link.'));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-container-wrapper">
      <div className="auth-card-shell" style={{ maxWidth: 480 }}>
        <div className="p-4 p-md-5">
          {/* Header Bar */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-satellite-dish text-primary-egsa fa-lg"></i>
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

          {/* Unverified Email Dedicated Alert */}
          {isUnverified && (
            <div className="mission-gate-alert urgent mb-4">
              <div className="d-flex align-items-start gap-2">
                <i className="fa-solid fa-envelope-circle-check text-warning-egsa fa-lg mt-1"></i>
                <div className="flex-grow-1">
                  <h6 className="fw-bold mb-1 text-dark">{t.unverifiedNoticeTitle}</h6>
                  <p className="small text-muted mb-2">{t.unverifiedNoticeMsg}</p>
                  {resendMsg && (
                    <div className="alert alert-info py-1 px-2 small mb-2">
                      <i className="fa-solid fa-circle-info me-1"></i>
                      {resendMsg}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline-warning btn-sm fw-semibold"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || resendLoading}
                  >
                    {resendLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        {t.resending}
                      </>
                    ) : resendCooldown > 0 ? (
                      `${t.resendVerificationBtn} (${resendCooldown}s)`
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane me-1"></i>
                        {t.resendVerificationBtn}
                      </>
                    )}
                  </button>
                </div>
              </div>
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

