import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { certificateCriteriaService } from '../../services/studentPortalServices';
import { certificateService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, PageHeader, ProgressBar } from '../../components/StateComponents.jsx';

export default function CertificatePage() {
  const { user, language = 'en' } = useAuth();
  const isAr = language === 'ar';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Certificate Name Form State
  const [recipientName, setRecipientName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [isEditingSubmittedName, setIsEditingSubmittedName] = useState(false);

  // Document Viewer Modal State
  const [viewingCert, setViewingCert] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    certificateCriteriaService
      .getCertificateStatus()
      .then((res) => {
        setData(res);
        const existingCert = res.certificates?.[0];
        const existingName = existingCert?.certificateName || existingCert?.recipientName;
        if (existingName) {
          setRecipientName(existingName);
        } else if (!recipientName) {
          const suggested = res.defaultStudentName || user?.fullName || '';
          setRecipientName(suggested);
        }
      })
      .catch((err) => setError(err.message || (isAr ? 'فشل تحميل بيانات الشهادة.' : 'Failed to load certificate status.')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Validation function for the certificate recipient name
  const validateName = (raw) => {
    if (!raw || !raw.trim()) {
      return isAr ? 'يرجى إدخال اسمك الكامل المراد كتابته على الشهادة.' : 'Please enter your full name exactly as you want it to appear on your certificate.';
    }
    const collapsed = raw.trim().replace(/\s+/g, ' ');
    if (collapsed.length < 3) {
      return isAr ? 'يجب ألا يقل الاسم عن ٣ أحرف.' : 'Name must contain at least 3 characters.';
    }
    if (collapsed.length > 100) {
      return isAr ? 'يجب ألا يتجاوز الاسم ١٠٠ حرف.' : 'Name cannot exceed 100 characters.';
    }
    if (/[<>{}[\]\\\/;:=+*%$#@!~^|]/.test(collapsed) || /<[^>]*>|script/i.test(collapsed)) {
      return isAr ? 'الاسم يحتوي على رموز أو وسوم غير مسموح بها.' : 'Name contains invalid characters or markup.';
    }
    const validLettersRegex = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\u00C0-\u024F\s\.\-']+$/;
    if (!validLettersRegex.test(collapsed)) {
      return isAr ? 'يرجى استخدام الحروف العربية أو الإنجليزية فقط.' : 'Please enter valid Arabic or English characters only.';
    }
    const hasLetters = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z]/;
    if (!hasLetters.test(collapsed)) {
      return isAr ? 'يجب أن يحتوي الاسم على أحرف صالحة.' : 'Name must contain valid alphabetic letters.';
    }
    return '';
  };

  const handleNameChange = (e) => {
    setRecipientName(e.target.value);
    if (nameError) {
      setNameError('');
    }
  };

  const handleSubmitCertificateName = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const err = validateName(recipientName);
    if (err) {
      setNameError(err);
      return;
    }

    setShowConfirmModal(false);
    setIsSubmitting(true);
    setError('');

    try {
      const cleanName = recipientName.trim().replace(/\s+/g, ' ');
      const targetEnrollmentId = data?.eligibleEnrollment?._id || data?.enrollment?._id;

      await certificateService.submitName({
        enrollmentId: targetEnrollmentId,
        recipientName: cleanName,
        certificateName: cleanName,
      });

      setActionSuccessMsg(
        isAr
          ? 'تم إرسال اسم الشهادة الخاص بك إلى الإدارة وسيتم استخدامه عند إعداد شهادتك.'
          : 'Your certificate name has been submitted to the administration and will be used when preparing your certificate.'
      );

      setIsEditingSubmittedName(false);
      await load();
    } catch (apiErr) {
      setError(
        apiErr.response?.data?.message ||
          apiErr.message ||
          (isAr ? 'حدث خطأ أثناء إرسال الاسم. يرجى المحاولة لاحقاً.' : 'Failed to submit certificate name.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState label={isAr ? 'جاري التحقق من سجلات الاعتماد وشهادات وكالة الفضاء المصرية…' : 'Verifying EGSA certification records…'} />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const { isCertified, certificates = [], criteria, isEligibleForIssuance, eligibleEnrollment, enrollment } = data || {};
  const activeCert = certificates?.[0] || null;
  const certStatus = activeCert ? String(activeCert.status).toUpperCase() : null;

  const hasUploadedFile = !!activeCert?.fileUrl;
  const isIssued = (certStatus === 'ISSUED' || hasUploadedFile) && hasUploadedFile;
  const submittedCertificateName = activeCert?.certificateName || activeCert?.recipientName || '';
  const hasSubmittedName = !!submittedCertificateName;
  const isEligible = isEligibleForIssuance || !!activeCert || (data?.eligibleEnrollments && data.eligibleEnrollments.length > 0);

  const activeCourse = activeCert?.course || eligibleEnrollment?.course || enrollment?.course;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader
        title={isAr ? 'الشهادات والاعتمادات الرسمية' : 'Official Certificates & Credentials'}
        subtitle={
          isAr
            ? 'اعتمادات رقمية معتمدة وموثقة صادرة عن وكالة الفضاء المصرية عند استيفاء متطلبات التخرج.'
            : 'Verifiable digital credentials issued by the Egyptian Space Agency upon successful graduation.'
        }
        breadcrumbs={[
          { label: isAr ? 'بوابة المتدرب' : 'Portal', to: '/student/dashboard' },
          { label: isAr ? 'الشهادة' : 'Certificate' },
        ]}
      />

      {/* Global Alerts */}
      {actionSuccessMsg && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-center mb-4 shadow-sm" role="alert">
          <i className="fa-solid fa-circle-check fs-5 me-2 ms-2 text-success"></i>
          <div>{actionSuccessMsg}</div>
          <button type="button" className="btn-close ms-auto me-0" onClick={() => setActionSuccessMsg('')}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center mb-4 shadow-sm" role="alert">
          <i className="fa-solid fa-triangle-exclamation fs-5 me-2 ms-2 text-danger"></i>
          <div>{error}</div>
          <button type="button" className="btn-close ms-auto me-0" onClick={() => setError('')}></button>
        </div>
      )}

      {/* STATE 5: ISSUED STATE */}
      {isIssued && activeCert && (
        <div className="row g-4">
          <div className="col-12">
            <div
              className="egsa-card p-4 p-md-5 text-center position-relative overflow-hidden border-2 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fbfdfd 100%)',
                borderColor: 'var(--color-accent, #d4b87c)',
                borderRadius: 'var(--radius-lg, 12px)',
              }}
            >
              {/* Decorative top bar */}
              <div
                className="position-absolute top-0 start-0 w-100"
                style={{
                  height: '6px',
                  background: 'linear-gradient(90deg, var(--color-primary, #0f2b48), var(--color-accent, #d4b87c), #2a73b7)',
                }}
              />

              <div className="mb-4">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow-sm"
                  style={{
                    width: '84px',
                    height: '84px',
                    background: 'rgba(212, 184, 124, 0.18)',
                    border: '2px solid var(--color-accent, #d4b87c)',
                  }}
                >
                  <i className="fa-solid fa-award fa-3x text-accent-egsa"></i>
                </div>
                <h6 className="text-uppercase tracking-wider text-muted fw-bold small">
                  {isAr ? 'وكالة الفضاء المصرية — الأكاديمية' : 'Egyptian Space Agency — Space Academy'}
                </h6>
                <h3 className="fw-bold text-dark mt-1">
                  {isAr ? 'شهادة إتمام وتخرج رسمية معتمدة' : 'Official Space Academy Certificate of Completion'}
                </h3>
              </div>

              <p className="text-muted mb-2">{isAr ? 'تشهد وكالة الفضاء المصرية بأن الخريج/ـة:' : 'This is to officially certify that:'}</p>

              {/* Recipient Name */}
              <h2
                className="display-6 fw-bold text-primary-egsa mb-2"
                style={{ fontFamily: 'var(--font-ar), var(--font-en), sans-serif' }}
              >
                {activeCert.recipientName}
              </h2>

              {/* Locked Name Badge */}
              <div className="d-inline-flex align-items-center gap-2 px-3 py-1 bg-light rounded-pill border text-muted small mb-4">
                <i className="fa-solid fa-lock text-success"></i>
                <span>
                  {isAr ? 'الاسم على الشهادة: ' : 'Name on Certificate: '}
                  <strong className="text-dark">{activeCert.recipientName}</strong>
                  {isAr ? ' · معتمد ومقفل رسمياً' : ' · Official certificate issued with the name above'}
                </span>
              </div>

              <p className="text-muted mx-auto mb-4" style={{ maxWidth: '640px' }}>
                {isAr
                  ? 'قد اجتاز بنجاح كافة المتطلبات الأكاديمية والتدريبات المعملية والمحاكاة الفضائية المقررة لبرنامج:'
                  : 'has successfully satisfied all rigorous academic requirements, engineering simulations, and laboratory drills for:'}
              </p>

              <div className="p-3 bg-light rounded d-inline-block px-4 mb-4 border shadow-sm">
                <h4 className="fw-bold text-secondary-egsa mb-1">{activeCourse?.title}</h4>
                <small className="text-muted">{activeCourse?.level || 'Space Academy Professional Track'}</small>
              </div>

              {/* Metadata Details */}
              <div className="row justify-content-center g-4 my-3 text-start small border-top pt-4 text-muted">
                <div className="col-sm-4 text-center">
                  <span className="d-block text-muted mb-1">{isAr ? 'رقم الشهادة المعتمد:' : 'Certificate ID:'}</span>
                  <strong className="text-dark font-monospace fs-6">{activeCert.certificateId || 'EGSA-CERT-OFFICIAL'}</strong>
                </div>
                <div className="col-sm-4 text-center">
                  <span className="d-block text-muted mb-1">{isAr ? 'تاريخ الإصدار:' : 'Issue Date:'}</span>
                  <strong className="text-dark fs-6">
                    {activeCert.issueDate ? new Date(activeCert.issueDate).toLocaleDateString() : 'Issued'}
                  </strong>
                </div>
                <div className="col-sm-4 text-center">
                  <span className="d-block text-muted mb-1">{isAr ? 'رمز التحقق الرقمي:' : 'Verification Token:'}</span>
                  <strong className="text-dark font-monospace fs-6">{activeCert.verificationToken?.slice(0, 16)}…</strong>
                </div>
              </div>

              {/* Actions */}
              <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                {activeCert.fileUrl ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary px-4 py-2 fw-semibold"
                      onClick={() => setViewingCert(activeCert)}
                    >
                      <i className="fa-solid fa-eye me-2 ms-2"></i>
                      {isAr ? 'استعراض الشهادة الرسمية' : 'View Official Certificate'}
                    </button>
                    <a
                      href={`/api/certificates/${activeCert._id}/download`}
                      download
                      className="btn btn-outline-primary px-4 py-2 fw-semibold"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="fa-solid fa-download me-2 ms-2"></i>
                      {isAr ? 'تحميل الشهادة' : 'Download Certificate'}
                    </a>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary px-4 py-2 fw-semibold"
                    onClick={() => window.print()}
                  >
                    <i className="fa-solid fa-print me-2 ms-2"></i>
                    {isAr ? 'طباعة الشهادة' : 'Print Certificate'}
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-outline-secondary px-3 py-2"
                  onClick={() => {
                    navigator.clipboard.writeText(activeCert.verificationToken || activeCert.certificateId);
                    alert(isAr ? 'تم نسخ رمز التحقق الرقمي إلى الحافظة.' : 'Verification token copied to clipboard.');
                  }}
                >
                  <i className="fa-solid fa-copy me-1 ms-1"></i> {isAr ? 'نسخ رمز التحقق' : 'Copy Verification Token'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: UNDER PREPARATION STATE */}
      {/* STATE: CERTIFICATE NAME SUBMITTED */}
      {!isIssued && hasSubmittedName && !isEditingSubmittedName && (
        <div className="row g-4">
          <div className="col-12">
            <div className="egsa-card p-4 p-md-5 text-center shadow-sm border">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 text-success p-3"
                style={{ width: '72px', height: '72px', backgroundColor: 'rgba(16, 185, 129, 0.12)' }}
              >
                <i className="fa-solid fa-circle-check fa-2x text-success"></i>
              </div>
              <h3 className="fw-bold text-dark mb-3">
                {isAr ? 'تم إرسال اسم الشهادة' : 'Certificate Name Submitted'}
              </h3>

              <div className="p-3 my-3 bg-light rounded d-inline-block px-5 border shadow-sm">
                <h2
                  className="fw-bold text-primary-egsa mb-0"
                  style={{ fontFamily: 'var(--font-ar), var(--font-en), sans-serif' }}
                >
                  {submittedCertificateName}
                </h2>
              </div>

              <p className="text-muted fs-5 mx-auto mb-4" style={{ maxWidth: '640px' }}>
                {isAr
                  ? 'تم إرسال اسم الشهادة الخاص بك إلى الإدارة وسيتم استخدامه عند إعداد شهادتك.'
                  : 'Your certificate name has been submitted to the administration and will be used when preparing your certificate.'}
              </p>

              <div>
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4 py-2"
                  onClick={() => {
                    setRecipientName(submittedCertificateName);
                    setIsEditingSubmittedName(true);
                  }}
                >
                  <i className="fa-solid fa-pen-to-square me-2 ms-2"></i>
                  {isAr ? 'تعديل' : 'Edit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE: CERTIFICATE NAME INPUT FORM */}
      {!isIssued && (!hasSubmittedName || isEditingSubmittedName) && isEligible && (
        <div className="row g-4">
          <div className="col-lg-8">
            <div
              className="egsa-card p-4 p-md-5 mb-4 shadow-sm border"
              style={{
                borderTop: '4px solid var(--color-primary, #0f2b48)',
                borderRadius: 'var(--radius-md, 8px)',
              }}
            >
              <div className="d-flex align-items-center gap-3 mb-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-primary-egsa"
                  style={{ width: '48px', height: '48px', backgroundColor: 'rgba(15, 43, 72, 0.08)' }}
                >
                  <i className="fa-solid fa-id-card-clip fa-xl"></i>
                </div>
                <div>
                  <h3 className="fw-bold text-dark mb-1">
                    {isAr ? 'اسم الشهادة' : 'Certificate Name'}
                  </h3>
                  <p className="text-muted mb-0">
                    {isAr
                      ? 'أدخل اسمك الكامل تماماً كما تريد أن يظهر على شهادتك.'
                      : 'Enter your full name exactly as you want it to appear on your certificate.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitCertificateName} className="mt-4">
                <div className="mb-4">
                  <label htmlFor="certificateFullNameInput" className="form-label fw-bold text-dark">
                    {isAr ? 'الاسم الكامل' : 'Full Name'} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="certificateFullNameInput"
                    className={`form-control form-control-lg ${nameError ? 'is-invalid' : ''}`}
                    placeholder={isAr ? 'الاسم الكامل' : 'Full Name'}
                    value={recipientName}
                    onChange={handleNameChange}
                    style={{ fontSize: '1.15rem', fontWeight: '500' }}
                    autoComplete="name"
                    disabled={isSubmitting}
                  />
                  {nameError ? (
                    <div className="invalid-feedback d-block mt-2">
                      <i className="fa-solid fa-circle-exclamation me-1 ms-1"></i> {nameError}
                    </div>
                  ) : (
                    <div className="form-text mt-2 text-muted small">
                      <i className="fa-solid fa-circle-info me-1 ms-1 text-primary-egsa"></i>
                      {isAr
                        ? 'تم استخدام اسم ملفك الشخصي كقيمة أولية ملائمة. يمكنك تعديل الاسم قبل الإرسال.'
                        : 'Uses your existing profile name as a convenient initial value if available. You can edit it before submitting.'}
                    </div>
                  )}
                </div>

                <div className="d-flex justify-content-between align-items-center">
                  {isEditingSubmittedName && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setRecipientName(submittedCertificateName);
                        setIsEditingSubmittedName(false);
                        setNameError('');
                      }}
                      disabled={isSubmitting}
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary px-4 py-2 fw-semibold ms-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin me-2 ms-2"></i>
                        {isAr ? 'جاري الإرسال…' : 'Submitting…'}
                      </>
                    ) : (
                      isAr ? 'إرسال' : 'Submit'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-circle-info text-primary-egsa me-2 ms-2"></i>
                {isAr ? 'تعليمات اسم الشهادة' : 'Certificate Name Guidelines'}
              </h6>
              <ul className="small text-muted mb-0 d-flex flex-column gap-2 ps-3 pe-3">
                <li>
                  {isAr
                    ? 'يُسمح بكتابة الاسم باللغة العربية أو الإنجليزية.'
                    : 'Arabic and English names are supported.'}
                </li>
                <li>
                  {isAr
                    ? 'اكتب اسمك كاملاً كما ترغب في اعتماده على الوثيقة الرسمية.'
                    : 'Write your complete full name as it should appear.'}
                </li>
                <li>
                  {isAr
                    ? 'سيتم استخدام هذا الاسم من قِبل إدارة الأكاديمية عند تجهيز ورفع شهادتك.'
                    : 'This submitted name will be available to the Admin when preparing your certificate.'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}


      {/* STATE 1: BEFORE COURSE COMPLETION / NOT ELIGIBLE */}
      {!isEligible && (
        <div className="row g-4">
          <div className="col-12">
            <div
              className="alert p-4 mb-2 border shadow-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md, 8px)',
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center bg-danger text-white shadow-sm"
                  style={{ width: '48px', height: '48px', flexShrink: 0 }}
                >
                  <i className="fa-solid fa-lock fa-xl"></i>
                </div>
                <div>
                  <h5 className="fw-bold text-danger mb-1">
                    {isAr ? 'الشهادة ستكون متاحة بعد إتمام الدورة' : 'Your certificate will become available after you complete the course.'}
                  </h5>
                  <p className="small text-muted mb-0">
                    {isAr
                      ? 'يرجى استيفاء كافة المتطلبات التدريبية والأكاديمية ونسب الحضور والتقييمات المقررة لتصبح مؤهلاً للحصول على الشهادة.'
                      : 'Complete the required training, attendance requirements (≥85%), milestone assessments, and evaluation to become eligible.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="egsa-card p-4 mb-4">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                <div>
                  <h5 className="fw-bold text-dark mb-1">
                    {isAr ? 'مؤشر استيفاء متطلبات التخرج' : 'Certification Eligibility Tracker'}
                  </h5>
                  <p className="text-muted small mb-0">
                    {isAr
                      ? `تم استيفاء ${criteria?.completedCount || 0} من ${criteria?.totalCount || 5} متطلبات مقررة`
                      : `${criteria?.completedCount || 0} of ${criteria?.totalCount || 5} completion requirements satisfied`}
                  </p>
                </div>
                <div style={{ minWidth: '150px' }}>
                  <ProgressBar percent={criteria?.progressPercent || 0} showLabel />
                </div>
              </div>

              <hr />

              <div className="d-flex flex-column gap-3 mt-3">
                {criteria?.items?.map((item) => {
                  const isAttendance = item.id === 'attendance';
                  const isFailed = !item.met && (item.certificateEligibility === 'INELIGIBLE' || item.warningState === 'CERTIFICATE_INELIGIBLE');
                  const isAtRisk = !item.met && item.certificateEligibility === 'AT_RISK';

                  let statusBadge = (
                    <span
                      className={`badge ${
                        item.met ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-light text-muted border'
                      } small`}
                    >
                      {item.met
                        ? isAr
                          ? 'مستوفى'
                          : 'Requirement Met'
                        : isAr
                        ? 'قيد الانتظار'
                        : 'Pending'}
                    </span>
                  );

                  if (isFailed) {
                    statusBadge = (
                      <span className="badge bg-danger text-white small">
                        <i className="fa-solid fa-xmark me-1 ms-1"></i> {isAr ? 'غير مستوفى · غير مؤهل' : 'Not Satisfied · Ineligible'}
                      </span>
                    );
                  } else if (isAtRisk) {
                    statusBadge = (
                      <span className="badge bg-warning text-dark small">
                        <i className="fa-solid fa-triangle-exclamation me-1 ms-1"></i> {isAr ? 'في دائرة الخطر' : 'At Risk'}
                      </span>
                    );
                  }

                  let iconClass = 'bg-secondary opacity-50';
                  let icon = 'fa-minus';
                  if (item.met) {
                    iconClass = 'bg-success';
                    icon = 'fa-check';
                  } else if (isFailed) {
                    iconClass = 'bg-danger';
                    icon = 'fa-xmark';
                  } else if (isAtRisk) {
                    iconClass = 'bg-warning text-dark';
                    icon = 'fa-triangle-exclamation';
                  }

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded border d-flex align-items-start gap-3 ${
                        item.met
                          ? 'bg-light border-success-subtle'
                          : isFailed
                          ? 'bg-danger-subtle border-danger'
                          : isAtRisk
                          ? 'bg-warning-subtle border-warning'
                          : 'bg-white'
                      }`}
                    >
                      <span
                        className={`rounded-circle d-flex align-items-center justify-content-center text-white mt-1 ${iconClass}`}
                        style={{ width: '28px', height: '28px', flexShrink: 0 }}
                      >
                        <i className={`fa-solid ${icon} small`}></i>
                      </span>

                      <div className="flex-grow-1">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-1">
                          <strong className={isFailed ? 'text-danger' : item.met ? 'text-dark' : 'text-muted'}>
                            {item.label}
                          </strong>
                          {statusBadge}
                        </div>
                        <p className={`small mb-0 mt-1 ${isFailed ? 'text-danger-emphasis' : 'text-muted'}`}>
                          {item.description}
                        </p>
                        {isFailed && isAttendance && (
                          <div className="mt-2 p-2 bg-white rounded border border-danger-subtle small text-danger">
                            <i className="fa-solid fa-circle-exclamation me-1 ms-1"></i>
                            <strong>{isAr ? 'الأثر الأكاديمي: ' : 'Consequence: '}</strong>{' '}
                            {isAr
                              ? 'إصدار الشهادة محجوب حالياً بسبب تجاوز نسبة الغياب المسموح بها.'
                              : 'Certificate issuance is currently blocked due to attendance threshold violation.'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-graduation-cap text-primary-egsa me-2 ms-2"></i>
                {isAr ? 'معايير الاعتماد والتخرج' : 'Certification Standards'}
              </h6>
              <p className="text-muted small mb-3">
                {isAr
                  ? 'شهادات وكالة الفضاء المصرية معتمدة وتتطلب استيفاء المعايير التالية:'
                  : 'EGSA Academy certificates require satisfaction of institutional benchmarks:'}
              </p>
              <ul className="small text-muted mb-4 d-flex flex-column gap-2 ps-3 pe-3">
                <li>
                  <strong>{isAr ? 'سداد الرسوم:' : 'Tuition Settlement:'}</strong>{' '}
                  {isAr ? 'سداد رسوم التدريب كاملة قبل بدء الدورة.' : 'Invoices must be cleared before course start.'}
                </li>
                <li>
                  <strong>{isAr ? 'نسبة الحضور:' : 'Attendance:'}</strong>{' '}
                  {isAr ? 'حضور ما لا يقل عن ٨٥٪ من المحاضرات والتدريبات.' : '≥85% Cohort Attendance across lectures and labs.'}
                </li>
                <li>
                  <strong>{isAr ? 'التقييم والامتحانات:' : 'Assessments:'}</strong>{' '}
                  {isAr ? 'اجتياز المشروع العملي والاختبارات المقررة.' : 'Minimum 70% passing threshold in capstone & practicals.'}
                </li>
                <li>
                  <strong>{isAr ? 'استبيان التدريب:' : 'Student Evaluation:'}</strong>{' '}
                  {isAr ? 'تسليم استبيان تقييم الدورة قبل مراجعة المجلس.' : 'Official student evaluation submitted prior to board review.'}
                </li>
              </ul>

              <div className="d-grid gap-2">
                <Link to="/student/evaluation" className="btn btn-outline-primary btn-sm">
                  <i className="fa-solid fa-star-half-stroke me-1 ms-1"></i>{' '}
                  {isAr ? 'إكمال تقييم الدورة والمدرب' : 'Complete Course Evaluation'}
                </Link>
                <Link to="/student/attendance" className="btn btn-outline-secondary btn-sm">
                  <i className="fa-solid fa-calendar-check me-1 ms-1"></i>{' '}
                  {isAr ? 'مراجعة سجلات الحضور' : 'Review Attendance Records'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* DOCUMENT VIEWER MODAL */}
      {viewingCert && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-lg, 12px)' }}>
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="fa-solid fa-certificate text-primary-egsa"></i>
                  {isAr ? 'استعراض الشهادة الرسمية' : 'Official Certificate Document'} — {viewingCert.recipientName}
                </h5>
                <button type="button" className="btn-close" onClick={() => setViewingCert(null)}></button>
              </div>
              <div className="modal-body p-0 bg-dark text-center" style={{ minHeight: '500px' }}>
                {viewingCert.fileMimeType?.includes('pdf') || viewingCert.fileUrl?.endsWith('.pdf') ? (
                  <iframe
                    src={viewingCert.fileUrl}
                    title="Certificate Document Preview"
                    width="100%"
                    height="650px"
                    style={{ border: 'none' }}
                  />
                ) : (
                  <div className="p-4">
                    <img
                      src={viewingCert.fileUrl}
                      alt={`Certificate for ${viewingCert.recipientName}`}
                      className="img-fluid rounded shadow"
                      style={{ maxHeight: '650px', objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light d-flex justify-content-between">
                <div>
                  <span className="text-muted small">
                    {isAr ? 'رقم الشهادة: ' : 'Certificate ID: '}
                    <strong className="text-dark font-monospace">{viewingCert.certificateId || 'Official'}</strong>
                  </span>
                </div>
                <div className="d-flex gap-2">
                  <a
                    href={`/api/certificates/${viewingCert._id}/download`}
                    download
                    className="btn btn-primary btn-sm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="fa-solid fa-download me-1 ms-1"></i>
                    {isAr ? 'تحميل الوثيقة' : 'Download File'}
                  </a>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setViewingCert(null)}>
                    {isAr ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
