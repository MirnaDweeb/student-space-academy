import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentService, applicationService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

/**
 * Egyptian Space Agency — National Space Technology Training Platform
 * Student Course Payments, Custom Card Checkout & Financial Ledger
 */
export default function PaymentsPage() {
  const { user, language = 'en', isRTL } = useAuth();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const queryAppId = searchParams.get('applicationId');
  const queryInvoiceId = searchParams.get('invoiceId');

  const [invoices, setInvoices] = useState([]);
  const [applications, setApplications] = useState([]);
  const [myRefunds, setMyRefunds] = useState([]);
  const [refundAccount, setRefundAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pending', 'paid', 'refunds'

  // Active payment checkout state (selected payable invoice)
  const [checkoutTarget, setCheckoutTarget] = useState(null); // { invoice, application, course, cohort }
  const [selectedPackage, setSelectedPackage] = useState('WITHOUT_TRANSPORTATION');
  const [checkoutStep, setCheckoutStep] = useState('idle'); // 'idle', 'initiating', 'embedded_ready', 'processing', 'failed'
  const [checkoutError, setCheckoutError] = useState('');
  const [calculatedPricing, setCalculatedPricing] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Embedded Gateway Card Checkout Component state
  const [embeddedCheckout, setEmbeddedCheckout] = useState(null); // { iframeUrl, paymentUrl, orderId, paymentKey, isMock }

  // Official Receipt Modal & Return Settlement Flow states
  const [receiptData, setReceiptData] = useState(null);
  const [paymentSessionFlow, setPaymentSessionFlow] = useState(null); // null | 'processing' | 'confirmed' | 'failed' | 'cancelled' | 'requires_refund' | 'timeout'
  const [flowDetails, setFlowDetails] = useState(null);
  const [pollAttempt, setPollAttempt] = useState(0);

  // Refund Management Modals
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountFormData, setAccountFormData] = useState({
    accountHolderName: '',
    refundMethod: 'ORIGINAL_PAYMENT_METHOD',
    bankName: '',
    accountNumber: '',
    iban: '',
  });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');

  // Student Refund Request Modal
  const [refundTargetInvoice, setRefundTargetInvoice] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundModalError, setRefundModalError] = useState('');

  const dismissFlowState = () => {
    setPaymentSessionFlow(null);
    setFlowDetails(null);
    setSearchParams({});
  };

  // Open / Select an invoice for payment
  const openCheckout = (target) => {
    if (!target) return;
    setCheckoutTarget(target);
    setEmbeddedCheckout(null);
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

  // Load invoices, applications, refund account, and refunds
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [invRes, appRes, refundAccRes, myRefundsRes] = await Promise.allSettled([
        paymentService.my(),
        applicationService.my(),
        paymentService.getRefundAccount(),
        paymentService.myRefunds(),
      ]);

      const loadedInvoices = invRes.status === 'fulfilled' ? invRes.value.data || [] : [];
      const loadedApps = appRes.status === 'fulfilled' ? appRes.value.data || [] : [];
      const loadedRefundAcc = refundAccRes.status === 'fulfilled' ? refundAccRes.value.data : null;
      const loadedMyRefunds = myRefundsRes.status === 'fulfilled' ? myRefundsRes.value.data || [] : [];

      setInvoices(loadedInvoices);
      setApplications(loadedApps);
      setRefundAccount(loadedRefundAcc);
      setMyRefunds(loadedMyRefunds);

      if (loadedRefundAcc) {
        setAccountFormData({
          accountHolderName: loadedRefundAcc.accountHolderName || user?.fullName || '',
          refundMethod: loadedRefundAcc.refundMethod || 'ORIGINAL_PAYMENT_METHOD',
          bankName: loadedRefundAcc.bankName || '',
          accountNumber: '',
          iban: '',
        });
      } else if (user) {
        setAccountFormData((prev) => ({
          ...prev,
          accountHolderName: user.fullName || '',
        }));
      }

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
        if (targetApp && (targetApp.status === 'Accepted' || targetApp.status === 'Eligible - Payment Pending' || targetApp.eligibilityStatus === 'Eligible')) {
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

      // Default: select the first active payable invoice if available
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

      if (!targetToSelect) {
        const firstAcceptedApp = loadedApps.find(
          (a) => a.status === 'Accepted' || a.status === 'Eligible - Payment Pending' || a.eligibilityStatus === 'Eligible'
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

  // Handle return from Paymob / Gateway session with polling verification
  useEffect(() => {
    const sessionId = searchParams.get('session_id') || searchParams.get('order_id') || searchParams.get('id');
    const successParam = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');

    let isMounted = true;
    let pollTimeoutId = null;

    if (cancelled === 'true') {
      setPaymentSessionFlow('cancelled');
      setFlowDetails({
        title: isAr ? 'تم إلغاء جلسة الدفع' : 'Payment Session Cancelled',
        message: isAr
          ? 'تم إلغاء عملية الدفع ولم يتم خصم أي مبالغ. يظل حجزك المقبول متاحاً لإعادة المحاولة قبل انتهاء المهلة.'
          : 'Payment session was cancelled. No charges were made. Your reservation remains open to retry before the deadline.',
      });
    } else if (sessionId) {
      setPaymentSessionFlow('processing');
      setFlowDetails({
        title: isAr ? 'جاري التحقق من حالة السداد...' : 'Verifying Payment Settlement...',
        message: isAr
          ? 'جاري تأكيد معاملتك المالية مع بوابة السداد الإلكتروني المعتمدة لوكالة الفضاء المصرية. يرجى الانتظار...'
          : 'Confirming your transaction with the Egyptian Space Agency payment gateway. Please wait a moment...',
      });

      let attempts = 0;
      const maxAttempts = 6;

      const pollStatus = async () => {
        if (!isMounted) return;
        try {
          attempts++;
          setPollAttempt(attempts);
          const res = await paymentService.getSessionStatus(sessionId);
          if (!isMounted) return;

          if (res.isSettled || res.status === 'Paid') {
            setPaymentSessionFlow('confirmed');
            setFlowDetails({
              title: isAr ? 'تم تأكيد الدفع بنجاح!' : 'Payment Confirmed Successfully!',
              message: isAr
                ? 'تم استلام المبلغ وتأكيد التحاقك بالبرنامج التدريبي. تم فتح جميع محتويات التدريب في منصتك.'
                : 'Payment has been settled and verified. Your training program enrollment is finalized!',
              invoice: res.invoice,
              transaction: res.transaction,
              course: res.invoice?.course,
              cohort: res.invoice?.cohort,
              packageType: res.transaction?.packageType || res.invoice?.packageType,
              amount: res.transaction?.amount || res.invoice?.amount,
              currency: res.transaction?.currency || res.invoice?.currency || 'EGP',
              paidAt: res.transaction?.paymentDate || res.invoice?.paidAt || new Date().toISOString(),
            });
            await loadData();
          } else if (res.status === 'Requires_Refund') {
            setPaymentSessionFlow('requires_refund');
            setFlowDetails({
              title: isAr ? 'تنبيه: سداد بعد انتهاء المهلة' : 'Late Payment Detected',
              message: isAr
                ? 'تم استلام الدفعة بعد انتهاء مهلة الـ 72 ساعة المقررة وإلغاء حجز المقعد. تم تسجيل المعاملة للمراجعة المالية من قبل إدارة الأكاديمية.'
                : 'Payment arrived after the 72-hour deadline and reservation expiration. It has been safely recorded for administrative reconciliation.',
              transaction: res.transaction,
              invoice: res.invoice,
            });
            await loadData();
          } else if (res.status === 'Failed') {
            setPaymentSessionFlow('failed');
            setFlowDetails({
              title: isAr ? 'فشلت عملية الدفع' : 'Payment Failed',
              message: isAr
                ? 'تم رفض عملية السداد من جهة إصدار البطاقة. لم يتم خصم أي مبالغ. يمكنك إعادة المحاولة قبل انتهاء المهلة المحددة.'
                : 'Payment was declined by the issuer. No charges were made. You can retry before your reservation deadline.',
              failureReason: res.transaction?.failureReason || (isAr ? 'تم رفض البطاقة من قبل جهة الإصدار.' : 'Card declined by issuer.'),
              transaction: res.transaction,
              invoice: res.invoice,
            });
            await loadData();
          } else if (res.status === 'Cancelled') {
            setPaymentSessionFlow('cancelled');
            setFlowDetails({
              title: isAr ? 'تم إلغاء الجلسة' : 'Session Expired or Cancelled',
              message: isAr
                ? 'انتهت صلاحية جلسة السداد السابقة. يمكنك بدء جلسة دفع جديدة.'
                : 'The previous checkout session has expired. You can initiate a new payment attempt.',
              transaction: res.transaction,
              invoice: res.invoice,
            });
            await loadData();
          } else if (attempts < maxAttempts) {
            pollTimeoutId = setTimeout(pollStatus, 2500);
          } else {
            setPaymentSessionFlow('timeout');
            setFlowDetails({
              title: isAr ? 'المعاملة قيد المعالجة بالبنك' : 'Payment Processing',
              message: isAr
                ? 'تم استلام طلب السداد وجاري معالجته عبر البنك. يرجى تحديث الصفحة بعد قليل لمراجعة حالة الفاتورة.'
                : 'Your payment was received and is processing. Please refresh this page shortly to view the confirmed status.',
              transaction: res.transaction,
              invoice: res.invoice,
            });
            await loadData();
          }
        } catch (err) {
          if (!isMounted) return;
          setPaymentSessionFlow('failed');
          setFlowDetails({
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

    return () => {
      isMounted = false;
      if (pollTimeoutId) clearTimeout(pollTimeoutId);
    };
  }, [searchParams]);

  // Execute Payment Initiation Lifecycle (Initializes Paymob Secure Checkout)
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
      const data = initRes.data || {};
      const targetIframeUrl = data.iframeUrl;
      const targetPaymentUrl = data.paymentUrl || data.redirectUrl;

      // Safe diagnostic logging in DEVELOPMENT ONLY (Never logs tokens, secrets, or keys)
      if (import.meta.env.DEV) {
        let iframeHostname = '';
        let iframePath = '';
        try {
          if (targetIframeUrl) {
            const parsed = new URL(targetIframeUrl, window.location.origin);
            iframeHostname = parsed.hostname;
            iframePath = parsed.pathname;
          }
        } catch {
          // ignore url parse error
        }

        console.info('[Payment Diagnostic]', {
          provider: data.provider || (data.isMock ? 'DEVELOPMENT_MOCK' : 'PAYMOB'),
          transactionId: data.transaction?.transactionId || data.transactionId || 'N/A',
          invoiceId: payload.invoiceId || data.invoice?._id || 'N/A',
          providerOrderId: data.orderId || data.transaction?.providerOrderId || 'N/A',
          iframeUrlHostname: iframeHostname,
          iframeUrlPath: iframePath,
        });
      }

      if (!targetIframeUrl && !targetPaymentUrl) {
        throw new Error(
          initRes.message ||
            (isAr
              ? 'لم يتم استلام رابط جلسة الدفع من البوابة. يرجى المحاولة مرة أخرى أو التواصل مع إدارة الأكاديمية.'
              : 'Failed to obtain a secure payment gateway session. Please try again or contact administration.')
        );
      }

      // Defensive check before accepting checkout URLs to prevent self-embedding recursion
      const chosenCheckoutUrl = targetIframeUrl || targetPaymentUrl;
      let isInvalidCheckout = false;
      try {
        const parsed = new URL(chosenCheckoutUrl, window.location.origin);
        const isEgsaHost = parsed.hostname === window.location.hostname || parsed.host === window.location.host;
        const isPaymentsPath = parsed.pathname === '/student/payments' || parsed.pathname === '/student/payments/';

        if (isPaymentsPath) {
          isInvalidCheckout = true;
        } else if (!data.isMock && isEgsaHost) {
          isInvalidCheckout = true;
        }
      } catch {
        if (chosenCheckoutUrl?.includes('/student/payments') && !chosenCheckoutUrl?.includes('/mock-checkout')) {
          isInvalidCheckout = true;
        }
      }

      if (isInvalidCheckout) {
        if (import.meta.env.DEV) {
          console.warn('[Payment Guard] Blocked self-embedding payment URL: /student/payments');
        }
        throw new Error(
          isAr
            ? 'بوابة الدفع غير مهيأة بشكل صحيح. يرجى المحاولة لاحقاً.'
            : 'Payment gateway is not configured correctly. Please try again later.'
        );
      }

      setEmbeddedCheckout({
        iframeUrl: targetIframeUrl || targetPaymentUrl,
        paymentUrl: targetPaymentUrl || targetIframeUrl,
        orderId: data.orderId || data.transaction?.providerOrderId,
        transactionId: data.transaction?.transactionId,
        provider: data.provider || (data.isMock ? 'DEVELOPMENT_MOCK' : 'PAYMOB'),
        isMock: data.isMock,
        notice: data.notice,
      });

      setCheckoutStep('embedded_ready');
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

  // Save student refund account details
  const handleSaveRefundAccount = async (e) => {
    e.preventDefault();
    setAccountSaving(true);
    setAccountError('');
    try {
      const res = await paymentService.saveRefundAccount(accountFormData);
      setRefundAccount(res.data);
      setShowAccountModal(false);
    } catch (err) {
      setAccountError(
        err.response?.data?.message ||
          (isAr ? 'فشل حفظ تفاصيل حساب الاسترداد.' : 'Failed to save refund account details.')
      );
    } finally {
      setAccountSaving(false);
    }
  };

  // Submit student refund request
  const handleOpenRefundModal = (inv) => {
    setRefundTargetInvoice(inv);
    setRefundReason('');
    setRefundAmountInput(inv.amount || '');
    setRefundModalError('');
  };

  const handleSubmitRefundRequest = async (e) => {
    e.preventDefault();
    if (!refundTargetInvoice) return;
    setRefundSubmitting(true);
    setRefundModalError('');

    try {
      await paymentService.requestRefund(refundTargetInvoice._id, {
        amount: Number(refundAmountInput) || refundTargetInvoice.amount,
        reason: refundReason,
      });
      setRefundTargetInvoice(null);
      await loadData();
      setActiveTab('refunds');
    } catch (err) {
      setRefundModalError(
        err.response?.data?.message ||
          (isAr ? 'تعذر تقديم طلب الاسترداد.' : 'Failed to submit refund request.')
      );
    } finally {
      setRefundSubmitting(false);
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

      {/* 2. Gateway Return Feedback & Verification States */}
      {paymentSessionFlow && (
        <div className="card border-0 shadow-sm mb-5 overflow-hidden">
          {paymentSessionFlow === 'processing' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-info">
              <div className="spinner-border text-primary mb-3" style={{ width: '3.5rem', height: '3.5rem' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h4 className="fw-bold text-dark mb-2">
                {flowDetails?.title || (isAr ? 'جاري التحقق من عملية السداد...' : 'Verifying Payment Settlement...')}
              </h4>
              <p className="text-muted small mb-3 mx-auto" style={{ maxWidth: '540px' }}>
                {flowDetails?.message}
              </p>
              <div className="badge bg-info-subtle text-info p-2 px-3 small">
                <i className="fa-solid fa-arrows-rotate fa-spin me-2"></i>
                {isAr ? `فحص حالة السداد مع البوابة (المحاولة ${pollAttempt} من ٦)…` : `Checking payment gateway confirmation (Attempt ${pollAttempt} of 6)…`}
              </div>
            </div>
          )}

          {paymentSessionFlow === 'confirmed' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-success">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3"
                style={{ width: '64px', height: '64px' }}
              >
                <i className="fa-solid fa-circle-check fs-2"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <div className="d-flex justify-content-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4"
                  onClick={() => {
                    dismissFlowState();
                    setReceiptData({
                      invoice: flowDetails.invoice,
                      transaction: flowDetails.transaction,
                      course: flowDetails.course,
                      cohort: flowDetails.cohort,
                      packageType: flowDetails.packageType,
                      amount: flowDetails.amount,
                      currency: flowDetails.currency,
                      paidAt: flowDetails.paidAt,
                    });
                  }}
                >
                  <i className="fa-solid fa-receipt me-1"></i> {isAr ? 'عرض الإيصال الرسمي' : 'View Official Receipt'}
                </button>
                <Link to="/student/training" className="btn btn-outline-primary btn-sm px-4">
                  <i className="fa-solid fa-graduation-cap me-1"></i> {isAr ? 'بدء التدريب' : 'Go to Training'}
                </Link>
              </div>
            </div>
          )}

          {paymentSessionFlow === 'failed' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-danger">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger mb-3"
                style={{ width: '64px', height: '64px' }}
              >
                <i className="fa-solid fa-circle-xmark fs-2"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-danger small mb-3">{flowDetails?.failureReason}</p>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <button type="button" className="btn btn-primary btn-sm px-4" onClick={dismissFlowState}>
                {isAr ? 'العودة لنموذج السداد' : 'Return to Payment'}
              </button>
            </div>
          )}

          {paymentSessionFlow === 'cancelled' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-warning">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning mb-3"
                style={{ width: '64px', height: '64px' }}
              >
                <i className="fa-solid fa-clock-rotate-left fs-2"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <button type="button" className="btn btn-primary btn-sm px-4" onClick={dismissFlowState}>
                {isAr ? 'إعادة المحاولة' : 'Try Again'}
              </button>
            </div>
          )}

          {paymentSessionFlow === 'requires_refund' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-warning">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning mb-3"
                style={{ width: '64px', height: '64px' }}
              >
                <i className="fa-solid fa-triangle-exclamation fs-2"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <button type="button" className="btn btn-outline-secondary btn-sm px-4" onClick={dismissFlowState}>
                {isAr ? 'إغلاق التنبيه' : 'Dismiss'}
              </button>
            </div>
          )}

          {paymentSessionFlow === 'timeout' && (
            <div className="card-body p-4 p-md-5 text-center bg-white border-top border-4 border-secondary">
              <h4 className="fw-bold text-dark mb-2">{flowDetails?.title}</h4>
              <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '560px' }}>
                {flowDetails?.message}
              </p>
              <button type="button" className="btn btn-primary btn-sm px-4" onClick={dismissFlowState}>
                {isAr ? 'حسناً، تم الاطلاع' : 'OK, Understood'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. POLICY BANNER & REFUND DESTINATION SUMMARY */}
      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="alert alert-info border-0 shadow-sm d-flex align-items-center gap-3 p-3 rounded mb-0 h-100">
            <i className="fa-solid fa-shield-halved fs-3 text-primary flex-shrink-0"></i>
            <div className="flex-grow-1">
              <h6 className="fw-bold text-dark mb-1">
                {isAr ? 'سياسة الاسترداد الرسمية لوكالة الفضاء المصرية' : 'Official EGSA Academy Refund Policy'}
              </h6>
              <p className="small text-muted mb-1">
                {isAr
                  ? 'تخضع كافة طلبات الاسترداد لمراجعة الإدارة المالية. في حال إلغاء الدورة من قبل الوكالة، يحق للطالب استرداد كامل المصروفات. يرجى التحقق من بيانات حساب الاسترداد قبل السداد.'
                  : 'Refunds are subject to administrative review. If a course is cancelled by the Academy, students receive a full refund. Please verify your refund account destination before paying.'}
              </p>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-primary text-decoration-none fw-bold"
                onClick={() => setShowPolicyModal(true)}
              >
                <i className="fa-solid fa-book-open me-1"></i>
                {isAr ? 'قراءة السياسة المالية المعتمدة كاملاً' : 'Read Full Refund Policy & Guidelines'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="p-3 bg-white rounded border shadow-sm h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="small text-uppercase fw-bold text-muted">
                  <i className="fa-solid fa-building-columns me-1 text-primary"></i>
                  {isAr ? 'حساب الاسترداد المسجل' : 'Refund Account'}
                </span>
                <span className="badge bg-success-subtle text-success small">
                  {isAr ? 'معتمد' : 'Verified'}
                </span>
              </div>
              <p className="small text-dark mb-1 fw-semibold">
                {refundAccount?.refundMethod === 'BANK_TRANSFER'
                  ? `${refundAccount.bankName || 'Bank'} (${refundAccount.maskedIban || refundAccount.maskedAccount || 'N/A'})`
                  : (isAr ? 'نفس بطاقة الدفع الأصلية' : 'Original Payment Card')}
              </p>
              <small className="text-muted d-block text-truncate">
                {isAr ? 'المستفيد: ' : 'Holder: '}
                {refundAccount?.accountHolderName || user?.fullName || 'EGSA Student'}
              </small>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mt-2 w-100"
              onClick={() => setShowAccountModal(true)}
            >
              <i className="fa-solid fa-pen-to-square me-1"></i>
              {isAr ? 'تعديل تفاصيل حساب الاسترداد' : 'Update Refund Destination'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {/* 4. ACTIVE COURSE PAYMENT FORM & CUSTOM CARD CHECKOUT INTERFACE */}
      {checkoutTarget && !['processing', 'confirmed'].includes(paymentSessionFlow) ? (
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
                  {isAr ? 'بوابة سداد مشفرة وفقاً لمعايير وكالة الفضاء المصرية والبنك المركزي' : 'Secure Card Payment Interface — Central Bank of Egypt Regulated'}
                </small>
              </div>
            </div>

            {payableInvoices.length > 1 && (
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">{isAr ? 'اختر الفاتورة:' : 'Select Invoice:'}</span>
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

            {/* If embedded payment session is ready, display the secure card interface container */}
            {embeddedCheckout && checkoutStep === 'embedded_ready' ? (
              <div className="mb-4">
                <div className="alert alert-success d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div>
                    <i className="fa-solid fa-lock me-2"></i>
                    <strong>{isAr ? 'جلسة دفع آمنة جاهزة' : 'Secure Payment Session Ready'}</strong>
                    <span className="ms-2 small text-muted">
                      ({isAr ? 'المرجع:' : 'Order Ref:'} {embeddedCheckout.orderId})
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setEmbeddedCheckout(null)}
                  >
                    <i className="fa-solid fa-arrow-left me-1"></i> {isAr ? 'تغيير الباقة' : 'Back to Options'}
                  </button>
                </div>

                <div className="card border border-2 border-primary shadow-sm overflow-hidden rounded">
                  <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-2 px-3">
                    <span className="small d-flex align-items-center gap-2">
                      <i className={`fa-solid ${embeddedCheckout.isMock ? 'fa-flask text-warning' : 'fa-shield-halved text-success'}`}></i>
                      <span>
                        {embeddedCheckout.isMock
                          ? (isAr ? 'بيئة سداد تجريبية (محاكاة محلية)' : 'Development Sandbox Card Simulation')
                          : (isAr ? 'نافذة سداد البطاقة المشفرة (PCI-DSS)' : 'PCI-DSS Compliant Secure Card Checkout')}
                      </span>
                    </span>
                    <a
                      href={embeddedCheckout.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-light py-0 px-2 small"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>
                      {isAr ? 'فتح في نافذة كاملة' : 'Open in New Tab'}
                    </a>
                  </div>

                  <div className="card-body p-0 bg-white" style={{ minHeight: '580px' }}>
                    {(() => {
                      let isSelfEmbed = false;
                      try {
                        const parsed = new URL(embeddedCheckout.iframeUrl, window.location.origin);
                        const isEgsaHost = parsed.hostname === window.location.hostname || parsed.host === window.location.host;
                        const isPaymentsPath = parsed.pathname === '/student/payments' || parsed.pathname === '/student/payments/';

                        if (isPaymentsPath) {
                          isSelfEmbed = true;
                        } else if (!embeddedCheckout.isMock && isEgsaHost) {
                          isSelfEmbed = true;
                        }
                      } catch {
                        if (embeddedCheckout.iframeUrl?.includes('/student/payments') && !embeddedCheckout.iframeUrl?.includes('/mock-checkout')) {
                          isSelfEmbed = true;
                        }
                      }

                      if (isSelfEmbed) {
                        return (
                          <div className="p-5 text-center">
                            <div className="alert alert-danger d-inline-block text-start p-4 shadow-sm" role="alert" style={{ maxWidth: '520px' }}>
                              <h6 className="alert-heading fw-bold d-flex align-items-center gap-2 text-danger">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                {isAr ? 'تنبيه أمان البوابة' : 'Gateway Configuration Guard'}
                              </h6>
                              <p className="mb-0 text-dark small">
                                {isAr
                                  ? 'بوابة الدفع غير مهيأة بشكل صحيح. يرجى المحاولة لاحقاً.'
                                  : 'Payment gateway is not configured correctly. Please try again later.'}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <iframe
                          src={embeddedCheckout.iframeUrl}
                          title="EGSA Secure Card Payment Form"
                          width="100%"
                          height="600"
                          frameBorder="0"
                          className="w-100"
                          style={{ border: 'none', display: 'block' }}
                        />
                      );
                    })()}
                  </div>

                  <div className="card-footer bg-light py-2 px-3 small text-muted d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span>
                      <i className="fa-solid fa-building-columns me-1 text-primary"></i>
                      {embeddedCheckout.isMock
                        ? (isAr ? 'محاكاة دفع محلية لأغراض التطوير والاختبار' : 'Local Sandbox Mock Payment Provider')
                        : (isAr ? 'معالجة مالية معتمدة وفقاً للبنك المركزي المصري' : 'Egyptian Space Agency — Licensed Egyptian Payment Gateway')}
                    </span>
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-muted"
                      onClick={() => setEmbeddedCheckout(null)}
                    >
                      {isAr ? 'إلغاء والعودة' : 'Cancel Transaction'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Course Details, Package Options & Review */
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
                      <span>{isAr ? 'بوابة سداد مشفرة وفقاً لمعايير وكالة الفضاء المصرية' : 'PCI-DSS Level 1 Secure Egyptian Gateway Checkout'}</span>
                    </span>
                    <span className="badge bg-primary-subtle text-primary small">
                      EGSA SECURE CHECKOUT
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

                      {/* Refund Destination Notice */}
                      <div className="p-2 px-3 bg-white border rounded small text-muted mb-3">
                        <i className="fa-solid fa-circle-info text-info me-1"></i>
                        <span>
                          {isAr
                            ? `وجهة الاسترداد المسجلة: ${refundAccount?.accountHolderName || user?.fullName} (${refundAccount?.refundMethod === 'BANK_TRANSFER' ? refundAccount.bankName : 'البطاقة الأصلية'}).`
                            : `Refund destination: ${refundAccount?.accountHolderName || user?.fullName} (${refundAccount?.refundMethod === 'BANK_TRANSFER' ? refundAccount.bankName : 'Original Card'}).`}
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
                        {checkoutStep === 'initiating' ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            <span>{isAr ? 'جاري تجهيز جلسة الدفع المشفرة…' : 'Preparing Secure Card Checkout…'}</span>
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
                        <i className="fa-solid fa-shield-halved me-1 text-success"></i>
                        {isAr
                          ? 'تتم معالجة بيانات بطاقتك الائتمانية بأمان عبر بوابة السداد المشفرة المتوافقة مع معايير PCI-DSS.'
                          : 'Card details are securely encrypted and processed by an authorized PCI-DSS Level 1 payment gateway.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : invoices.length > 0 ? (
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
          <li className="nav-item">
            <button
              className={`nav-link btn-sm ${activeTab === 'refunds' ? 'active bg-primary text-white' : 'text-muted'}`}
              onClick={() => setActiveTab('refunds')}
            >
              {isAr ? 'طلبات الاسترداد' : 'Refund Requests'} ({myRefunds.length})
            </button>
          </li>
        </ul>

        <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
          <i className="fa-solid fa-arrows-rotate me-1"></i> {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* 6. TAB CONTENT: REFUND REQUESTS OR INVOICES LIST */}
      {activeTab === 'refunds' ? (
        <div className="egsa-card p-4 mb-5 shadow-sm bg-white rounded border">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">
              <i className="fa-solid fa-rotate-left me-2 text-primary"></i>
              {isAr ? 'سجل طلبات استرداد المصروفات' : 'My Refund Requests Ledger'}
            </h5>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => setShowPolicyModal(true)}
            >
              <i className="fa-solid fa-book me-1"></i>
              {isAr ? 'مراجعة السياسة' : 'View Policy'}
            </button>
          </div>

          {myRefunds.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fa-solid fa-clipboard-check fs-2 mb-2 d-block text-secondary"></i>
              <p className="mb-0">{isAr ? 'لا توجد طلبات استرداد مقدمة حالياً.' : 'You have not submitted any refund requests.'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th>{isAr ? 'رقم الطلب' : 'Request #'}</th>
                    <th>{isAr ? 'الدورة التدريبية' : 'Course'}</th>
                    <th>{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th>{isAr ? 'وجهة الاسترداد' : 'Destination'}</th>
                    <th>{isAr ? 'الحالة' : 'Status'}</th>
                    <th>{isAr ? 'تاريخ التقديم' : 'Date'}</th>
                    <th>{isAr ? 'ملاحظات الإدارة' : 'Decision Notes'}</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {myRefunds.map((rf) => (
                    <tr key={rf._id}>
                      <td className="fw-bold text-primary">{rf.refundNumber}</td>
                      <td>{rf.course?.title || 'Course'}</td>
                      <td className="fw-bold text-dark">
                        {rf.amount?.toLocaleString()} {rf.currency || 'EGP'}
                      </td>
                      <td>
                        {rf.refundDestination?.refundMethod === 'BANK_TRANSFER'
                          ? `${rf.refundDestination.bankName || 'Bank'} (${rf.refundDestination.maskedIban || rf.refundDestination.maskedAccount})`
                          : (isAr ? 'البطاقة الأصلية' : 'Original Card')}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            rf.status === 'Refunded'
                              ? 'bg-success'
                              : rf.status === 'Approved'
                              ? 'bg-info'
                              : rf.status === 'Rejected'
                              ? 'bg-danger'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {rf.status}
                        </span>
                      </td>
                      <td>{new Date(rf.createdAt).toLocaleDateString()}</td>
                      <td className="text-muted">
                        {rf.adminDecision?.decisionNote || (rf.status === 'Pending Review' ? (isAr ? 'قيد المراجعة المالية' : 'Under Review') : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : filteredInvoices.length === 0 && !error ? (
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
                  <div className="pt-3 border-top mt-auto d-flex gap-2 flex-wrap">
                    {isPaid ? (
                      <>
                        <button
                          className="btn btn-outline-secondary btn-sm flex-grow-1"
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

                        <button
                          className="btn btn-outline-warning btn-sm"
                          onClick={() => handleOpenRefundModal(inv)}
                          title={isAr ? 'طلب استرداد المصروفات' : 'Request Tuition Refund'}
                        >
                          <i className="fa-solid fa-rotate-left me-1"></i>
                          {isAr ? 'طلب استرداد' : 'Request Refund'}
                        </button>
                      </>
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

      {/* 8. OFFICIAL EGSA REFUND POLICY MODAL */}
      {showPolicyModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 rounded">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-shield-halved me-2 text-primary"></i>
                  {isAr ? 'السياسة المالية الرسمية لاسترداد المصروفات — وكالة الفضاء المصرية' : 'EGSA Space Academy Official Refund Policy'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowPolicyModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4 small" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="alert alert-warning py-2 mb-3">
                  <i className="fa-solid fa-triangle-exclamation me-1"></i>
                  {isAr
                    ? 'تخضع كافة طلبات الاسترداد لمراجعة الإدارة المالية واللجنة الأكاديمية لوكالة الفضاء المصرية وفقاً للشروط المعتمدة أدناه.'
                    : 'All refund applications are strictly subject to review by EGSA Academy Administration and authorized finance verification.'}
                </div>

                <h6 className="fw-bold text-dark">{isAr ? '١. مبادئ الاسترداد العامة:' : '1. General Principles:'}</h6>
                <ul className="text-muted mb-3">
                  <li>
                    {isAr
                      ? 'لا يعتبر مجرد تقديم طلب الاسترداد موافقة تلقائية على إعادة الأموال.'
                      : 'Submitting a refund request does not automatically guarantee financial approval.'}
                  </li>
                  <li>
                    {isAr
                      ? 'يتم تقييم كل طلب وفقاً لتواريخ الحجز، جدول الجلسات التدريبية، وأسباب الإلغاء.'
                      : 'Each request is audited based on registration timelines, cohort schedules, and documented justification.'}
                  </li>
                  <li>
                    {isAr
                      ? 'لا تسجل أية عملية استرداد على أنها منتهية إلا بعد تأكيد التحويل المالي الفعلي من البوابة أو التحويل البنكي.'
                      : 'A refund is never recorded as settled until verified confirmation is received from the payment provider or banking institution.'}
                  </li>
                </ul>

                <h6 className="fw-bold text-dark">{isAr ? '٢. قاعدة الـ ٧٢ ساعة وإلغاء البرامج:' : '2. 72-Hour Rule & Academy Cancellations:'}</h6>
                <ul className="text-muted mb-3">
                  <li>
                    {isAr
                      ? 'إذا تم إلغاء البرنامج التدريبي بقرار رسمي من وكالة الفضاء المصرية، يستحق الطالب استرداداً كاملاً (١٠٠٪) دون أية استقطاعات.'
                      : 'If a training program is cancelled by the Egyptian Space Agency, enrolled students receive a full 100% refund.'}
                  </li>
                  <li>
                    {isAr
                      ? 'الانسحاب قبل ٧٢ ساعة من بدء الدورة يخضع لسياسة المراجعة الإدارية.'
                      : 'Withdrawal prior to 72 hours before program commencement is subject to administrative review.'}
                  </li>
                  <li>
                    {isAr
                      ? 'المبالغ المسددة بعد انتهاء المهلة المحددة (٧٢ ساعة) تحال تلقائياً للمطابقة والتسوية المالية.'
                      : 'Payments received after reservation expiration are held for manual reconciliation and refund review.'}
                  </li>
                </ul>

                <h6 className="fw-bold text-dark">{isAr ? '٣. طرق التحويل وأمان البيانات:' : '3. Refund Methods & Data Privacy:'}</h6>
                <ul className="text-muted mb-0">
                  <li>
                    {isAr
                      ? 'تُعاد الأموال المفضلة إلى نفس بطاقة الدفع الأصلية عبر البوابة الإلكترونية، أو لحساب بنكي معتمد باسم الطالب.'
                      : 'Refunds are returned to the original payment method where supported, or via approved bank transfer to a verified account.'}
                  </li>
                  <li>
                    {isAr
                      ? 'تُشفر كافة بيانات الحسابات البنكية بتقنية AES-256-GCM وتُحجب في واجهات العرض حفاظاً على الخصوصية.'
                      : 'Sensitive bank account and IBAN identifiers are encrypted at rest using AES-256-GCM and masked in all displays.'}
                  </li>
                </ul>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4"
                  onClick={() => setShowPolicyModal(false)}
                >
                  {isAr ? 'فهمت الشروط وأوافق عليها' : 'I Understand & Acknowledge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. UPDATE REFUND DESTINATION MODAL */}
      {showAccountModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded">
              <form onSubmit={handleSaveRefundAccount}>
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title fw-bold">
                    <i className="fa-solid fa-building-columns me-2"></i>
                    {isAr ? 'تفاصيل حساب الاسترداد المعتمد' : 'Refund Account Destination Details'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowAccountModal(false)}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  {accountError && <div className="alert alert-danger small p-2 mb-3">{accountError}</div>}

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {isAr ? 'اسم صاحب الحساب بالكامل (مطابق لبطاقة الرقم القومي):' : 'Account Holder Full Legal Name:'}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      value={accountFormData.accountHolderName}
                      onChange={(e) => setAccountFormData({ ...accountFormData, accountHolderName: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {isAr ? 'طريقة الاسترداد المفضلة:' : 'Preferred Refund Method:'}
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={accountFormData.refundMethod}
                      onChange={(e) => setAccountFormData({ ...accountFormData, refundMethod: e.target.value })}
                    >
                      <option value="ORIGINAL_PAYMENT_METHOD">
                        {isAr ? 'البطاقة الأصلية المستخدمة في السداد (تلقائي)' : 'Original Payment Method (Card)'}
                      </option>
                      <option value="BANK_TRANSFER">
                        {isAr ? 'تحويل بنكي رسمي إلى حساب بنكي / IBAN' : 'Bank Transfer (IBAN / Bank Account)'}
                      </option>
                    </select>
                  </div>

                  {accountFormData.refundMethod === 'BANK_TRANSFER' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label small fw-bold">
                          {isAr ? 'اسم البنك:' : 'Bank Name:'}
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. National Bank of Egypt (NBE) / CIB / Banque Misr"
                          required
                          value={accountFormData.bankName}
                          onChange={(e) => setAccountFormData({ ...accountFormData, bankName: e.target.value })}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold">
                          {isAr ? 'رقم الحساب البنكي أو الـ IBAN:' : 'IBAN or Bank Account Number:'}
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. EG3800020001000000123456789"
                          required
                          value={accountFormData.iban || accountFormData.accountNumber}
                          onChange={(e) =>
                            setAccountFormData({
                              ...accountFormData,
                              iban: e.target.value,
                              accountNumber: e.target.value,
                            })
                          }
                        />
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                          <i className="fa-solid fa-lock text-success me-1"></i>
                          {isAr
                            ? 'يتم تشفير هذا الرقم مباشرة بتقنية AES-256 ولن يظهر كاملاً لأي جهة غير مصرح لها.'
                            : 'This identifier is securely encrypted at rest using AES-256 and will never be displayed in plain text.'}
                        </small>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowAccountModal(false)}
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4"
                    disabled={accountSaving}
                  >
                    {accountSaving ? (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    ) : null}
                    {isAr ? 'حفظ وتأكيد البيانات' : 'Save & Confirm Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 10. STUDENT SUBMIT REFUND REQUEST MODAL */}
      {refundTargetInvoice && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded">
              <form onSubmit={handleSubmitRefundRequest}>
                <div className="modal-header bg-warning text-dark">
                  <h5 className="modal-title fw-bold">
                    <i className="fa-solid fa-rotate-left me-2"></i>
                    {isAr ? 'تقديم طلب استرداد المصروفات الدراسية' : 'Submit Tuition Refund Request'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setRefundTargetInvoice(null)}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  {refundModalError && <div className="alert alert-danger small p-2 mb-3">{refundModalError}</div>}

                  <div className="p-3 bg-light rounded small mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">{isAr ? 'الدورة التدريبية:' : 'Course:'}</span>
                      <strong className="text-dark">{refundTargetInvoice.course?.title}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">{isAr ? 'رقم الفاتورة:' : 'Invoice #:'}</span>
                      <strong className="text-dark">{refundTargetInvoice.invoiceNumber}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">{isAr ? 'المبلغ المسدد:' : 'Amount Paid:'}</span>
                      <strong className="text-primary fs-6">
                        {refundTargetInvoice.amount?.toLocaleString()} {refundTargetInvoice.currency || 'EGP'}
                      </strong>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {isAr ? 'المبلغ المطلوب استرداده (ج.م):' : 'Requested Refund Amount (EGP):'}
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      max={refundTargetInvoice.amount}
                      min={1}
                      required
                      value={refundAmountInput}
                      onChange={(e) => setRefundAmountInput(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      {isAr ? 'سبب طلب الاسترداد والتفاصيل:' : 'Reason for Refund Request:'}
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      required
                      placeholder={
                        isAr
                          ? 'يرجى توضيح سبب الرغبة في الانسحاب أو الاسترداد بالتفصيل لمراجعة الإدارة المالية…'
                          : 'Please specify the detailed justification for this refund request for administrative review…'
                      }
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                    />
                  </div>

                  <div className="p-2 px-3 bg-light border rounded small text-muted">
                    <i className="fa-solid fa-circle-check text-success me-1"></i>
                    {isAr
                      ? `سيتم التحويل في حال الموافقة إلى: ${refundAccount?.accountHolderName || user?.fullName} (${refundAccount?.refundMethod === 'BANK_TRANSFER' ? refundAccount.bankName : 'البطاقة الأصلية'}).`
                      : `If approved, the amount will be sent to: ${refundAccount?.accountHolderName || user?.fullName} (${refundAccount?.refundMethod === 'BANK_TRANSFER' ? refundAccount.bankName : 'Original Card'}).`}
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setRefundTargetInvoice(null)}
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning btn-sm px-4 fw-bold"
                    disabled={refundSubmitting}
                  >
                    {refundSubmitting ? (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    ) : null}
                    {isAr ? 'إرسال الطلب للمراجعة' : 'Submit for Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
