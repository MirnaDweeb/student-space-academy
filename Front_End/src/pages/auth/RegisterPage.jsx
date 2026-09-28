import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { authTranslations } from '../../utils/authTranslations.js';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  nationalId: '',
  status: 'student',
  university: '',
  faculty: '',
  department: '',
  graduationYear: '',
  agreeToTerms: false,
};

export default function RegisterPage() {
  const { register, resendVerification, language = 'en', toggleLanguage = () => {}, isRTL = false } = useAuth();
  const t = authTranslations[language] || authTranslations.en;
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Success state for post-registration verification notice
  const [registeredEmail, setRegisteredEmail] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError('');
  };

  // Password rules validation
  const passwordRules = useMemo(() => {
    const p = form.password || '';
    return {
      length: p.length >= 6,
      upper: /[A-Z]/.test(p),
      lower: /[a-z]/.test(p),
      number: /[0-9]/.test(p),
      special: /[^A-Za-z0-9]/.test(p),
    };
  }, [form.password]);

  // Password strength score (0 to 4)
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (passwordRules.length) score++;
    if (passwordRules.upper && passwordRules.lower) score++;
    if (passwordRules.number) score++;
    if (passwordRules.special) score++;
    return score;
  }, [passwordRules]);

  const strengthColor = useMemo(() => {
    if (passwordStrength <= 1) return 'var(--color-danger)';
    if (passwordStrength === 2) return 'var(--color-warning)';
    if (passwordStrength === 3) return 'var(--color-primary)';
    return 'var(--color-secondary)';
  }, [passwordStrength]);

  const strengthLabel = useMemo(() => {
    if (passwordStrength <= 1) return t.strengthWeak;
    if (passwordStrength === 2) return t.strengthFair;
    if (passwordStrength === 3) return t.strengthGood;
    return t.strengthStrong;
  }, [passwordStrength, t]);

  const isNationalIdValid = useMemo(() => {
    if (!form.nationalId) return true; // not validated yet
    return /^\d{14}$/.test(form.nationalId.trim());
  }, [form.nationalId]);

  const passwordsMatch = useMemo(() => {
    if (!form.confirmPassword) return true;
    return form.password === form.confirmPassword;
  }, [form.password, form.confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isNationalIdValid) {
      setError(language === 'ar' ? 'يجب أن يتكون الرقم القومي من ١٤ رقماً.' : 'National ID must be exactly 14 digits.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(language === 'ar' ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.');
      return;
    }
    if (!form.agreeToTerms) {
      setError(t.termsRequired);
      return;
    }

    setLoading(true);
    try {
      const res = await register(form);
      setRegisteredEmail(res?.data?.email || form.email);
    } catch (err) {
      setError(err.response?.data?.message || (language === 'ar' ? 'فشل إنشاء الحساب. يرجى مراجعة البيانات.' : 'Registration failed. Please check your data.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendMsg('');
    try {
      const res = await resendVerification(form.email);
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
      <div className="auth-card-shell" style={{ maxWidth: 1080 }}>
        {/* Registration Success / Email Verification Screen */}
        {registeredEmail ? (
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

            <div className="mx-auto mb-4" style={{ maxWidth: 540 }}>
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
                <i className="fa-solid fa-envelope-circle-check fa-2x text-secondary-egsa"></i>
              </div>

              <span className="badge bg-secondary-subtle text-secondary-egsa px-3 py-1 rounded-pill mb-2 fw-semibold">
                {t.regSuccessTitle}
              </span>
              <h2 className="fw-bold mb-2 text-dark">{t.regSuccessHeading}</h2>
              <p className="text-muted mb-4">{t.regSuccessDesc}</p>

              <div className="p-3 bg-surface-subtle border rounded-3 font-monospace fw-bold text-primary-egsa mb-4 fs-5">
                {registeredEmail}
              </div>

              <p className="small text-muted mb-4">{t.regSuccessNotice}</p>

              <div className="d-grid gap-2 mb-4">
                <Link to="/login" className="btn btn-primary py-2 fw-semibold">
                  <i className="fa-solid fa-arrow-right-to-bracket me-2"></i>
                  {t.openLoginBtn}
                </Link>
              </div>

              <div className="border-top pt-4">
                <p className="small text-muted mb-2">{t.didNotReceive}</p>
                {resendMsg && (
                  <div className="alert alert-info py-2 small mb-3">
                    <i className="fa-solid fa-circle-info me-2"></i>
                    {resendMsg}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
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
        ) : (
          /* Two-Panel Aerospace Layout */
          <div className="row g-0">
            {/* Left Hero Panel */}
            <div className="col-lg-5 auth-hero-banner d-none d-lg-flex">
              <div>
                <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-4" style={{ background: 'rgba(212, 184, 124, 0.15)', border: '1px solid rgba(212, 184, 124, 0.3)', color: '#D4B87C', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                  <i className="fa-solid fa-satellite"></i>
                  <span>{t.brandTag}</span>
                </div>

                <h2 className="fw-bold mb-3 text-white" style={{ fontSize: '1.85rem', lineHeight: 1.25 }}>
                  {t.missionTitle}
                </h2>
                <p className="text-light opacity-75 mb-5" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {t.missionSubtitle}
                </p>

                <div className="d-flex flex-column gap-4">
                  <div className="d-flex align-items-start gap-3">
                    <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <i className="fa-solid fa-microchip text-accent-light"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.88rem' }}>{t.pillar1Title}</h6>
                      <p className="text-light opacity-75 mb-0" style={{ fontSize: '0.78rem' }}>{t.pillar1Desc}</p>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-3">
                    <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <i className="fa-solid fa-certificate text-secondary-light"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.88rem' }}>{t.pillar2Title}</h6>
                      <p className="text-light opacity-75 mb-0" style={{ fontSize: '0.78rem' }}>{t.pillar2Desc}</p>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-3">
                    <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <i className="fa-solid fa-atom text-accent-light"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.88rem' }}>{t.pillar3Title}</h6>
                      <p className="text-light opacity-75 mb-0" style={{ fontSize: '0.78rem' }}>{t.pillar3Desc}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-top border-white-50 text-white-50 small">
                <span>EGSA Space Academy &copy; {new Date().getFullYear()}</span>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="col-lg-7 p-4 p-md-5">
              {/* Top Bar with Language Toggle */}
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

              <div className="mb-4">
                <h3 className="fw-bold mb-1 text-dark">{t.registerTitle}</h3>
                <p className="text-muted small mb-0">{t.registerSubtitle}</p>
              </div>

              {error && (
                <div className="alert alert-danger py-2 d-flex align-items-center gap-2 small" role="alert">
                  <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                {/* 1. PERSONAL INFORMATION */}
                <div className="auth-section-divider">
                  <span className="auth-section-number">1</span>
                  <span>{t.personalInfoTitle}</span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="fullName">
                      {t.fullNameLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      className="form-control"
                      value={form.fullName}
                      onChange={update('fullName')}
                      placeholder={t.fullNamePlaceholder}
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="email">
                      {t.emailLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={update('email')}
                      placeholder={t.emailPlaceholder}
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="phone">
                      {t.phoneLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      className="form-control"
                      value={form.phone}
                      onChange={update('phone')}
                      placeholder={t.phonePlaceholder}
                      autoComplete="tel"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="nationalId">
                      {t.nationalIdLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="nationalId"
                      type="text"
                      maxLength={14}
                      className={`form-control font-monospace ${form.nationalId && !isNationalIdValid ? 'is-invalid' : ''}`}
                      value={form.nationalId}
                      onChange={update('nationalId')}
                      placeholder={t.nationalIdPlaceholder}
                      required
                    />
                    {form.nationalId && !isNationalIdValid && (
                      <div className="invalid-feedback small">
                        {language === 'ar' ? 'الرقم القومي يجب أن يتكون من ١٤ رقماً بالتمام.' : 'National ID must be exactly 14 digits.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. ACADEMIC INFORMATION */}
                <div className="auth-section-divider">
                  <span className="auth-section-number">2</span>
                  <span>{t.academicInfoTitle}</span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="status">
                      {t.statusLabel} <span className="text-danger">*</span>
                    </label>
                    <select
                      id="status"
                      className="form-select"
                      value={form.status}
                      onChange={update('status')}
                      required
                    >
                      <option value="student">{t.statusStudent}</option>
                      <option value="graduate">{t.statusGraduate}</option>
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="graduationYear">
                      {t.graduationYearLabel}
                    </label>
                    <input
                      id="graduationYear"
                      type="number"
                      min={1990}
                      max={2100}
                      className="form-control"
                      value={form.graduationYear}
                      onChange={update('graduationYear')}
                      placeholder={t.graduationYearPlaceholder}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="university">
                      {t.universityLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="university"
                      type="text"
                      className="form-control"
                      value={form.university}
                      onChange={update('university')}
                      placeholder={t.universityPlaceholder}
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="faculty">
                      {t.facultyLabel} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="faculty"
                      type="text"
                      className="form-control"
                      value={form.faculty}
                      onChange={update('faculty')}
                      placeholder={t.facultyPlaceholder}
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold" htmlFor="department">
                      {t.departmentLabel}
                    </label>
                    <input
                      id="department"
                      type="text"
                      className="form-control"
                      value={form.department}
                      onChange={update('department')}
                      placeholder={t.departmentPlaceholder}
                    />
                  </div>
                </div>

                {/* 3. SECURITY & ACCESS */}
                <div className="auth-section-divider">
                  <span className="auth-section-number">3</span>
                  <span>{t.securityTitle}</span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="password">
                      {t.passwordLabel} <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        value={form.password}
                        onChange={update('password')}
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

                    {/* Password Strength Indicator */}
                    {form.password && (
                      <div className="password-strength-container">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                            {language === 'ar' ? 'قوة كلمة المرور:' : 'Password strength:'}
                          </span>
                          <span className="fw-bold" style={{ fontSize: '0.72rem', color: strengthColor }}>
                            {strengthLabel}
                          </span>
                        </div>
                        <div className="password-meter-track">
                          <div
                            className="password-meter-segment"
                            style={{ backgroundColor: passwordStrength >= 1 ? strengthColor : 'transparent' }}
                          />
                          <div
                            className="password-meter-segment"
                            style={{ backgroundColor: passwordStrength >= 2 ? strengthColor : 'transparent' }}
                          />
                          <div
                            className="password-meter-segment"
                            style={{ backgroundColor: passwordStrength >= 3 ? strengthColor : 'transparent' }}
                          />
                          <div
                            className="password-meter-segment"
                            style={{ backgroundColor: passwordStrength >= 4 ? strengthColor : 'transparent' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="confirmPassword">
                      {t.confirmPasswordLabel} <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        className={`form-control ${form.confirmPassword && !passwordsMatch ? 'is-invalid' : ''}`}
                        value={form.confirmPassword}
                        onChange={update('confirmPassword')}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary px-3"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? t.hidePassword : t.showPassword}
                      >
                        <i className={`fa-regular ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {form.confirmPassword && !passwordsMatch && (
                      <div className="invalid-feedback small d-block">
                        {language === 'ar' ? 'كلمات المرور غير متطابقة.' : 'Passwords do not match.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Password Requirements Checklist */}
                <div className="password-checklist mt-2 p-2 bg-surface-subtle rounded-2">
                  <div className={`password-req-item ${passwordRules.length ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.length ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqLength}</span>
                  </div>
                  <div className={`password-req-item ${passwordRules.upper ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.upper ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqUpper}</span>
                  </div>
                  <div className={`password-req-item ${passwordRules.lower ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.lower ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqLower}</span>
                  </div>
                  <div className={`password-req-item ${passwordRules.number ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.number ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqNumber}</span>
                  </div>
                  <div className={`password-req-item ${passwordRules.special ? 'met' : ''}`}>
                    <i className={`fa-solid ${passwordRules.special ? 'fa-circle-check text-secondary-egsa' : 'fa-circle-notch text-muted'}`}></i>
                    <span>{t.reqSpecial}</span>
                  </div>
                </div>

                {/* Terms Agreement */}
                <div className="form-check my-4">
                  <input
                    id="agreeToTerms"
                    type="checkbox"
                    className="form-check-input"
                    checked={form.agreeToTerms}
                    onChange={update('agreeToTerms')}
                    required
                  />
                  <label className="form-check-label small" htmlFor="agreeToTerms">
                    {t.termsAgreement}
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2 fw-semibold shadow-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {t.creatingAccountBtn}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-user-plus me-2"></i>
                      {t.createAccountBtn}
                    </>
                  )}
                </button>

                <div className="text-center mt-3 pt-2">
                  <span className="text-muted small me-2">{t.alreadyHaveAccount}</span>
                  <Link to="/login" className="small fw-bold text-primary-egsa">
                    {t.signInLink}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

