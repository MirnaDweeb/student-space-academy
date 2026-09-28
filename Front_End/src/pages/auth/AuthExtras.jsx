import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authTranslations } from '../../utils/authTranslations.js';
import { authService } from '../../services/authService';

/**
 * 1. Dedicated Email Verification Landing Page
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { verifyEmail, resendVerification, language = 'en', toggleLanguage = () => {} } = useAuth();
  const t = authTranslations[language] || authTranslations.en;

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  // Resend state if verification fails or was expired
  const [resendEmail, setResendEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage(
        language === 'ar'
          ? 'رمز التأكيد مفقود من الرابط. يرجى طلب رابط تأكيد جديد.'
          : 'Missing verification token in the URL. Please request a new verification email.'
      );
      return;
    }

    verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message || t.verifiedSuccessMsg);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message || t.verifiedErrorMsg);
      });
  }, [params, verifyEmail, language, t]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail || resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendMsg('');
    try {
      const res = await resendVerification(resendEmail);
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
      setResendMsg(err.response?.data?.message || (language === 'ar' ? 'فشل إعادة الإرسال.' : 'Failed to resend.'));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-container-wrapper">
      <div className="auth-card-shell" style={{ maxWidth: 520 }}>
        <div className="p-4 p-md-5 text-center">
          <div className="d-flex justify-content-end mb-3">
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

          {status === 'loading' && (
            <div className="py-4">
              <div className="spinner-border text-primary-egsa mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
                <span className="visually-hidden">Verifying...</span>
              </div>
              <h4 className="fw-bold mb-2 text-dark">{t.verifyingTitle}</h4>
              <p className="text-muted small">{t.verifyingMsg}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-2">
              <div
                className="d-inline-flex align-items-center justify-content-center mb-3"
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'var(--color-secondary-subtle)',
                  border: '2px solid var(--color-secondary)',
                }}
              >
                <i className="fa-solid fa-circle-check fa-2x text-secondary-egsa"></i>
              </div>
              <h3 className="fw-bold mb-2 text-dark">{t.verifiedSuccessTitle}</h3>
              <p className="text-muted mb-4">{message}</p>
              <Link className="btn btn-primary w-100 py-2 fw-semibold" to="/login">
                <i className="fa-solid fa-arrow-right-to-bracket me-2"></i>
                {t.signInBtn}
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="py-2">
              <div
                className="d-inline-flex align-items-center justify-content-center mb-3"
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'var(--color-danger-subtle)',
                  border: '2px solid var(--color-danger)',
                }}
              >
                <i className="fa-solid fa-circle-xmark fa-2x text-danger-egsa"></i>
              </div>
              <h3 className="fw-bold mb-2 text-dark">{t.verifiedErrorTitle}</h3>
              <p className="text-muted small mb-4">{message}</p>

              {/* Resend Form */}
              <div className="card border p-3 bg-surface-subtle text-start mb-3">
                <h6 className="fw-bold small mb-1 text-dark">{t.requestNewLink}</h6>
                <p className="text-muted" style={{ fontSize: '0.78rem' }}>{t.enterEmailToResend}</p>

                {resendMsg && (
                  <div className="alert alert-info py-1 px-2 small mb-2">
                    <i className="fa-solid fa-circle-info me-1"></i>
                    {resendMsg}
                  </div>
                )}

                <form onSubmit={handleResend}>
                  <div className="input-group mb-2">
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      placeholder="student@example.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={resendCooldown > 0 || resendLoading}
                    >
                      {resendLoading ? t.resending : resendCooldown > 0 ? `${resendCooldown}s` : t.sendLinkBtn}
                    </button>
                  </div>
                </form>
              </div>

              <Link className="btn btn-outline-secondary w-100 btn-sm" to="/login">
                {t.backToLogin}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Dedicated Forgot Password Page
 */
