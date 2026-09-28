import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentService, applicationService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

export default function PaymentsPage() {
  const { user, language = 'en', isRTL } = useAuth();
  const isAr = language === 'ar';
  const [searchParams] = useSearchParams();
  const queryAppId = searchParams.get('applicationId');

  const [invoices, setInvoices] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pending', 'paid'

  // Payment checkout modal state
  const [checkoutTarget, setCheckoutTarget] = useState(null); // { invoice, application, course }
  const [selectedPackage, setSelectedPackage] = useState('WITHOUT_TRANSPORTATION');
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [checkoutStep, setCheckoutStep] = useState('select'); // 'select', 'initiating', 'processing', 'verifying', 'failed'
  const [checkoutError, setCheckoutError] = useState('');
  const [calculatedPricing, setCalculatedPricing] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Official Receipt Modal state
  const [receiptData, setReceiptData] = useState(null);

  // Load invoices and applications
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [invRes, appRes] = await Promise.allSettled([
        paymentService.my(),
        applicationService.my(),
      ]);

      const loadedInvoices = invRes.status === 'fulfilled' ? invRes.value.data || [] : [];
      const loadedApps = appRes.status === 'fulfilled' ? appRes.value.data || [] : [];

      setInvoices(loadedInvoices);
      setApplications(loadedApps);

      // If query param applicationId provided, automatically open checkout for that application
      if (queryAppId) {
        const targetApp = loadedApps.find((a) => a._id === queryAppId);
        if (targetApp && (targetApp.status === 'Accepted' || targetApp.status === 'Eligible - Payment Pending')) {
          const existingInv = loadedInvoices.find(
            (inv) => String(inv.application?._id || inv.application) === String(targetApp._id)
          );
          openCheckout({ application: targetApp, invoice: existingInv, course: targetApp.course });
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'فشل تحميل السجلات المالية.' : 'Failed to load financial records.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [queryAppId]);

  // Identify accepted applications that require payment and have not been paid
  const pendingAcceptedApps = useMemo(() => {
    return applications.filter((app) => {
      const isAccepted = app.status === 'Accepted' || app.status === 'Eligible - Payment Pending';
      if (!isAccepted) return false;
      // Check if there is already a PAID invoice for this application
      const matchingInv = invoices.find(
        (inv) => String(inv.application?._id || inv.application) === String(app._id) && inv.status === 'Paid'
      );
      return !matchingInv;
    });
  }, [applications, invoices]);

  // Open Checkout Modal
  const openCheckout = (target) => {
    setCheckoutTarget(target);
    const initialPkg = target.invoice?.packageType || 'WITHOUT_TRANSPORTATION';
    setSelectedPackage(initialPkg);
    setPaymentMethod('Card');
    setCheckoutStep('select');
    setCheckoutError('');
    fetchCalculatedPrice(target.course?._id, initialPkg);
  };

  // Fetch trusted server-side price calculation
  const fetchCalculatedPrice = async (courseId, pkgType) => {
    if (!courseId) return;
    setPriceLoading(true);
    try {
      const res = await paymentService.calculatePrice(courseId, pkgType);
      if (res.data) {
        setCalculatedPricing(res.data);
      }
    } catch {
      // Fallback to local course object if network glitch
      if (checkoutTarget?.course) {
        const base = checkoutTarget.course.price || 0;
        const trans = checkoutTarget.course.transportationPrice ?? 500;
        setCalculatedPricing({
          basePrice: base,
          transportationPrice: trans,
          packageType: pkgType,
          totalAmount: pkgType === 'WITH_TRANSPORTATION' ? base + trans : base,
          currency: 'EGP',
        });
      }
    } finally {
      setPriceLoading(false);
    }
  };

  const handlePackageChange = (newPkg) => {
    setSelectedPackage(newPkg);
    if (checkoutTarget?.course?._id) {
      fetchCalculatedPrice(checkoutTarget.course._id, newPkg);
    }
  };

  // Execute Payment Initiation & Verification Lifecycle
  const handleInitiateAndPay = async () => {
    if (!checkoutTarget) return;
    setCheckoutError('');
    setCheckoutStep('initiating');

    try {
      const payload = {
        applicationId: checkoutTarget.application?._id || checkoutTarget.invoice?.application?._id || checkoutTarget.invoice?.application,
        invoiceId: checkoutTarget.invoice?._id,
        packageType: selectedPackage,
        paymentMethod: paymentMethod,
      };

      // Step 1: Initiate payment on backend
      const initRes = await paymentService.initiate(payload);
      const { transaction, invoice, redirectUrl, isMock, clientSecret } = initRes.data;

      setCheckoutStep('processing');

      // Step 2: In development mock gateway mode, complete verification seamlessly
      if (isMock || !redirectUrl || redirectUrl.includes('mock') || redirectUrl.includes('sandbox')) {
        setCheckoutStep('verifying');
        // Brief simulated network timing for realistic institutional feedback
        await new Promise((resolve) => setTimeout(resolve, 800));

        const verifyRes = await paymentService.verify({
          transactionId: transaction?.transactionId,
          invoiceId: invoice?._id,
          providerReference: transaction?.providerReference || clientSecret,
          status: 'SUCCESS',
        });

        // Payment verified & finalized
        const settledInvoice = verifyRes.data?.invoice || invoice;
        const settledTxn = verifyRes.data?.transaction || transaction;

        setCheckoutTarget(null);
        setCheckoutStep('select');
        await loadData();

        setReceiptData({
          invoice: settledInvoice,
          transaction: settledTxn,
          course: checkoutTarget.course || settledInvoice.course,
          cohort: checkoutTarget.application?.cohort || settledInvoice.cohort,
          packageType: selectedPackage,
          amount: settledInvoice.amount,
          currency: settledInvoice.currency || 'EGP',
          paidAt: settledInvoice.paidAt || new Date().toISOString(),
        });
      } else {
        // If a real redirect gateway is configured in production, redirect student
        window.location.href = redirectUrl;
      }
    } catch (err) {
      setCheckoutStep('failed');
      setCheckoutError(
        err.response?.data?.message ||
          (isAr
            ? 'تعذر إتمام عملية الدفع. يرجى المحاولة مرة أخرى أو مراجعة إدارة الأكاديمية.'
            : 'Payment transaction failed. Please verify your details or try again.')
      );
    }
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'paid') return inv.status === 'Paid';
    if (activeTab === 'pending') return inv.status === 'Invoice Issued' || inv.status === 'Pending' || inv.status === 'Payment Initiated';
    return true;
  });

  if (loading) {
    return <LoadingState label={isAr ? 'جاري تحميل السجلات المالية والفواتير…' : 'Loading financial records & invoices…'} />;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader
        title={isAr ? 'الفواتير والمدفوعات' : 'Invoices & Payments'}
        subtitle={
          isAr
            ? 'إدارة فواتير التدريب، باقات الانتقال المعتمدة، وسجلات الإيصالات المالية الرسمية لأكاديمية الفضاء.'
            : 'Manage program tuition invoices, transportation packages, and review official EGSA Space Academy receipts.'
        }
        breadcrumbs={[
          { label: isAr ? 'لوحة التحكم' : 'Portal', to: '/student/dashboard' },
          { label: isAr ? 'المدفوعات' : 'Payments' },
        ]}
      />

      {/* Payment Deadline Policy Notice */}
      <div className="egsa-card mb-4 border-start border-4 border-warning bg-light-subtle p-3 p-md-4">
        <div className="d-flex align-items-start gap-3">
          <i className="fa-solid fa-clock text-warning fs-3 mt-1"></i>
          <div>
            <h6 className="fw-bold text-dark mb-1">
              {isAr ? 'سياسة مهلة السداد وتأكيد المقاعد (٧٢ ساعة)' : 'EGSA 72-Hour Payment Deadline Policy'}
            </h6>
            <p className="text-muted small mb-0">
              {isAr
                ? 'وفقاً للائحة أكاديمية وكالة الفضاء المصرية، يجب سداد وتأكيد المصروفات الدراسية قبل موعد بدء الدورة بـ ٧٢ ساعة على الأقل. في حال عدم السداد خلال المهلة، يتم إلغاء حجز المقعد تلقائياً وإتاحته لقائمة الانتظار.'
                : 'Per Academy regulations, full tuition must be confirmed at least 72 hours before the cohort start date. If payment is not completed before this deadline, reserved seats are automatically released and reassigned to candidates on the waitlist.'}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {/* Prominent Payment Required Banner for Accepted Applications */}
      {pendingAcceptedApps.length > 0 && (
        <div className="mb-4">
          <div className="card border-0 shadow-sm border-start border-4 border-success bg-white p-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: '48px', height: '48px' }}
                >
                  <i className="fa-solid fa-file-circle-check fs-4"></i>
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-success-subtle text-success fw-bold text-uppercase">
                      {isAr ? 'مطلوب السداد' : 'Payment Required'}
                    </span>
                    <span className="badge bg-light text-dark border">
                      {pendingAcceptedApps.length} {isAr ? 'طلب مقبول' : 'Accepted Application(s)'}
                    </span>
                  </div>
                  <h5 className="fw-bold text-dark mb-1 mt-1">
                    {isAr ? 'تهانينا! تم قبول طلب التحاقك' : 'Congratulations! Your Application Has Been Accepted'}
                  </h5>
                  <p className="text-muted small mb-0">
                    {isAr
                      ? 'يرجى اختيار باقة التدريب (مع أو بدون انتقالات) وإتمام السداد لتأكيد تسجيلك واستلام جدول التدريب.'
                      : 'Please choose your training package (with or without transportation) and proceed to payment to finalize your enrollment.'}
                  </p>
                </div>
              </div>

              <div className="d-flex flex-column gap-2 w-100 w-md-auto">
                {pendingAcceptedApps.map((app) => {
                  const existingInv = invoices.find(
                    (inv) => String(inv.application?._id || inv.application) === String(app._id)
                  );
                  return (
                    <div key={app._id} className="d-flex align-items-center justify-content-between gap-3 bg-light p-2 rounded">
                      <div className="text-start">
                        <strong className="d-block text-dark small">{app.course?.title}</strong>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {app.cohort?.name ? `${isAr ? 'دفعة: ' : 'Cohort: '} ${app.cohort.name}` : ''}
                        </span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm px-3 flex-shrink-0"
                        onClick={() => openCheckout({ application: app, invoice: existingInv, course: app.course })}
                      >
                        <i className="fa-solid fa-credit-card me-1"></i>
                        {isAr ? 'اختيار الباقة والسداد' : 'Select Package & Pay'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Filter */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <ul className="nav nav-pills">
          <li className="nav-item">
            <button
              className={`nav-link btn-sm ${activeTab === 'all' ? 'active bg-primary-egsa text-white' : 'text-muted'}`}
              onClick={() => setActiveTab('all')}
            >
              {isAr ? 'كافة الفواتير' : 'All Invoices'} ({invoices.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link btn-sm ${activeTab === 'pending' ? 'active bg-primary-egsa text-white' : 'text-muted'}`}
              onClick={() => setActiveTab('pending')}
            >
              {isAr ? 'بانتظار السداد' : 'Pending Payment'} (
              {invoices.filter((i) => i.status === 'Invoice Issued' || i.status === 'Pending').length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link btn-sm ${activeTab === 'paid' ? 'active bg-primary-egsa text-white' : 'text-muted'}`}
              onClick={() => setActiveTab('paid')}
            >
              {isAr ? 'الإيصالات المسددة' : 'Paid Receipts'} ({invoices.filter((i) => i.status === 'Paid').length})
            </button>
          </li>
        </ul>

        <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
          <i className="fa-solid fa-arrows-rotate me-1"></i> {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Invoices List / Grid */}
      {filteredInvoices.length === 0 && !error ? (
        <div className="egsa-card text-center p-5">
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light text-muted mb-3"
            style={{ width: '64px', height: '64px' }}
          >
            <i className="fa-solid fa-receipt fs-2"></i>
          </div>
          <h5 className="fw-bold text-dark mb-1">
            {isAr ? 'لا توجد فواتير في هذه الفئة' : 'No invoices in this category'}
          </h5>
          <p className="text-muted small mb-3">
            {isAr
              ? 'يتم إصدار الفواتير الرسمية فور قبول طلبك للالتحاق ببرامج وكالة الفضاء المصرية.'
              : 'Official invoices are generated upon academic committee acceptance of your training program application.'}
          </p>
          <Link to="/student/applications" className="btn btn-outline-primary btn-sm">
            <i className="fa-solid fa-file-lines me-1"></i> {isAr ? 'عرض طلبات الالتحاق' : 'View My Applications'}
          </Link>
        </div>
      ) : (
        <div className="row g-4">
          {filteredInvoices.map((inv) => {
            const course = inv.course || {};
            const isPaid = inv.status === 'Paid';
            const isOverdue = inv.status === 'Overdue' || (inv.dueDate && new Date(inv.dueDate) < new Date() && !isPaid);
            const isPayable = inv.status === 'Invoice Issued' || inv.status === 'Pending' || inv.status === 'Payment Initiated';

            const baseAmount = inv.baseAmount ?? inv.coursePriceAtPurchase ?? inv.amount;
            const transportationAmount = inv.transportationAmount ?? 0;
            const totalAmount = inv.amount;

            return (
              <div className="col-lg-6" key={inv._id}>
                <div className="egsa-card h-100 p-4 d-flex flex-column justify-content-between position-relative shadow-sm border-0">
                  <div>
                    {/* Header */}
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                      <div>
                        <span className="badge bg-light text-primary-egsa border border-primary-subtle small mb-1">
                          {inv.invoiceNumber || `INV-${inv._id.slice(-6).toUpperCase()}`}
                        </span>
                        <h5 className="fw-bold text-dark mb-0">{course.title || (isAr ? 'مصروفات دورة تدريبية' : 'Course Tuition')}</h5>
                      </div>
                      <StatusBadge status={isOverdue && !isPaid ? 'Overdue' : inv.status} />
                    </div>

                    {/* Financial details table */}
                    <div className="p-3 bg-light rounded mb-3">
                      <div className="d-flex justify-content-between small text-muted mb-1">
                        <span>{isAr ? 'مصروفات الدورة التدريبية:' : 'Course Tuition:'}</span>
                        <span className="text-dark fw-medium">
                          {baseAmount.toLocaleString()} {inv.currency || 'EGP'}
                        </span>
                      </div>
                      {transportationAmount > 0 && (
                        <div className="d-flex justify-content-between small text-muted mb-1">
                          <span>{isAr ? 'باقة الانتقالات المعتمدة:' : 'Transportation Option:'}</span>
                          <span className="text-dark fw-medium">
                            +{transportationAmount.toLocaleString()} {inv.currency || 'EGP'}
                          </span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between small text-muted mb-2">
                        <span>{isAr ? 'الباقة المختارة:' : 'Package:'}</span>
                        <span className="text-dark fw-semibold">
                          {inv.packageType === 'WITH_TRANSPORTATION'
                            ? (isAr ? 'الدورة + الانتقالات' : 'Course + Transportation')
                            : (isAr ? 'الدورة فقط' : 'Course Only')}
                        </span>
                      </div>
                      <hr className="my-2" />
                      <div className="d-flex justify-content-between fw-bold text-dark">
                        <span>{isAr ? 'الإجمالي المطلوب:' : 'Total Amount:'}</span>
                        <span className="text-accent-egsa fs-5">
                          {totalAmount.toLocaleString()} {inv.currency || 'EGP'}
                        </span>
                      </div>
                    </div>

                    {/* Important dates */}
                    <ul className="list-unstyled small text-muted mb-4 d-flex flex-column gap-1">
                      <li className="d-flex align-items-center gap-2">
                        <i className="fa-regular fa-calendar-check text-primary-egsa" style={{ width: '16px' }}></i>
                        <span>
                          {isAr ? 'تاريخ الإصدار: ' : 'Issued Date: '}
                          {new Date(inv.issuedAt || inv.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                      <li className="d-flex align-items-center gap-2">
                        <i className="fa-solid fa-hourglass-end text-danger-egsa" style={{ width: '16px' }}></i>
                        <span className={isOverdue ? 'text-danger-egsa fw-bold' : ''}>
                          {isAr ? 'مهلة السداد (قاعدة ٧٢ ساعة): ' : 'Payment Deadline (72h Rule): '}
                          {inv.dueAt || inv.dueDate ? new Date(inv.dueAt || inv.dueDate).toLocaleString() : (isAr ? 'محددة لاحقاً' : 'TBA')}
                        </span>
                      </li>
                      {inv.paidAt && (
                        <li className="d-flex align-items-center gap-2">
                          <i className="fa-solid fa-circle-check text-success" style={{ width: '16px' }}></i>
                          <span className="text-success fw-medium">
                            {isAr ? 'تاريخ السداد: ' : 'Paid Date: '}
                            {new Date(inv.paidAt).toLocaleString()}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-top mt-auto d-flex gap-2">
                    {isPaid ? (
                      <button
                        className="btn btn-outline-secondary btn-sm w-100"
                        onClick={() =>
                          setReceiptData({
                            invoice: inv,
                            course: inv.course,
                            cohort: inv.cohort,
                            packageType: inv.packageType,
                            amount: inv.amount,
                            currency: inv.currency || 'EGP',
                            paidAt: inv.paidAt || inv.updatedAt,
                          })
                        }
                      >
                        <i className="fa-solid fa-receipt me-1 text-secondary-egsa"></i>
                        {isAr ? 'عرض الإيصال الرسمي' : 'View Official Receipt'}
                      </button>
                    ) : isOverdue ? (
                      <div className="alert alert-danger p-2 small mb-0 w-100 text-center">
                        <i className="fa-solid fa-circle-exclamation me-1"></i>
                        {isAr ? 'انتهت مهلة الحجز (٧٢ ساعة)' : 'Reservation Expired (72h Deadline Passed)'}
                      </div>
                    ) : isPayable ? (
                      <button
                        className="btn btn-primary btn-sm w-100"
                        onClick={() => openCheckout({ invoice: inv, course: inv.course, application: inv.application })}
                      >
                        <i className="fa-solid fa-credit-card me-1"></i>
                        {isAr ? 'اختيار الباقة وإتمام السداد' : 'Select Package & Pay'}
                      </button>
                    ) : (
                      <span className="text-muted small text-center w-100">
                        {isAr ? 'الحالة: ' : 'Status: '} {inv.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Package Selection & Payment Initiation Modal */}
      {checkoutTarget && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="fa-solid fa-shield-halved me-2 text-primary-egsa"></i>
                  {isAr ? 'سداد المصروفات واختيار الباقة' : 'Tuition Payment & Package Selection'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setCheckoutTarget(null)}
                  disabled={checkoutStep === 'initiating' || checkoutStep === 'processing' || checkoutStep === 'verifying'}
                ></button>
              </div>

              <div className="modal-body p-4">
                {/* Error Banner */}
                {checkoutError && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                    <i className="fa-solid fa-triangle-exclamation fs-5 flex-shrink-0"></i>
                    <div>
                      <strong>{isAr ? 'فشلت عملية السداد:' : 'Payment Failed:'}</strong> {checkoutError}
                    </div>
                  </div>
                )}

                {/* Course & Cohort Info */}
                <div className="p-3 bg-light rounded mb-3 border">
                  <span className="text-muted small d-block">
                    {isAr ? 'البرنامج التدريبي والدفعة' : 'Course & Program'}
                  </span>
                  <strong className="text-dark fs-5">{checkoutTarget.course?.title || 'EGSA Training Course'}</strong>
                  {checkoutTarget.application?.cohort && (
                    <div className="text-muted small mt-1">
                      <i className="fa-solid fa-users me-1 text-primary-egsa"></i>
                      {isAr ? 'الدفعة: ' : 'Cohort: '}
                      <strong>{checkoutTarget.application.cohort.name || checkoutTarget.application.cohort}</strong>
                    </div>
                  )}
                </div>

                {/* Package Selection Options: Option A vs Option B */}
                <div className="mb-4">
                  <label className="form-label small fw-bold text-dark text-uppercase mb-2">
                    {isAr ? 'حدد باقة التدريب المطلوبة:' : 'Choose Your Training Package:'}
                  </label>
                  <div className="d-flex flex-column gap-2">
                    {/* Option A: Course Only */}
                    <label
                      className={`p-3 border rounded d-flex align-items-center justify-content-between cursor-pointer ${
                        selectedPackage === 'WITHOUT_TRANSPORTATION'
                          ? 'border-2 border-primary bg-light'
                          : 'border-secondary-subtle'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <input
                          type="radio"
                          name="packageType"
                          value="WITHOUT_TRANSPORTATION"
                          checked={selectedPackage === 'WITHOUT_TRANSPORTATION'}
                          onChange={() => handlePackageChange('WITHOUT_TRANSPORTATION')}
                          disabled={checkoutStep !== 'select' && checkoutStep !== 'failed'}
                        />
                        <div>
                          <div className="fw-bold text-dark">
                            {isAr ? 'الخيار (أ): الدورة التدريبية فقط' : 'Option A: Course Only'}
                          </div>
                          <small className="text-muted">
                            {isAr
                              ? 'حضور التدريب بمقر الأكاديمية (انتقالات ذاتية للمتدرب)'
                              : 'Standard On-Campus Training (Self Transportation)'}
                          </small>
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="fw-bold text-primary-egsa fs-5">
                          {priceLoading
                            ? '…'
                            : (calculatedPricing?.basePrice ?? checkoutTarget.course?.price ?? 0).toLocaleString()}{' '}
                          {calculatedPricing?.currency || 'EGP'}
                        </span>
                      </div>
                    </label>

                    {/* Option B: Course + Transportation */}
                    <label
                      className={`p-3 border rounded d-flex align-items-center justify-content-between cursor-pointer ${
                        selectedPackage === 'WITH_TRANSPORTATION'
                          ? 'border-2 border-primary bg-light'
                          : 'border-secondary-subtle'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <input
                          type="radio"
                          name="packageType"
                          value="WITH_TRANSPORTATION"
                          checked={selectedPackage === 'WITH_TRANSPORTATION'}
                          onChange={() => handlePackageChange('WITH_TRANSPORTATION')}
                          disabled={checkoutStep !== 'select' && checkoutStep !== 'failed'}
                        />
                        <div>
                          <div className="fw-bold text-dark">
                            {isAr ? 'الخيار (ب): الدورة التدريبية + خدمة الانتقالات' : 'Option B: Course + Transportation'}
                            <span className="badge bg-success-subtle text-success ms-2">
                              {isAr ? 'موصى به' : 'Recommended'}
                            </span>
                          </div>
                          <small className="text-muted">
                            {isAr
                              ? `يشمل حافلات مكيفة مخصصة من وإلى مقر الوكالة (+${(calculatedPricing?.transportationPrice ?? checkoutTarget.course?.transportationPrice ?? 500).toLocaleString()} ج.م)`
                              : `Includes Agency Air-Conditioned Shuttle Bus (+${(calculatedPricing?.transportationPrice ?? checkoutTarget.course?.transportationPrice ?? 500).toLocaleString()} EGP)`}
                          </small>
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="fw-bold text-success fs-5">
                          {priceLoading
                            ? '…'
                            : (
                                (calculatedPricing?.basePrice ?? checkoutTarget.course?.price ?? 0) +
                                (calculatedPricing?.transportationPrice ?? checkoutTarget.course?.transportationPrice ?? 500)
                              ).toLocaleString()}{' '}
                          {calculatedPricing?.currency || 'EGP'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Amount Due Box */}
                <div className="p-3 bg-light rounded mb-3 border">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <span className="fw-semibold text-dark d-block">
                        {isAr ? 'إجمالي المبلغ المطلوب:' : 'Total Amount Due:'}
                      </span>
                      <small className="text-muted">
                        {isAr ? 'الباقة: ' : 'Package: '}
                        <strong>
                          {selectedPackage === 'WITH_TRANSPORTATION'
                            ? (isAr ? 'الدورة + الانتقالات' : 'Course + Transportation')
                            : (isAr ? 'الدورة فقط' : 'Course Only')}
                        </strong>
                      </small>
                    </div>
                    <span className="text-accent-egsa fw-bold fs-3">
                      {priceLoading
                        ? '…'
                        : (calculatedPricing?.totalAmount ?? checkoutTarget.course?.price ?? 0).toLocaleString()}{' '}
                      {calculatedPricing?.currency || 'EGP'}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    {isAr ? 'طريقة السداد المعتمدة:' : 'Payment Method:'}
                  </label>
                  <div className="d-flex flex-column gap-2">
                    <label className="p-2 border rounded d-flex align-items-center gap-2 cursor-pointer bg-light">
                      <input
                        type="radio"
                        name="method"
                        value="Card"
                        checked={paymentMethod === 'Card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={checkoutStep !== 'select' && checkoutStep !== 'failed'}
                      />
                      <i className="fa-solid fa-credit-card text-primary-egsa"></i>
                      <span className="small fw-medium">
                        {isAr ? 'بطاقة بنكية / فيزا / ماستركارد (بوابة السداد الفوري)' : 'Credit / Debit Card (Instant Gateway Verification)'}
                      </span>
                    </label>

                    <label className="p-2 border rounded d-flex align-items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        value="BankTransfer"
                        checked={paymentMethod === 'BankTransfer'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={checkoutStep !== 'select' && checkoutStep !== 'failed'}
                      />
                      <i className="fa-solid fa-building-columns text-secondary-egsa"></i>
                      <span className="small fw-medium">
                        {isAr ? 'تحويل بنكي / فوري باي' : 'Egyptian Central Bank Direct Transfer / Fawry Pay'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Gateway Environment Badge */}
                <div className="p-2 bg-light border rounded small d-flex align-items-center justify-content-between text-muted">
                  <span className="d-flex align-items-center gap-2">
                    <i className="fa-solid fa-lock text-success"></i>
                    <span>{isAr ? 'بيئة سداد مشفرة وآمنة وفقاً لمعايير وكالة الفضاء' : 'Encrypted & Secure Payment Gateway Environment'}</span>
                  </span>
                  <span className="badge bg-secondary-subtle text-secondary small">
                    DEVELOPMENT MOCK GATEWAY
                  </span>
                </div>
              </div>

              <div className="modal-footer bg-light justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setCheckoutTarget(null)}
                  disabled={checkoutStep === 'initiating' || checkoutStep === 'processing' || checkoutStep === 'verifying'}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4"
                  onClick={handleInitiateAndPay}
                  disabled={checkoutStep === 'initiating' || checkoutStep === 'processing' || checkoutStep === 'verifying'}
                >
                  {checkoutStep === 'initiating' && (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {isAr ? 'جاري تهيئة جلسة السداد…' : 'Initiating Gateway Session…'}
                    </>
                  )}
                  {checkoutStep === 'processing' && (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {isAr ? 'معالجة العملية المالية…' : 'Processing Payment…'}
                    </>
                  )}
                  {checkoutStep === 'verifying' && (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {isAr ? 'التحقق وتأكيد القيد…' : 'Verifying & Confirming Enrollment…'}
                    </>
                  )}
                  {(checkoutStep === 'select' || checkoutStep === 'failed') && (
                    <>
                      <i className="fa-solid fa-lock me-2"></i>
                      {isAr
                        ? `تأكيد وسداد (${(calculatedPricing?.totalAmount ?? checkoutTarget.course?.price ?? 0).toLocaleString()} ج.م)`
                        : `Proceed to Payment (${(calculatedPricing?.totalAmount ?? checkoutTarget.course?.price ?? 0).toLocaleString()} EGP)`}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      {receiptData && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-primary-egsa text-white">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-satellite-dish me-2"></i>
                  {isAr ? 'إيصال سداد رسمي — وكالة الفضاء المصرية' : 'EGSA Space Academy Official Payment Receipt'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setReceiptData(null)}
                ></button>
              </div>

              <div className="modal-body p-4 text-center">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success text-white mb-3"
                  style={{ width: '64px', height: '64px' }}
                >
                  <i className="fa-solid fa-check fa-2x"></i>
                </div>
                <h4 className="fw-bold text-dark mb-1">
                  {isAr ? 'تم تأكيد السداد وقبول القيد بنجاح' : 'Payment Confirmed & Enrollment Finalized'}
                </h4>
                <p className="text-muted small mb-3">Egyptian Space Agency Academy</p>

                <div className="p-3 bg-light rounded text-start small mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'رقم الفاتورة:' : 'Invoice #:'}</span>
                    <strong className="text-dark">
                      {receiptData.invoice?.invoiceNumber || `EGSA-INV-${(receiptData.invoice?._id || '').slice(-6).toUpperCase()}`}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'الرقم المرجعي للمعاملة:' : 'Transaction Reference:'}</span>
                    <strong className="text-truncate text-dark" style={{ maxWidth: '200px' }}>
                      {receiptData.transaction?.providerReference || receiptData.transaction?.transactionId || 'TXN-' + Math.random().toString(36).substring(2, 10).toUpperCase()}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'البرنامج التدريبي:' : 'Course:'}</span>
                    <strong className="text-dark">{receiptData.course?.title}</strong>
                  </div>
                  {receiptData.cohort && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">{isAr ? 'الدفعة:' : 'Cohort:'}</span>
                      <strong className="text-dark">{receiptData.cohort?.name || receiptData.cohort}</strong>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'الباقة المختارة:' : 'Selected Package:'}</span>
                    <strong className="text-primary-egsa">
                      {receiptData.packageType === 'WITH_TRANSPORTATION'
                        ? (isAr ? 'الدورة + الانتقالات' : 'Course + Transportation')
                        : (isAr ? 'الدورة فقط' : 'Course Only (Without Transportation)')}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'المبلغ المسدد:' : 'Amount Paid:'}</span>
                    <strong className="text-secondary-egsa fs-6">
                      {(receiptData.amount || 0).toLocaleString()} {receiptData.currency || 'EGP'}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'تاريخ السداد:' : 'Payment Date:'}</span>
                    <strong className="text-dark">{new Date(receiptData.paidAt).toLocaleString()}</strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <span className="text-muted">{isAr ? 'الحالة المالية والأكاديمية:' : 'Status:'}</span>
                    <span className="badge bg-success">
                      {isAr ? 'مسدد ومقيد رسمياً' : 'PAID & ENROLLED'}
                    </span>
                  </div>
                </div>

                <p className="text-muted small mb-0">
                  {isAr
                    ? 'تم تأكيد قيدك بنجاح في الدورة التدريبية. تم إرسال بريد إلكتروني تأكيدي يتضمن جدول التدريب ومعلومات الحضور، ويمكنك الآن الوصول إلى قسم تدريبي.'
                    : 'Your enrollment is confirmed! An official confirmation email with your training schedule has been dispatched, and your course is now unlocked under My Training.'}
                </p>
              </div>

              <div className="modal-footer bg-light justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => window.print()}
                >
                  <i className="fa-solid fa-print me-1"></i> {isAr ? 'طباعة الإيصال' : 'Print Receipt'}
                </button>
                <Link to="/student/training" className="btn btn-primary btn-sm">
                  <i className="fa-solid fa-graduation-cap me-1"></i> {isAr ? 'الانتقال إلى تدريبي' : 'Go to My Training'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
