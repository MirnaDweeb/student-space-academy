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

    setIsSubmitting(true);
    setError('');

    try {
      const cleanName = recipientName.trim().replace(/\s+/g, ' ');
      const targetEnrollmentId = data?.eligibleEnrollment?._id || data?.enrollment?._id;

      const res = await certificateService.submitName({
        enrollmentId: targetEnrollmentId,
        recipientName: cleanName,
        certificateName: cleanName,
      });

      const serverMsg =
        res?.message ||
        (isAr
          ? 'تم إرسال اسم الشهادة بنجاح. يرجى إكمال استبيانات التقييم المطلوبة لمتابعة الإجراءات.'
          : 'Your certificate name has been submitted successfully. Please complete the required feedback forms.');

      setActionSuccessMsg(serverMsg);
      setIsEditingSubmittedName(false);
      await load();
    } catch (apiErr) {
      setError(
        apiErr.response?.data?.message ||
          apiErr.message ||
          (isAr ? 'حدث خطأ أثناء إرسال طلب الشهادة. يرجى المحاولة لاحقاً.' : 'Failed to submit certificate request.')
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

  const { certificates = [], criteria, eligibleEnrollment, enrollment } = data || {};
  const activeCert = certificates?.[0] || null;
  const activeCourse = activeCert?.course || eligibleEnrollment?.course || enrollment?.course;

  const submittedCertificateName = activeCert?.certificateName || activeCert?.recipientName || '';
  const hasSubmittedName = Boolean(submittedCertificateName);

  const isCourseDone = Boolean(activeCert?.courseFeedbackCompleted ?? data?.courseFeedbackCompleted);
  const isAgencyDone = Boolean(activeCert?.agencyFeedbackCompleted ?? data?.agencyFeedbackCompleted);
  const isFeedbackDone = Boolean(activeCert?.feedbackCompleted ?? data?.feedbackCompleted ?? (isCourseDone && isAgencyDone));

  const isAdminCreated = Boolean(activeCert?.adminCreated || activeCert?.status === 'UNDER_PREPARATION' || activeCert?.status === 'ISSUED');
  const hasUploadedFile = Boolean(activeCert?.fileUrl);
  const isIssued = Boolean((activeCert?.status === 'ISSUED' || hasUploadedFile) && hasUploadedFile);

  const isDeadlinePassed = Boolean(activeCert?.isDeadlinePassed ?? data?.isDeadlinePassed);
  const canReceiveCertificate = Boolean(activeCert?.canReceiveCertificate ?? data?.canReceiveCertificate);

  // Eligible to request certificate
  const isEligible =
    data?.isEligibleToRequest ||
    data?.isEligibleForIssuance ||
    !!activeCert ||
    (data?.eligibleEnrollments && data.eligibleEnrollments.length > 0);

  // Determine current active workflow state
  let resolvedState = 'STATE_1_NAME_NOT_SUBMITTED';
  if (isDeadlinePassed && !isFeedbackDone) {
    resolvedState = 'STATE_DEADLINE_PASSED';
  } else if (!hasSubmittedName || isEditingSubmittedName) {
    resolvedState = 'STATE_1_NAME_NOT_SUBMITTED';
  } else if (!isFeedbackDone) {
    resolvedState = 'STATE_2_FEEDBACK_INCOMPLETE';
  } else if (isFeedbackDone && !isAdminCreated) {
    resolvedState = 'STATE_3_PENDING_ADMIN_CREATION';
  } else if (isFeedbackDone && isAdminCreated && (!isIssued || !canReceiveCertificate)) {
    resolvedState = 'STATE_4_PENDING_RELEASE';
  } else if (canReceiveCertificate && isIssued) {
    resolvedState = 'STATE_5_CERTIFICATE_READY';
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader
        title={isAr ? 'الشهادات والاعتمادات الرسمية' : 'Official Certificates & Credentials'}
        subtitle={
          isAr
            ? 'اعتمادات رقمية معتمدة وموثقة صادرة عن وكالة الفضاء المصرية عند استيفاء متطلبات التخرج والتقييم.'
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

      {/* WORKFLOW STEPPER (Section 20 Recommended Structure) */}
      {isEligible && (
        <div className="egsa-card p-3 p-md-4 mb-4 shadow-sm border bg-white">
          <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
            <i className="fa-solid fa-route text-primary-egsa"></i>
            {isAr ? 'مراحل إصدار الشهادة' : 'Certificate Issuance Workflow'}
          </h6>

          <div className="row g-2 text-center small">
            {/* Step 1: Submit Name */}
            <div className="col-6 col-md-3">
              <div className={`p-2 rounded border h-100 ${hasSubmittedName ? 'bg-light border-success-subtle text-success' : 'bg-primary-subtle text-primary border-primary'}`}>
                <div className="fw-bold mb-1">
                  {hasSubmittedName ? <i className="fa-solid fa-circle-check text-success me-1"></i> : <i className="fa-regular fa-circle text-primary me-1"></i>}
                  1. {isAr ? 'إدخال اسم الشهادة' : 'Submit Your Name'}
                </div>
                <span className="badge bg-white text-dark border">
                  {hasSubmittedName ? (isAr ? 'مكتمل ✓' : 'Completed ✓') : (isAr ? 'مطلوب الآن' : 'In Progress')}
                </span>
              </div>
            </div>

            {/* Step 2: Complete Feedback */}
            <div className="col-6 col-md-3">
              <div className={`p-2 rounded border h-100 ${isFeedbackDone ? 'bg-light border-success-subtle text-success' : hasSubmittedName ? 'bg-warning-subtle text-dark border-warning' : 'bg-light text-muted'}`}>
                <div className="fw-bold mb-1">
                  {isFeedbackDone ? <i className="fa-solid fa-circle-check text-success me-1"></i> : <i className="fa-solid fa-circle-dot text-warning me-1"></i>}
                  2. {isAr ? 'استبيانات التقييم' : 'Complete Feedback'}
                </div>
                <div className="d-flex justify-content-center gap-1 mt-1">
                  <span className={`badge ${isCourseDone ? 'bg-success text-white' : 'bg-secondary-subtle text-dark'}`} style={{ fontSize: '0.68rem' }}>
                    {isCourseDone ? '✓' : '●'} {isAr ? 'الدورة' : 'Course'}
                  </span>
                  <span className={`badge ${isAgencyDone ? 'bg-success text-white' : 'bg-secondary-subtle text-dark'}`} style={{ fontSize: '0.68rem' }}>
                    {isAgencyDone ? '✓' : '●'} {isAr ? 'الوكالة' : 'Agency'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Admin Creates Certificate */}
            <div className="col-6 col-md-3">
              <div className={`p-2 rounded border h-100 ${isAdminCreated ? 'bg-light border-success-subtle text-success' : 'bg-light text-muted'}`}>
                <div className="fw-bold mb-1">
                  {isAdminCreated ? <i className="fa-solid fa-circle-check text-success me-1"></i> : <i className="fa-regular fa-circle text-muted me-1"></i>}
                  3. {isAr ? 'إعداد الوثيقة إدارياً' : 'Admin Creates Certificate'}
                </div>
                <span className="badge bg-white text-muted border">
                  {isAdminCreated ? (isAr ? 'تم الإنشاء الإداري ✓' : 'Created ✓') : (isAr ? 'قيد الانتظار' : 'Pending')}
                </span>
              </div>
            </div>

            {/* Step 4: Receive Certificate */}
            <div className="col-6 col-md-3">
              <div className={`p-2 rounded border h-100 ${canReceiveCertificate && isIssued ? 'bg-success-subtle border-success text-success' : 'bg-light text-muted'}`}>
                <div className="fw-bold mb-1">
                  {canReceiveCertificate && isIssued ? <i className="fa-solid fa-award text-success me-1"></i> : <i className="fa-solid fa-lock text-muted me-1"></i>}
                  4. {isAr ? 'استلام الشهادة' : 'Receive Certificate'}
                </div>
                <span className={`badge ${canReceiveCertificate && isIssued ? 'bg-success text-white' : 'bg-light text-muted border'}`}>
                  {canReceiveCertificate && isIssued ? (isAr ? 'جاهزة للتحميل ✓' : 'Ready ✓') : (isAr ? 'مقفل حتى استيفاء الشروط' : 'Locked')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CASE 6 / DEADLINE PASSED STATE (Section 14) */}
      {resolvedState === 'STATE_DEADLINE_PASSED' && (
        <div className="row g-4">
          <div className="col-12">
            <div className="egsa-card p-4 p-md-5 text-center shadow-sm border border-danger">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 p-3 bg-danger-subtle text-danger"
                style={{ width: '72px', height: '72px' }}
              >
                <i className="fa-solid fa-calendar-xmark fa-2x"></i>
              </div>

              <h3 className="fw-bold text-danger mb-2">
                {isAr ? 'انتهت المهلة المحددة لتقديم التقييم' : 'Feedback Deadline Passed'}
              </h3>

              <div className="alert alert-danger mx-auto my-3 text-start" style={{ maxWidth: '640px' }}>
                <p className="mb-2 fw-semibold">
                  {isAr
                    ? 'لم يتم إكمال استبيانات التقييم المطلوبة خلال الفترة المسموح بها.'
                    : 'The required feedback was not completed within the allowed period.'}
                </p>
                <p className="mb-2">
                  {isAr
                    ? 'لا يمكن إصدار الشهادة في الوقت الحالي وفقاً لسياسات الاعتماد الأكاديمي.'
                    : 'Your certificate cannot be issued at this time according to certification policy.'}
                </p>
                <p className="mb-0 text-muted small">
                  {isAr
                    ? 'يرجى التواصل مع إدارة الشؤون الأكاديمية بوكالة الفضاء المصرية إذا كنت تعتقد أن هذا ناتج عن خطأ.'
                    : 'Please contact Academic Affairs if you believe this is an error.'}
                </p>
              </div>

              <div className="mt-4">
                <a href="mailto:academic@egsa.gov.eg" className="btn btn-outline-danger px-4 py-2">
                  <i className="fa-solid fa-headset me-2 ms-2"></i>
                  {isAr ? 'مراسلة الشؤون الأكاديمية' : 'Contact Academic Affairs'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 1: NAME NOT SUBMITTED (Section 1 & 9) */}
      {resolvedState === 'STATE_1_NAME_NOT_SUBMITTED' && isEligible && (
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
                    {isAr ? 'طلب الشهادة' : 'Certificate Request'}
                  </h3>
                  <p className="text-muted mb-0">
                    {isAr
                      ? 'أدخل اسمك كاملاً كما ترغب أن يُطبع تماماً على شهادتك الرسمية.'
                      : 'Enter your name exactly as you want it printed on your certificate.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitCertificateName} className="mt-4">
                <div className="mb-4">
                  <label htmlFor="certificateFullNameInput" className="form-label fw-bold text-dark">
                    {isAr ? 'الاسم الكامل للشهادة' : 'Certificate Name'} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="certificateFullNameInput"
                    className={`form-control form-control-lg ${nameError ? 'is-invalid' : ''}`}
                    placeholder={isAr ? 'الاسم الكامل كما تريد طباعته' : 'Enter your full certificate name'}
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
                        ? 'أدخل الاسم الثلاثي أو الرباعي بدقة. سيتم استخدام هذا الاسم من قبل الإدارة لإعداد الشهادة.'
                        : 'Enter your full name accurately. The administration will use this exact name to prepare your certificate.'}
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
                      isAr ? 'إرسال الاسم' : 'Submit Name'
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
                {isAr ? 'إرشادات الاسم والاعتماد' : 'Certificate Name Guidelines'}
              </h6>
              <ul className="small text-muted mb-0 d-flex flex-column gap-2 ps-3 pe-3">
                <li>
                  {isAr
                    ? 'يُسمح بكتابة الاسم باللغة العربية أو الإنجليزية.'
                    : 'Arabic and English names are supported.'}
                </li>
                <li>
                  {isAr
                    ? 'لا يُنشئ الطالب الشهادة بنفسه؛ الإدارة هي المسؤولة عن إصدارها.'
                    : 'Students do not create certificates. The Administration prepares and issues the certificate.'}
                </li>
                <li>
                  {isAr
                    ? 'قبل استلام الشهادة، يلزم إكمال استبياني تقييم الدورة وتقييم الوكالة.'
                    : 'Before you can receive your certificate, you must complete both Course and Agency feedback.'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* STATE 2: NAME SUBMITTED, FEEDBACK INCOMPLETE (Section 4, 5, 6, 9) */}
      {resolvedState === 'STATE_2_FEEDBACK_INCOMPLETE' && (
        <div className="row g-4">
          <div className="col-12">
            <div className="egsa-card p-4 p-md-5 text-center shadow-sm border">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 p-3"
                style={{ width: '72px', height: '72px', backgroundColor: 'rgba(234, 179, 8, 0.12)' }}
              >
                <i className="fa-solid fa-clipboard-check fa-2x text-warning"></i>
              </div>

              <h2 className="fw-bold text-dark mb-1">
                {isAr ? 'شكراً لك' : 'Thank You'}
              </h2>
              <h4 className="fw-semibold text-muted mb-3">
                {isAr ? 'تم إرسال اسم الشهادة بنجاح.' : 'Your certificate name has been submitted successfully.'}
              </h4>

              {/* Submitted Name Box (Section 4) */}
              <div className="p-3 my-2 bg-light rounded d-inline-block px-5 border shadow-sm">
                <small className="text-muted d-block mb-1">{isAr ? 'اسمك المسجل للشهادة:' : 'Your submitted name:'}</small>
                <h2
                  className="fw-bold text-primary-egsa mb-0"
                  style={{ fontFamily: 'var(--font-ar), var(--font-en), sans-serif' }}
                >
                  "{submittedCertificateName}"
                </h2>
              </div>

              <p className="text-muted mt-3 mx-auto" style={{ maxWidth: '640px' }}>
                {isAr
                  ? 'تم إرسال طلب شهادتك إلى الشؤون الأكاديمية / إدارة الأكاديمية. سيتم إعداد الشهادة من قبل الإدارة.'
                  : 'Your certificate request has been sent to Academic Affairs / Administration. The certificate will be created by the Admin.'}
              </p>

              {/* Section 5 Mandatory Feedback Checklist */}
              <div
                className="alert p-4 my-4 mx-auto text-start border shadow-sm"
                style={{ maxWidth: '680px', backgroundColor: 'rgba(15, 43, 72, 0.03)', borderColor: 'rgba(15, 43, 72, 0.15)' }}
              >
                <h6 className="fw-bold text-dark mb-2">
                  {isAr ? 'لاستلام شهادتك، يجب عليك إكمال:' : 'To receive your certificate, you must complete:'}
                </h6>

                <div className="d-flex flex-column gap-2 mb-3 mt-2">
                  <div className="d-flex align-items-center justify-content-between p-2 rounded bg-white border">
                    <span className="fw-semibold small">
                      {isCourseDone ? '✓ ' : '⚠ '}
                      {isAr ? 'تقييم الدورة والمدرب' : 'Course Feedback'}
                    </span>
                    <span className={`badge ${isCourseDone ? 'bg-success text-white' : 'bg-warning text-dark'}`}>
                      {isCourseDone ? (isAr ? 'مكتمل' : 'Completed') : (isAr ? 'غير مكتمل' : 'Not Completed')}
                    </span>
                  </div>

                  <div className="d-flex align-items-center justify-content-between p-2 rounded bg-white border">
                    <span className="fw-semibold small">
                      {isAgencyDone ? '✓ ' : '⚠ '}
                      {isAr ? 'تقييم وكالة الفضاء المصرية' : 'Egyptian Space Agency / Agency Feedback'}
                    </span>
                    <span className={`badge ${isAgencyDone ? 'bg-success text-white' : 'bg-warning text-dark'}`}>
                      {isAgencyDone ? (isAr ? 'مكتمل' : 'Completed') : (isAr ? 'غير مكتمل' : 'Not Completed')}
                    </span>
                  </div>
                </div>

                <div className="small text-danger-emphasis border-top pt-2 mt-2">
                  <i className="fa-solid fa-clock me-1 ms-1"></i>
                  <strong>{isAr ? 'تنبيه الموعد النهائي: ' : 'Deadline Notice: '}</strong>
                  {isAr
                    ? 'يرجى إكمال استبيانات التقييم المطلوبة في الوقت المحدد. إذا لم يتم إكمال التقييم المطلوب خلال الفترة المحددة، فلن يتم تسليم أو إصدار الشهادة.'
                    : 'Please complete the required feedback forms on time. If the required feedback is not completed within the specified period, the certificate will not be issued/delivered.'}
                </div>
              </div>

              {/* Action Buttons (Section 6) */}
              <div className="d-flex flex-wrap justify-content-center gap-3">
                <Link
                  to={`/student/evaluation?courseId=${activeCourse?._id || ''}`}
                  className="btn btn-primary px-4 py-2 fw-semibold shadow-sm"
                >
                  <i className="fa-solid fa-star-half-stroke me-2 ms-2"></i>
                  {isAr ? 'إكمال التقييم المطلوب' : 'Complete Feedback'}
                </Link>

                <button
                  type="button"
                  className="btn btn-outline-secondary px-4 py-2"
                  onClick={() => {
                    setRecipientName(submittedCertificateName);
                    setIsEditingSubmittedName(true);
                  }}
                >
                  <i className="fa-solid fa-pen-to-square me-2 ms-2"></i>
                  {isAr ? 'تعديل الاسم' : 'Edit Name'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 3: FEEDBACK COMPLETED, ADMIN HAS NOT CREATED CERTIFICATE YET (Section 9) */}
      {resolvedState === 'STATE_3_PENDING_ADMIN_CREATION' && (
        <div className="row g-4">
          <div className="col-12">
            <div className="egsa-card p-4 p-md-5 text-center shadow-sm border">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 p-3 bg-info-subtle text-info-emphasis"
                style={{ width: '72px', height: '72px' }}
              >
                <i className="fa-solid fa-clipboard-check fa-2x text-primary-egsa"></i>
              </div>

              <h2 className="fw-bold text-dark mb-2">
                {isAr ? 'تم إكمال التقييم المطلوب' : 'Feedback Completed'}
              </h2>

              <p className="text-muted fs-6 mx-auto mb-3" style={{ maxWidth: '640px' }}>
                {isAr
                  ? 'شكراً لك على إكمال استبيانات التقييم المطلوبة.'
                  : 'Thank you for completing the required feedback.'}
              </p>

              <div className="p-3 my-2 bg-light rounded d-inline-block px-5 border shadow-sm">
                <small className="text-muted d-block mb-1">{isAr ? 'الاسم المعتمد للشهادة:' : 'Name on Certificate:'}</small>
                <h3 className="fw-bold text-primary-egsa mb-0">"{submittedCertificateName}"</h3>
              </div>

              <p className="text-muted fs-6 mx-auto mt-3 mb-4" style={{ maxWidth: '640px' }}>
                {isAr
                  ? 'طلب شهادتك الآن بانتظار الإنشاء والاعتماد من قبل الشؤون الأكاديمية / إدارة الأكاديمية.'
                  : 'Your certificate is now awaiting creation by Academic Affairs / Administration.'}
              </p>

              <div className="alert alert-light border d-inline-block px-4 py-2 text-muted">
                <strong>{isAr ? 'الحالة: ' : 'Status: '}</strong>
                <span className="badge bg-warning-subtle text-dark border ms-1 me-1">
                  {isAr ? 'بانتظار إنشاء الشهادة إدارياً' : 'Pending Certificate Creation'}
                </span>
              </div>

              <div className="d-flex justify-content-center gap-2 mt-4">
                <Link to="/student/evaluation" className="btn btn-outline-secondary btn-sm">
                  <i className="fa-solid fa-eye me-1 ms-1"></i>
                  {isAr ? 'استعراض التقييم المقدم' : 'View Submitted Feedback'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: ADMIN CREATED CERTIFICATE, BUT NOT RELEASED/AVAILABLE (Section 9) */}
      {resolvedState === 'STATE_4_PENDING_RELEASE' && (
        <div className="row g-4">
          <div className="col-12">
            <div className="egsa-card p-4 p-md-5 text-center shadow-sm border">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 p-3 bg-primary-subtle text-primary-egsa"
                style={{ width: '72px', height: '72px' }}
              >
                <i className="fa-solid fa-stamp fa-2x"></i>
              </div>

              <h2 className="fw-bold text-dark mb-2">
                {isAr ? 'تم إنشاء الشهادة' : 'Certificate Created'}
              </h2>

              <p className="text-muted fs-6 mx-auto mb-3" style={{ maxWidth: '640px' }}>
                {isAr
                  ? 'تم إنشاء الشهادة الخاصة بك من قبل إدارة الأكاديمية وهي الآن قيد المراجعة النهائية والإطلاق.'
                  : 'Your certificate has been created by the Administration.'}
              </p>

              <div className="p-3 my-2 bg-light rounded d-inline-block px-5 border shadow-sm">
                <small className="text-muted d-block mb-1">{isAr ? 'الاسم على الشهادة:' : 'Name on Certificate:'}</small>
                <h3 className="fw-bold text-primary-egsa mb-0">"{submittedCertificateName}"</h3>
              </div>

              <div className="mt-4">
                <div className="alert alert-light border d-inline-block px-4 py-2 text-muted">
                  <strong>{isAr ? 'الحالة: ' : 'Status: '}</strong>
                  <span className="badge bg-info-subtle text-info-emphasis border ms-1 me-1">
                    {isAr ? 'قيد الإطلاق الرسمي' : 'Pending Release'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 5: CERTIFICATE READY / AVAILABLE (Section 9) */}
      {resolvedState === 'STATE_5_CERTIFICATE_READY' && activeCert && (
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
                <h2 className="fw-bold text-dark mt-1">
                  {isAr ? 'الشهادة جاهزة' : 'Certificate Ready'}
                </h2>
                <p className="text-success fw-semibold">
                  {isAr ? 'شهادتك الرسمية المعتمدة جاهزة للاستعراض والتحميل.' : 'Your certificate is ready.'}
                </p>
              </div>

              <p className="text-muted mb-2">{isAr ? 'تشهد وكالة الفضاء المصرية بأن الخريج/ـة:' : 'This is to officially certify that:'}</p>

              {/* Recipient Name */}
              <h2
                className="display-6 fw-bold text-primary-egsa mb-2"
                style={{ fontFamily: 'var(--font-ar), var(--font-en), sans-serif' }}
              >
                {activeCert.recipientName || submittedCertificateName}
              </h2>

              {/* Locked Name Badge */}
              <div className="d-inline-flex align-items-center gap-2 px-3 py-1 bg-light rounded-pill border text-muted small mb-4">
                <i className="fa-solid fa-lock text-success"></i>
                <span>
                  {isAr ? 'الاسم المعتمد: ' : 'Name on Certificate: '}
                  <strong className="text-dark">{activeCert.recipientName || submittedCertificateName}</strong>
                </span>
              </div>

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

              {/* Actions: View Certificate & Download Certificate */}
              <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                {activeCert.fileUrl ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary px-4 py-2 fw-semibold shadow-sm"
                      onClick={() => setViewingCert(activeCert)}
                    >
                      <i className="fa-solid fa-eye me-2 ms-2"></i>
                      {isAr ? 'استعراض الشهادة' : 'View Certificate'}
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

      {/* STATE 0: BEFORE COURSE COMPLETION / NOT ELIGIBLE */}
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
                    {isAr ? 'الشهادة ستكون متاحة بعد إتمام متطلبات الدورة' : 'Your certificate will become available after you complete the course.'}
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
                {criteria?.items?.map((item) => (
                  <div key={item.id} className="p-3 rounded border d-flex align-items-start gap-3 bg-white">
                    <span className={`rounded-circle d-flex align-items-center justify-content-center text-white mt-1 ${item.met ? 'bg-success' : 'bg-secondary opacity-50'}`} style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                      <i className={`fa-solid ${item.met ? 'fa-check' : 'fa-minus'} small`}></i>
                    </span>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-center">
                        <strong className="text-dark">{item.label}</strong>
                        <span className={`badge ${item.met ? 'bg-success-subtle text-success' : 'bg-light text-muted border'} small`}>
                          {item.met ? (isAr ? 'مستوفى' : 'Met') : (isAr ? 'قيد الانتظار' : 'Pending')}
                        </span>
                      </div>
                      <p className="small text-muted mb-0 mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
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
                  <strong>{isAr ? 'استبيانات التقييم:' : 'Mandatory Feedback:'}</strong>{' '}
                  {isAr ? 'تسليم استبياني تقييم الدورة وتقييم الوكالة.' : 'Both Course and Agency feedback submitted.'}
                </li>
              </ul>
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