export function ForgotPasswordPage() {
  const { language = 'en', toggleLanguage = () => {} } = useAuth();
  const t = authTranslations[language] || authTranslations.en;

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');

    try {
      await authService.forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || (language === 'ar' ? 'حدث خطأ. يرجى المحاولة لاحقاً.' : 'Failed to process request. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container-wrapper">
      <div className="auth-card-shell" style={{ maxWidth: 460 }}>
        <div className="p-4 p-md-5">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-satellite-dish text-primary-egsa"></i>
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

          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center mb-3"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--color-primary-subtle)',
                border: '1px solid rgba(58, 105, 133, 0.2)',
              }}
            >
              <i className="fa-solid fa-key fa-xl text-primary-egsa"></i>
            </div>
            <h3 className="fw-bold mb-1 text-dark">{t.forgotTitle}</h3>
            <p className="text-muted small mb-0">{t.forgotSubtitle}</p>
          </div>

          {error && (
            <div className="alert alert-danger py-2 small mb-3">
              <i className="fa-solid fa-triangle-exclamation me-1"></i>
              {error}
            </div>
          )}

          {submitted ? (
            <div className="text-center py-3">
              <div className="alert alert-success py-3 mb-4">
                <i className="fa-solid fa-paper-plane fa-lg mb-2 d-block"></i>
                <h6 className="fw-bold mb-1">
                  {language === 'ar' ? 'تم إرسال تعليمات الاستعادة' : 'Recovery Instructions Sent'}
                </h6>
                <p className="small mb-0">
                  {language === 'ar'
                    ? 'إذا كان هذا البريد مسجلاً لدينا، ستتلقى رابطاً آمناً لإعادة تعيين كلمة المرور خلال لحظات.'
                    : 'If an account exists with that email address, password reset instructions have been dispatched.'}
                </p>
              </div>
              <Link to="/login" className="btn btn-outline-primary w-100 fw-semibold">
                {t.backToLogin}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-4">
                <label className="form-label small fw-semibold" htmlFor="forgotEmail">
                  {t.emailLabel} <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-surface-subtle text-muted">
                    <i className="fa-regular fa-envelope"></i>
                  </span>
                  <input
                    id="forgotEmail"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 py-2 fw-semibold shadow-sm mb-3"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {t.sendingResetLinkBtn}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane me-2"></i>
                    {t.sendResetLinkBtn}
                  </>
                )}
              </button>

              <div className="text-center">
                <Link to="/login" className="small text-muted text-decoration-none">
                  <i className="fa-solid fa-arrow-left me-1"></i>
                  {t.backToLogin}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Dedicated Reset Password Page
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { language = 'en', toggleLanguage = () => {} } = useAuth();
  const t = authTranslations[language] || authTranslations.en;

  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Password rules validation
  const passwordRules = useMemo(() => {
    return {
      length: password.length >= 6,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    };
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError(language === 'ar' ? 'رمز إعادة التعيين مفقود.' : 'Reset token is missing.');
      return;
    }
    if (password !== confirmPassword) {
      setError(language === 'ar' ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError(language === 'ar' ? 'يجب أن تتكون كلمة المرور من ٦ أحرف على الأقل.' : 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.resetPassword({ token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || (language === 'ar' ? 'فشل إعادة تعيين كلمة المرور.' : 'Failed to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container-wrapper">
      <div className="auth-card-shell" style={{ maxWidth: 460 }}>
        <div className="p-4 p-md-5">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-satellite-dish text-primary-egsa"></i>
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

          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center mb-3"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--color-secondary-subtle)',
                border: '1px solid rgba(30, 124, 133, 0.2)',
              }}
            >
              <i className="fa-solid fa-lock-open fa-xl text-secondary-egsa"></i>
            </div>
            <h3 className="fw-bold mb-1 text-dark">{t.resetTitle}</h3>
            <p className="text-muted small mb-0">{t.resetSubtitle}</p>
          </div>

          {error && (
            <div className="alert alert-danger py-2 small mb-3">
              <i className="fa-solid fa-triangle-exclamation me-1"></i>
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center py-3">
              <div className="alert alert-success py-3 mb-4">
                <i className="fa-solid fa-circle-check fa-2x mb-2 d-block text-secondary-egsa"></i>
                <h6 className="fw-bold mb-1">
                  {language === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password Reset Successful'}
                </h6>
                <p className="small mb-0">
                  {language === 'ar'
                    ? 'تم إلغاء كافة الجلسات السابقة لدواعي الأمان. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
                    : 'All previous sessions were invalidated for security. You can now sign in with your new password.'}
                </p>
              </div>
              <Link to="/login" className="btn btn-primary w-100 fw-semibold">
                <i className="fa-solid fa-arrow-right-to-bracket me-2"></i>
                {t.signInBtn}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="newPassword">
                  {t.newPasswordLabel} <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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

              <div className="mb-4">
                <label className="form-label small fw-semibold" htmlFor="confirmNewPassword">
                  {t.confirmNewPasswordLabel} <span className="text-danger">*</span>
                </label>
                <input
                  id="confirmNewPassword"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control ${confirmPassword && password !== confirmPassword ? 'is-invalid' : ''}`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <div className="invalid-feedback small">
                    {language === 'ar' ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.'}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 py-2 fw-semibold shadow-sm mb-3"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {t.resettingPasswordBtn}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check me-2"></i>
                    {t.resetPasswordBtn}
                  </>
                )}
              </button>

              <div className="text-center">
                <Link to="/login" className="small text-muted text-decoration-none">
                  {t.backToLogin}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

