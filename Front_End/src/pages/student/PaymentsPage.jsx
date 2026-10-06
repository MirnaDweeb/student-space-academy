import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentService, applicationService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

/**
 * Egyptian Space Agency — National Space Technology Training Platform
 * Student Course Payments & Financial Ledger
 */
export default function PaymentsPage() {
  const { user, language = 'en', isRTL } = useAuth();
  const isAr = language === 'ar';
  const [searchParams] = useSearchParams();
  const queryAppId = searchParams.get('applicationId');
  const queryInvoiceId = searchParams.get('invoiceId');

  const [invoices, setInvoices] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pending', 'paid'

  // Active payment checkout state (selected payable invoice)
  const [checkoutTarget, setCheckoutTarget] = useState(null); // { invoice, application, course, cohort }
  const [selectedPackage, setSelectedPackage] = useState('WITHOUT_TRANSPORTATION');
  const [checkoutStep, setCheckoutStep] = useState('idle'); // 'idle', 'initiating', 'processing', 'failed'
  const [checkoutError, setCheckoutError] = useState('');
  const [calculatedPricing, setCalculatedPricing] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Official Receipt Modal state
  const [receiptData, setReceiptData] = useState(null);
  const [stripeNotice, setStripeNotice] = useState(null);

  // Open / Select an invoice for payment
  const openCheckout = (target) => {
    if (!target) return;
    setCheckoutTarget(target);
    const initialPkg = target.invoice?.packageType || 'WITHOUT_TRANSPORTATION';
    setSelectedPackage(initialPkg);
    setCheckoutStep('idle');
    setCheckoutError('');
    const courseId = target.course?._id || target.invoice?.course?._id;
    if (courseId) {
      fetchCalculatedPrice(courseId, initialPkg, target);
    }
  };

  // Fetch trusted server-side price calculation
  const fetchCalculatedPrice = async (courseId, pkgType, target) => {
    if (!courseId) return;
    setPriceLoading(true);
    try {
      const res = await paymentService.calculatePrice(courseId, pkgType);
      if (res?.data) {
        setCalculatedPricing(res.data);
      }
    } catch {
      // Fallback calculation from trusted target record if calculation endpoint has network delay
      const activeCourse = target?.course || checkoutTarget?.course || target?.invoice?.course;
      if (activeCourse) {
        const base = Number(activeCourse.price) || 0;
        const trans = Number(activeCourse.transportationPrice) || 0;
        setCalculatedPricing({
          basePrice: base,
          transportationPrice: trans,
          packageType: pkgType,
          totalAmount: pkgType === 'WITH_TRANSPORTATION' ? base + trans : base,
          currency: activeCourse.currency || 'EGP',
        });
      }
    } finally {
      setPriceLoading(false);
    }
  };

  const handlePackageChange = (newPkg) => {
    setSelectedPackage(newPkg);
    const courseId = checkoutTarget?.course?._id || checkoutTarget?.invoice?.course?._id;
    if (courseId) {
      fetchCalculatedPrice(courseId, newPkg, checkoutTarget);
    }
  };

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

      // Resolve which payable invoice should be pre-loaded into the payment form
      let targetToSelect = null;

      if (queryInvoiceId) {
        const matchingInv = loadedInvoices.find((i) => String(i._id) === String(queryInvoiceId));
        if (matchingInv && ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(matchingInv.status)) {
          targetToSelect = {
            invoice: matchingInv,
            course: matchingInv.course,
            cohort: matchingInv.cohort,
            application: matchingInv.application,
          };
        }
      }

      if (!targetToSelect && queryAppId) {
        const targetApp = loadedApps.find((a) => String(a._id) === String(queryAppId));
        if (targetApp && (targetApp.status === 'Accepted' || targetApp.status === 'Eligible - Payment Pending')) {
          const existingInv = loadedInvoices.find(
            (inv) => String(inv.application?._id || inv.application) === String(targetApp._id)
          );
          targetToSelect = {
            application: targetApp,
            invoice: existingInv,
            course: targetApp.course,
            cohort: targetApp.cohort,
          };
        }
      }

      // Default: automatically select the first active payable invoice if not already chosen
      if (!targetToSelect) {
        const firstPayable = loadedInvoices.find(
          (inv) =>
            ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(inv.status) &&
            (!inv.dueDate || new Date(inv.dueDate) >= new Date())
        );
        if (firstPayable) {
          targetToSelect = {
            invoice: firstPayable,
            course: firstPayable.course,
            cohort: firstPayable.cohort,
            application: firstPayable.application,
          };
        }
      }

      // If no invoice yet but there is an accepted application awaiting payment
      if (!targetToSelect) {
        const firstAcceptedApp = loadedApps.find(
          (a) => a.status === 'Accepted' || a.status === 'Eligible - Payment Pending'
        );
        if (firstAcceptedApp) {
          const existingInv = loadedInvoices.find(
            (inv) => String(inv.application?._id || inv.application) === String(firstAcceptedApp._id)
          );
          targetToSelect = {
            application: firstAcceptedApp,
            invoice: existingInv,
            course: firstAcceptedApp.course,
            cohort: firstAcceptedApp.cohort,
          };
        }
      }

      if (targetToSelect) {
        openCheckout(targetToSelect);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (isAr ? 'فشل تحميل السجلات المالية.' : 'Failed to load financial records.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [queryAppId, queryInvoiceId]);

  // Handle return from Stripe hosted checkout session
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const cancelled = searchParams.get('cancelled');

    if (cancelled === 'true') {
      setStripeNotice({
        type: 'warning',
        title: isAr ? 'تم إلغاء جلسة الدفع' : 'Payment Session Cancelled',
        message: isAr
          ? 'تم إلغاء عملية الدفع ولم يتم خصم أي مبالغ. يظل حجزك المقبول متاحاً لإعادة المحاولة.'
          : 'Payment session was cancelled. No charges were made. Your accepted reservation remains open to retry before the deadline.',
      });
    } else if (sessionId) {
      setStripeNotice({
        type: 'info',
        title: isAr ? 'جاري التحقق من حالة السداد...' : 'Verifying Payment Settlement...',
        message: isAr
          ? 'جاري تأكيد معاملتك المالية مع وكالة الفضاء المصرية ونظام الدفع. يرجى الانتظار...'
          : 'Confirming your payment with the Egyptian Space Agency financial settlement system. Please wait a moment...',
      });

      let attempts = 0;
      const maxAttempts = 6;
      const pollStatus = async () => {
        try {
          attempts++;
          const res = await paymentService.getSessionStatus(sessionId);
          if (res.isSettled || res.status === 'Paid') {
            setStripeNotice({
              type: 'success',
              title: isAr ? 'تم تأكيد الدفع بنجاح!' : 'Payment Confirmed Successfully!',
              message: isAr
                ? 'تم استلام المبلغ وتأكيد التحاقك بالبرنامج التدريبي. تم فتح جميع محتويات التدريب في منصتك.'
                : 'Payment has been settled and verified. Your training program enrollment is finalized!',
            });
            await loadData();
            if (res.invoice && res.transaction) {
              setReceiptData({
                invoice: res.invoice,
                transaction: res.transaction,
                course: res.invoice.course,
                cohort: res.invoice.cohort,
                packageType: res.transaction.packageType || res.invoice.packageType,
                amount: res.transaction.amount || res.invoice.amount,
                currency: res.transaction.currency || res.invoice.currency || 'EGP',
                paidAt: res.transaction.paymentDate || res.invoice.paidAt || new Date().toISOString(),
              });
            }
          } else if (res.status === 'Requires_Refund') {
            setStripeNotice({
              type: 'warning',
              title: isAr ? 'تنبيه: سداد بعد انتهاء المهلة' : 'Late Payment Detected',
              message: isAr
                ? 'تم استلام الدفعة بعد انتهاء مهلة الـ 72 ساعة المقررة. تم تسجيل المعاملة للمراجعة المالية من قبل إدارة الأكاديمية.'
                : 'Payment arrived after the 72-hour deadline and reservation expiration. It has been recorded for administrative reconciliation.',
            });
            await loadData();
          } else if (res.status === 'Failed') {
            setStripeNotice({
              type: 'danger',
              title: isAr ? 'فشلت عملية الدفع' : 'Payment Failed',
              message: isAr
                ? 'تم رفض عملية السداد من جهة إصدار البطاقة. يمكنك إعادة المحاولة قبل انتهاء المهلة المحددة.'
                : 'Payment was declined by the issuer. You can retry before your reservation deadline.',
            });
            await loadData();
          } else if (res.status === 'Cancelled') {
            setStripeNotice({
              type: 'warning',
              title: isAr ? 'تم إلغاء الجلسة' : 'Session Expired or Cancelled',
              message: isAr
                ? 'انتهت صلاحية جلسة السداد السابقة. يمكنك بدء جلسة دفع جديدة.'
                : 'The previous checkout session has expired. You can initiate a new payment attempt.',
            });
            await loadData();
          } else if (attempts < maxAttempts) {
            setTimeout(pollStatus, 2500);
          } else {
            setStripeNotice({
              type: 'info',
              title: isAr ? 'عملية الدفع قيد التأكيد' : 'Payment Processing',
              message: isAr
                ? 'تم استلام طلب السداد وجاري معالجته عبر البنك. يرجى تحديث الصفحة بعد قليل لمراجعة حالة الفاتورة.'
                : 'Your payment was received and is awaiting webhook settlement from Stripe. Please refresh this page shortly to view the confirmed status.',
            });
            await loadData();
          }
        } catch (err) {
          setStripeNotice({
            type: 'warning',
            title: isAr ? 'حالة السداد' : 'Payment Status',
            message:
              err.response?.data?.message ||
              (isAr
                ? 'يرجى مراجعة قائمة الفواتير أدناه للتأكد من حالة السداد.'
                : 'Please check your invoices list below for current settlement status.'),
          });
          await loadData();
        }
      };

      pollStatus();
    }
  }, [searchParams]);

  // Execute Payment Initiation Lifecycle (Redirects to official Stripe Checkout)
  const handleInitiateAndPay = async () => {
    if (!checkoutTarget) return;
    if (checkoutStep === 'initiating' || checkoutStep === 'processing') return;

    setCheckoutError('');
    setCheckoutStep('initiating');

    try {
      const payload = {
        applicationId:
          checkoutTarget.application?._id ||
          checkoutTarget.invoice?.application?._id ||
          checkoutTarget.invoice?.application,
        invoiceId: checkoutTarget.invoice?._id,
        packageType: selectedPackage,
        method: 'Card',
      };

      // Step 1: Initiate payment session on backend
      const initRes = await paymentService.initiate(payload);
      const redirectUrl = initRes.data?.redirectUrl || initRes.data?.paymentUrl;

      if (!redirectUrl) {
        throw new Error(
          initRes.message ||
            (isAr
              ? 'لم يتم استلام رابط جلسة الدفع من البوابة. يرجى المحاولة مرة أخرى أو التواصل مع إدارة الأكاديمية.'
              : 'Failed to obtain a secure payment gateway session. Please try again or contact administration.')
        );
      }

      setCheckoutStep('processing');

      // Step 2: Redirect student securely to official Stripe Checkout session
      window.location.href = redirectUrl;
    } catch (err) {
      setCheckoutStep('failed');
      setCheckoutError(
        err.response?.data?.message ||
          err.message ||
          (isAr
            ? 'تعذر إتمام عملية الدفع. يرجى المحاولة مرة أخرى أو مراجعة إدارة الأكاديمية.'
            : 'Payment transaction failed. Please verify your details or try again.')
      );
    }
  };

  // Filtered invoices list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'paid') return inv.status === 'Paid';
      if (activeTab === 'pending') {
        return ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(inv.status);
      }
      return true;
    });
  }, [invoices, activeTab]);

  // Payable invoices list
  const payableInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(inv.status) &&
        (!inv.dueDate || new Date(inv.dueDate) >= new Date())
    );
  }, [invoices]);

  if (loading) {
    return (
      <LoadingState
        label={isAr ? 'جاري تحميل السجلات المالية والفواتير…' : 'Loading Course Payments & Invoices…'}
      />
    );
  }

  // Active target details
  const activeCourse = checkoutTarget?.course || checkoutTarget?.invoice?.course;
  const activeCohort = checkoutTarget?.cohort || checkoutTarget?.application?.cohort || checkoutTarget?.invoice?.cohort;
  const activeInvoice = checkoutTarget?.invoice;
  const hasTransportationSupport = activeCourse && (activeCourse.transportationPrice != null && activeCourse.transportationPrice > 0);

  const displayBasePrice = calculatedPricing?.basePrice ?? activeCourse?.price ?? activeInvoice?.baseAmount ?? activeInvoice?.amount ?? 0;
  const displayTransPrice = calculatedPricing?.transportationPrice ?? activeCourse?.transportationPrice ?? 0;
  const displayTotalDue = calculatedPricing?.totalAmount ?? (selectedPackage === 'WITH_TRANSPORTATION' ? displayBasePrice + displayTransPrice : displayBasePrice);
  const displayCurrency = calculatedPricing?.currency || activeInvoice?.currency || activeCourse?.currency || 'EGP';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Page Header with Title "Course Payments" */}
      <PageHeader
        title={isAr ? 'مدفوعات الدورات التدريبية' : 'Course Payments'}
        subtitle={
          isAr
            ? 'سداد المصروفات الدراسية، اختيار باقات الانتقال المعتمدة، واستعراض إيصالات وكالة الفضاء المصرية الرسمية.'
            : 'Manage program tuition, select official transportation packages, and review Egyptian Space Agency payment receipts.'
        }
        breadcrumbs={[
          { label: isAr ? 'لوحة التحكم' : 'Portal', to: '/student/dashboard' },
          { label: isAr ? 'مدفوعات الدورات التدريبية' : 'Course Payments' },
        ]}
      />

      {/* 2. Stripe Return Feedback Banner */}
      {stripeNotice && (
        <div
          className={`alert alert-${stripeNotice.type === 'error' ? 'danger' : stripeNotice.type} alert-dismissible fade show mb-4 shadow-sm border-0`}
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            <i
              className={`fa-solid ${
                stripeNotice.type === 'success'
                  ? 'fa-circle-check fs-5 text-success'
                  : stripeNotice.type === 'warning'
                  ? 'fa-triangle-exclamation fs-5 text-warning'
                  : 'fa-spinner fa-spin fs-5 text-info'
              }`}
            ></i>
            <div>
              <strong className="d-block">{stripeNotice.title}</strong>
              <span className="small">{stripeNotice.message}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setStripeNotice(null)}
          ></button>
        </div>
      )}

      {/* 3. 72-Hour Payment Deadline Policy Card */}
      <div className="egsa-card mb-4 border-start border-4 border-warning bg-light-subtle p-3 p-md-4">
        <div className="d-flex align-items-start gap-3">
          <i className="fa-solid fa-clock text-warning fs-3 mt-1"></i>
          <div>
            <h6 className="fw-bold text-dark mb-1">
              {isAr ? 'سياسة مهلة السداد وتأكيد المقاعد (٧٢ ساعة)' : 'EGSA 72-Hour Payment Deadline Policy'}
            </h6>
            <p className="text-muted small mb-0">
              {isAr
                ? 'وفقاً للائحة أكاديمية وكالة الفضاء المصرية، يجب سداد وتأكيد المصروفات الدراسية قبل موعد بدء الدورة بـ ٧٢ ساعة على الأقل. في حال عدم السداد خلال المهلة، يتم إلغاء حجز المقعد تلقائياً وإتاحته للمرشحين في قائمة الانتظار.'
                : 'Per Egyptian Space Agency Academy regulations, full tuition must be confirmed at least 72 hours prior to the cohort start date. If payment is not finalized before this deadline, reserved seats are automatically released and reassigned to candidates on the waitlist.'}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {/* 4. ACTIVE COURSE PAYMENT FORM & CHECKOUT INTERFACE */}
      {checkoutTarget ? (
        <div className="card border-0 shadow-sm mb-5 border-top border-4 border-primary">
          <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary-subtle text-primary p-2">
                <i className="fa-solid fa-credit-card fa-lg"></i>
              </span>
              <div>
                <h5 className="fw-bold text-dark mb-0">
                  {isAr ? 'نموذج سداد المصروفات الدراسية' : 'Course Tuition Payment Form'}
                </h5>
                <small className="text-muted">
                  {isAr ? 'جلسة دفع آمنة مشفرة عبر بوابة وكالة الفضاء الرسمية' : 'Secure encrypted payment checkout powered by Stripe Gateway'}
                </small>
              </div>
            </div>

            {payableInvoices.length > 1 && (
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">{isAr ? 'اختر الدورة:' : 'Select Invoice:'}</span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={activeInvoice?._id || ''}
                  onChange={(e) => {
                    const chosen = invoices.find((i) => i._id === e.target.value);
                    if (chosen) openCheckout({ invoice: chosen, course: chosen.course, cohort: chosen.cohort, application: chosen.application });
                  }}
                >
                  {payableInvoices.map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      {inv.course?.title} ({inv.invoiceNumber || 'INV'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="card-body p-4">
            {checkoutError && (
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-4">
                <i className="fa-solid fa-triangle-exclamation fs-5 flex-shrink-0"></i>
                <div>
                  <strong>{isAr ? 'تنبيه في الدفع: ' : 'Payment Error: '}</strong>
                  <span>{checkoutError}</span>
                </div>
              </div>
            )}

            <div className="row g-4">
              {/* Left Column: Course & Package Selection */}
              <div className="col-lg-7">
                {/* Course Details Card */}
                <div className="p-3 bg-light rounded border mb-4">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="badge bg-light text-primary border">
                      {activeInvoice?.invoiceNumber || 'EGSA-TUITION-INVOICE'}
                    </span>
                    <StatusBadge status={activeInvoice?.status || 'Pending'} />
                  </div>
                  <h4 className="fw-bold text-dark mb-1">{activeCourse?.title || 'Egyptian Space Academy Training Program'}</h4>
                  {activeCohort && (
                    <div className="text-muted small mb-2">
                      <i className="fa-solid fa-users me-1 text-primary"></i>
                      <span>{isAr ? 'الدفعة التدريبية: ' : 'Cohort: '}</span>
                      <strong>{activeCohort.name || activeCohort}</strong>
                    </div>
                  )}
                  {activeInvoice?.dueDate && (
                    <div className="text-muted small">
                      <i className="fa-regular fa-clock me-1 text-warning"></i>
                      <span>{isAr ? 'آخر موعد للسداد: ' : 'Payment Deadline: '}</span>
                      <strong className="text-dark">{new Date(activeInvoice.dueDate).toLocaleString()}</strong>
                    </div>
                  )}
                </div>

                {/* Package Options Selection */}
                <div className="mb-4">
                  <label className="form-label fw-bold text-dark small text-uppercase mb-2">
                    {isAr ? '١. اختيار باقة التدريب والخدمات اللوجستية:' : '1. Select Training & Logistics Package:'}
                  </label>
                  <div className="d-flex flex-column gap-2">
                    {/* Option 1: Course Tuition Only */}
                    <label
                      className={`p-3 border rounded d-flex justify-content-between align-items-center cursor-pointer transition-all ${
                        selectedPackage === 'WITHOUT_TRANSPORTATION'
                          ? 'border-primary bg-primary-subtle'
                          : 'bg-white hover-bg-light'
                      }`}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <input
                          type="radio"
                          name="packageType"
                          value="WITHOUT_TRANSPORTATION"
                          checked={selectedPackage === 'WITHOUT_TRANSPORTATION'}
                          onChange={() => handlePackageChange('WITHOUT_TRANSPORTATION')}
                          disabled={checkoutStep === 'initiating' || checkoutStep === 'processing'}
                          className="form-check-input"
                        />
                        <div>
                          <strong className="d-block text-dark">
                            {isAr ? 'الدورة التدريبية فقط (بدون انتقالات)' : 'Standard Package: Course Tuition Only'}
                          </strong>
                          <small className="text-muted">
                            {isAr
                              ? 'حضور كافة المحاضرات، التدريب العملي في المعامل، والمواد التدريبية الرسمية.'
                              : 'Full access to academic lectures, specialized labs, materials, and accreditation.'}
                          </small>
                        </div>
                      </div>
                      <span className="fw-bold text-dark">
                        {displayBasePrice.toLocaleString()} {displayCurrency}
                      </span>
                    </label>

                    {/* Option 2: Course Tuition + Transportation (if available) */}
                    {hasTransportationSupport ? (
                      <label
                        className={`p-3 border rounded d-flex justify-content-between align-items-center cursor-pointer transition-all ${
                          selectedPackage === 'WITH_TRANSPORTATION'
                            ? 'border-primary bg-primary-subtle'
                            : 'bg-white hover-bg-light'
                        }`}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <input
                            type="radio"
                            name="packageType"
                            value="WITH_TRANSPORTATION"
                            checked={selectedPackage === 'WITH_TRANSPORTATION'}
                            onChange={() => handlePackageChange('WITH_TRANSPORTATION')}
                            disabled={checkoutStep === 'initiating' || checkoutStep === 'processing'}
                            className="form-check-input"
                          />
                          <div>
                            <strong className="d-block text-dark">
                              {isAr ? 'الدورة التدريبية + حافلات الانتقال اليومية' : 'Full Package: Course + Transportation'}
                            </strong>
                            <small className="text-muted">
                              {isAr
                                ? 'يشمل الانتقال اليومي بحافلات وكالة الفضاء من نقاط التجمع المعتمدة إلى مقر الوكالة.'
                                : 'Includes scheduled daily EGSA shuttle service from designated assembly points in Cairo.'}
                            </small>
                          </div>
                        </div>
                        <span className="fw-bold text-dark">
                          {(displayBasePrice + displayTransPrice).toLocaleString()} {displayCurrency}
                        </span>
                      </label>
                    ) : null}
                  </div>
                </div>

                {/* Gateway Security & Terms */}
                <div className="p-3 bg-light border rounded small d-flex align-items-center justify-content-between text-muted">
                  <span className="d-flex align-items-center gap-2">
                    <i className="fa-solid fa-lock text-success"></i>
                    <span>{isAr ? 'بوابة سداد مشفرة وفقاً لمعايير وكالة الفضاء المصرية' : 'PCI-DSS Compliant Encrypted Stripe Checkout'}</span>
                  </span>
                  <span className="badge bg-primary-subtle text-primary small">
                    STRIPE HOSTED GATEWAY
                  </span>
                </div>
              </div>

              {/* Right Column: Authoritative Financial Summary & Pay Action */}
              <div className="col-lg-5">
                <div className="p-4 bg-light rounded border h-100 d-flex flex-column justify-content-between">
                  <div>
                    <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                      {isAr ? 'ملخص الفاتورة والسداد' : 'Payment Summary'}
                    </h6>

                    <div className="d-flex justify-content-between small text-muted mb-2">
                      <span>{isAr ? 'المصروفات الأساسية:' : 'Base Course Tuition:'}</span>
                      <strong className="text-dark">
                        {displayBasePrice.toLocaleString()} {displayCurrency}
                      </strong>
                    </div>

                    {selectedPackage === 'WITH_TRANSPORTATION' && (
                      <div className="d-flex justify-content-between small text-muted mb-2">
                        <span>{isAr ? 'رسوم الانتقالات المعتمدة:' : 'Transportation Option:'}</span>
                        <strong className="text-dark">
                          +{displayTransPrice.toLocaleString()} {displayCurrency}
                        </strong>
                      </div>
                    )}

                    <div className="d-flex justify-content-between small text-muted mb-2">
                      <span>{isAr ? 'الباقة المختارة:' : 'Selected Package:'}</span>
                      <span className="text-primary fw-medium">
                        {selectedPackage === 'WITH_TRANSPORTATION'
                          ? (isAr ? 'الدورة + الانتقالات' : 'Course + Transport')
                          : (isAr ? 'الدورة فقط' : 'Course Only')}
                      </span>
                    </div>

                    <div className="d-flex justify-content-between small text-muted mb-3">
                      <span>{isAr ? 'العملة المعتمدة:' : 'Settlement Currency:'}</span>
                      <span className="badge bg-light text-dark border">{displayCurrency}</span>
                    </div>

                    <hr className="my-3" />

                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <div>
                        <span className="fw-bold text-dark fs-6 d-block">
                          {isAr ? 'الإجمالي النهائي المطلوب:' : 'Total Amount Due:'}
                        </span>
                        <small className="text-muted">
                          {isAr ? 'شامل كافة الرسوم الدراسية' : 'Authoritative Total Amount'}
                        </small>
                      </div>
                      <span className="fs-3 fw-bold text-primary">
                        {priceLoading ? '…' : displayTotalDue.toLocaleString()} {displayCurrency}
                      </span>
                    </div>
                  </div>

                  <div>
                    {/* Pay Now Button */}
                    <button
                      type="button"
                      className="btn btn-primary btn-lg w-100 py-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                      onClick={handleInitiateAndPay}
                      disabled={checkoutStep === 'initiating' || checkoutStep === 'processing'}
                    >
                      {checkoutStep === 'initiating' || checkoutStep === 'processing' ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span>{isAr ? 'جاري تهيئة جلسة السداد المشفرة…' : 'Preparing Secure Stripe Checkout…'}</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-lock"></i>
                          <span className="fw-bold">
                            {isAr
                              ? `سداد الآن (${displayTotalDue.toLocaleString()} ج.م)`
                              : `Pay Now (${displayTotalDue.toLocaleString()} ${displayCurrency})`}
                          </span>
                          <i className={`fa-solid ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} ms-1`}></i>
                        </>
                      )}
                    </button>

                    <p className="text-muted text-center small mt-2 mb-0" style={{ fontSize: '0.75rem' }}>
                      <i className="fa-solid fa-shield-check me-1 text-success"></i>
                      {isAr
                        ? 'سيتم توجيهك إلى صفحة الدفع الرسمية والمشفرة من Stripe لإتمام المعاملة.'
                        : 'You will be securely redirected to Stripe to enter your payment details.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : invoices.length > 0 ? (
        /* If student has invoices, but all are already settled */
        <div className="alert alert-success border-0 shadow-sm p-4 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="rounded-circle bg-success text-white p-3 d-flex align-items-center justify-content-center">
              <i className="fa-solid fa-circle-check fs-3"></i>
            </div>
            <div>
              <h5 className="fw-bold text-dark mb-1">
                {isAr ? 'جميع مصاريفك الدراسية مسددة بالكامل' : 'All Course Invoices Are Fully Settled'}
              </h5>
              <p className="text-muted small mb-0">
                {isAr
                  ? 'لا توجد فواتير معلقة بانتظار السداد حالياً. يمكنك استعراض وطباعة الإيصالات الرسمية أدناه.'
                  : 'You have no outstanding tuition due. You can view, verify, and print your official receipts in the ledger below.'}
              </p>
            </div>
          </div>
          <Link to="/student/training" className="btn btn-outline-success btn-sm">
            <i className="fa-solid fa-graduation-cap me-1"></i> {isAr ? 'الانتقال إلى تدريبي' : 'Go to My Training'}
          </Link>
        </div>
      ) : null}

      {/* 5. TABS FILTER & ACTIONS */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <ul className="nav nav-pills">
          <li className="nav-item">
            <button
              className={`nav-link btn-sm ${activeTab === 'all' ? 'active bg-primary text-white' : 'text-muted'}`}
              onClick={() => setActiveTab('all')}
            >
              {isAr ? 'كافة الفواتير' : 'All Invoices'} ({invoices.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link btn-sm ${activeTab === 'pending' ? 'active bg-primary text-white' : 'text-muted'}`}
              onClick={() => setActiveTab('pending')}
            >
              {isAr ? 'بانتظار السداد' : 'Pending Payment'} (
              {invoices.filter((i) => ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(i.status)).length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link btn-sm ${activeTab === 'paid' ? 'active bg-primary text-white' : 'text-muted'}`}
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

      {/* 6. INVOICES LIST OR HELPFUL EMPTY STATE */}
      {filteredInvoices.length === 0 && !error ? (
        <div className="egsa-card text-center p-5 mb-5 border-0 shadow-sm bg-white rounded">
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light text-muted mb-3"
            style={{ width: '64px', height: '64px' }}
          >
            <i className="fa-solid fa-receipt fs-2"></i>
          </div>
          <h5 className="fw-bold text-dark mb-1">
            {isAr ? 'لا توجد فواتير دراسية مسجلة' : 'No Course Invoices Available'}
          </h5>
          <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '500px' }}>
            {isAr
              ? 'يتم إصدار الفواتير الدراسية الرسمية فور قبول طلب التحاقك من قبل اللجنة الأكاديمية لوكالة الفضاء المصرية. بمجرد قبول الطلب، ستظهر فاتورتك هنا لتأكيد المقعد وسداد المصروفات.'
              : 'Official tuition invoices are generated once your program application is formally accepted by the EGSA Academic Committee. Once accepted, your invoice will appear here to select your package and finalize enrollment.'}
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/student/programs" className="btn btn-primary btn-sm">
              <i className="fa-solid fa-compass me-1"></i> {isAr ? 'استكشاف البرامج التدريبية' : 'Explore Programs'}
            </Link>
            <Link to="/student/applications" className="btn btn-outline-primary btn-sm">
              <i className="fa-solid fa-file-lines me-1"></i> {isAr ? 'متابعة طلبات الالتحاق' : 'Track My Applications'}
            </Link>
          </div>
        </div>
      ) : (
        <div className="row g-4 mb-5">
          {filteredInvoices.map((inv) => {
            const course = inv.course || {};
            const isPaid = inv.status === 'Paid';
            const isOverdue =
              inv.status === 'Overdue' ||
              (inv.dueDate && new Date(inv.dueDate) < new Date() && !isPaid);
            const isPayable =
              ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(inv.status) && !isOverdue;

            const baseAmount = inv.baseAmount ?? inv.coursePriceAtPurchase ?? inv.amount;
            const transportationAmount = inv.transportationAmount ?? 0;
            const totalAmount = inv.amount;
            const isSelected = checkoutTarget?.invoice?._id === inv._id;

            return (
              <div className="col-lg-6" key={inv._id}>
                <div
                  className={`card h-100 p-4 d-flex flex-column justify-content-between position-relative shadow-sm border ${
                    isSelected ? 'border-primary ring-2' : 'border-0'
                  }`}
                  style={{ borderRadius: 'var(--radius-md, 8px)' }}
                >
                  <div>
                    {/* Header */}
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                      <div>
                        <span className="badge bg-light text-primary border mb-1">
                          {inv.invoiceNumber || `INV-${inv._id.slice(-6).toUpperCase()}`}
                        </span>
                        <h5 className="fw-bold text-dark mb-0">{course.title || (isAr ? 'مصروفات دورة تدريبية' : 'Course Tuition')}</h5>
                        {inv.cohort?.name && (
                          <small className="text-muted d-block mt-1">
                            <i className="fa-solid fa-users me-1 text-primary"></i>
                            {inv.cohort.name}
                          </small>
                        )}
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
                        <span className="text-primary fs-5">
                          {totalAmount.toLocaleString()} {inv.currency || 'EGP'}
                        </span>
                      </div>
                    </div>

                    {/* Important dates */}
                    <ul className="list-unstyled small text-muted mb-4 d-flex flex-column gap-1">
                      <li className="d-flex align-items-center gap-2">
                        <i className="fa-regular fa-calendar-check text-primary" style={{ width: '16px' }}></i>
                        <span>
                          {isAr ? 'تاريخ الإصدار: ' : 'Issued Date: '}
                          {new Date(inv.issuedAt || inv.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                      <li className="d-flex align-items-center gap-2">
                        <i className="fa-solid fa-hourglass-end text-danger" style={{ width: '16px' }}></i>
                        <span className={isOverdue ? 'text-danger fw-bold' : ''}>
                          {isAr ? 'مهلة السداد (قاعدة ٧٢ ساعة): ' : 'Payment Deadline (72h Rule): '}
                          {inv.dueAt || inv.dueDate
                            ? new Date(inv.dueAt || inv.dueDate).toLocaleString()
                            : isAr
                            ? 'محددة لاحقاً'
                            : 'TBA'}
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
                            transaction: (inv.transactions && inv.transactions[0]) || null,
                          })
                        }
                      >
                        <i className="fa-solid fa-receipt me-1 text-secondary"></i>
                        {isAr ? 'عرض الإيصال الرسمي' : 'View Official Receipt'}
                      </button>
                    ) : isOverdue ? (
                      <div className="alert alert-danger p-2 small mb-0 w-100 text-center">
                        <i className="fa-solid fa-circle-exclamation me-1"></i>
                        {isAr ? 'انتهت مهلة الحجز (٧٢ ساعة)' : 'Reservation Expired (72h Deadline Passed)'}
                      </div>
                    ) : isPayable ? (
                      <button
                        className={`btn btn-sm w-100 ${isSelected ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => {
                          openCheckout({ invoice: inv, course: inv.course, cohort: inv.cohort, application: inv.application });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <i className="fa-solid fa-credit-card me-1"></i>
                        {isSelected
                          ? isAr
                            ? 'محدد حالياً في نموذج السداد'
                            : 'Selected in Payment Form'
                          : isAr
                          ? 'تحديد وسداد الفاتورة'
                          : 'Select & Pay Invoice'}
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

      {/* 7. OFFICIAL INSTITUTIONAL RECEIPT MODAL */}
      {receiptData && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-md, 8px)' }}>
              <div className="modal-header bg-primary text-white">
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
                      {receiptData.invoice?.invoiceNumber ||
                        `EGSA-INV-${(receiptData.invoice?._id || '').slice(-6).toUpperCase()}`}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'الرقم المرجعي للمعاملة:' : 'Transaction Reference:'}</span>
                    <strong className="text-truncate text-dark" style={{ maxWidth: '200px' }}>
                      {receiptData.transaction?.providerReference ||
                        receiptData.transaction?.transactionId ||
                        'TXN-CONFIRMED-SETTLEMENT'}
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
                    <strong className="text-primary">
                      {receiptData.packageType === 'WITH_TRANSPORTATION'
                        ? isAr
                          ? 'الدورة + الانتقالات'
                          : 'Course + Transportation'
                        : isAr
                        ? 'الدورة فقط'
                        : 'Course Only (Without Transportation)'}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'المبلغ المسدد:' : 'Amount Paid:'}</span>
                    <strong className="text-secondary fs-6">
                      {(receiptData.amount || 0).toLocaleString()} {receiptData.currency || 'EGP'}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">{isAr ? 'تاريخ السداد:' : 'Payment Date:'}</span>
                    <strong className="text-dark">{new Date(receiptData.paidAt).toLocaleString()}</strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <span className="text-muted">{isAr ? 'الحالة المالية والأكاديمية:' : 'Status:'}</span>
                    <span className="badge bg-success">{isAr ? 'مسدد ومقيد رسمياً' : 'PAID & ENROLLED'}</span>
                  </div>
                </div>

                <p className="text-muted small mb-0">
                  {isAr
                    ? 'تم تأكيد قيدك بنجاح في الدورة التدريبية. تم فتح كافة محتويات التدريب في قسم تدريبي.'
                    : 'Your enrollment is confirmed! Your training materials and schedule are now unlocked under My Training.'}
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
