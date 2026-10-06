const Invoice = require('../models/Invoice');
const PaymentTransaction = require('../models/PaymentTransaction');
const Course = require('../models/Course');
const Application = require('../models/Application');
const paymentService = require('../services/paymentService');
const { AppError } = require('../middleware/error');

/**
 * Returns all invoices and payment transactions for the authenticated student.
 * GET /api/payments/my
 */
async function myPayments(req, res, next) {
  try {
    await paymentService.processExpiredInvoices();
    const invoices = await Invoice.find({ student: req.user._id })
      .populate('course', 'title startDate price transportationPrice currency level')
      .populate('cohort', 'name startDate endDate')
      .populate('application', 'referenceNumber status selectedPackage')
      .sort({ createdAt: -1 });

    const invoiceIds = invoices.map((i) => i._id);
    const transactions = await PaymentTransaction.find({ invoice: { $in: invoiceIds } }).sort({ createdAt: -1 });
    const txMap = new Map();
    transactions.forEach((tx) => {
      const key = tx.invoice.toString();
      if (!txMap.has(key)) txMap.set(key, []);
      txMap.get(key).push(tx);
    });

    const enriched = invoices.map((inv) => {
      const obj = inv.toObject();
      obj.transactions = txMap.get(inv._id.toString()) || [];
      return obj;
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single invoice details for student (owner check) or admin.
 * GET /api/payments/invoices/:id
 */
async function getInvoiceDetails(req, res, next) {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('course', 'title startDate price transportationPrice currency level paymentPolicy refundPolicy')
      .populate('cohort', 'name startDate endDate')
      .populate('application', 'referenceNumber status selectedPackage submittedAt')
      .populate('student', 'fullName email phone registrationNumber');

    if (!invoice) {
      throw new AppError('Invoice not found.', 404);
    }

    const isOwner = req.user && req.user._id.toString() === invoice.student._id.toString();
    const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you do not have permission to view this invoice.', 403);
    }

    const transactions = await PaymentTransaction.find({ invoice: invoice._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        invoice,
        transactions,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Authoritative pricing calculator endpoint (never trusts frontend prices).
 * POST /api/payments/calculate
 */
async function calculatePrice(req, res, next) {
  try {
    const courseId = req.body?.courseId || req.query?.courseId;
    const cohortId = req.body?.cohortId || req.query?.cohortId;
    const packageType = req.body?.packageType || req.query?.packageType || 'WITHOUT_TRANSPORTATION';

    let course = null;
    if (courseId) {
      course = await Course.findById(courseId);
    } else if (cohortId) {
      const Cohort = require('../models/Cohort');
      const cohort = await Cohort.findById(cohortId).populate('course');
      course = cohort?.course;
    }

    if (!course) {
      throw new AppError('Valid courseId or cohortId is required.', 400);
    }

    const pricing = paymentService.calculatePricing(course, packageType);

    res.json({
      success: true,
      data: pricing,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Prepares an invoice for an accepted application.
 * POST /api/payments/prepare
 */
async function prepareInvoice(req, res, next) {
  try {
    const { applicationId, packageType } = req.body;
    if (!applicationId) {
      throw new AppError('applicationId is required.', 400);
    }

    const result = await paymentService.getOrCreateInvoiceForApplication({
      applicationId,
      studentId: req.user._id,
      packageType,
    });

    res.json({
      success: true,
      message: 'Invoice prepared successfully based on authoritative institutional pricing.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Initiates payment session with gateway adapter.
 * POST /api/payments/initiate
 * POST /api/payments/:invoiceId/initiate
 */
async function initiatePayment(req, res, next) {
  try {
    let invoiceId = req.params.invoiceId || req.body.invoiceId;
    const applicationId = req.body.applicationId;

    if (!invoiceId && applicationId) {
      const inv = await Invoice.findOne({ application: applicationId });
      if (inv) {
        invoiceId = inv._id;
      } else {
        const prepared = await paymentService.getOrCreateInvoiceForApplication({
          applicationId,
          studentId: req.user._id,
          packageType: req.body.packageType,
        });
        invoiceId = prepared?.invoice?._id;
      }
    }

    if (!invoiceId) {
      throw new AppError('invoiceId or applicationId is required.', 400);
    }

    const { packageType, method, returnUrl } = req.body;

    const result = await paymentService.initiatePayment({
      invoiceId,
      studentId: req.user._id,
      packageType,
      method: method || 'Card',
      returnUrl,
    });

    res.status(201).json({
      success: true,
      message: 'Payment session initiated with gateway provider.',
      data: {
        ...result,
        redirectUrl: result.paymentUrl || result.redirectUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies gateway transaction outcome against authoritative provider records.
 * POST /api/payments/verify
 * Note: Never trusts client-supplied provider payloads or statuses.
 */
async function verifyPayment(req, res, next) {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      throw new AppError('transactionId is required.', 400);
    }

    // Strictly authenticate ownership and let backend query provider directly
    const result = await paymentService.verifyAndFinalizePayment({
      transactionId,
      studentId: req.user._id,
    });

    res.json({
      success: result.success,
      message: result.success
        ? 'Payment verified and confirmed successfully! Enrollment finalized.'
        : `Payment verification failed: ${result.failureReason || 'Not settled.'}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Administrative offline payment settlement endpoint.
 * POST /api/payments/:invoiceId/pay
 * Strictly restricted to admin/superadmin for recording offline cash/bank-wire payments.
 * Direct student self-settlement without gateway verification is forbidden.
 */
async function payInvoice(req, res, next) {
  try {
    const isPrivileged = req.user && ['admin', 'superadmin'].includes(req.user.role);

    if (!isPrivileged) {
      throw new AppError('Direct student payment bypass is disabled. Tuition payments must be processed through the secure payment gateway.', 403);
    }

    const query = { _id: req.params.invoiceId };
    const invoice = await Invoice.findOne(query);
    if (!invoice) throw new AppError('Invoice not found.', 404);

    if (invoice.application) {
      const application = await Application.findById(invoice.application);
      if (application && !['Accepted', 'Eligible - Payment Pending'].includes(application.status)) {
        throw new AppError(`Payment not permitted: application status is ${application.status}. Applications must be accepted before payment.`, 400);
      }
    }

    if (['Paid', 'PAID'].includes(invoice.status)) {
      throw new AppError('Invoice has already been paid and settled.', 400);
    }

    if (['Cancelled', 'Overdue', 'Expired', 'Waived'].includes(invoice.status)) {
      throw new AppError(`Cannot pay an invoice that is ${invoice.status.toLowerCase()}. Please reapply or request a new invoice.`, 400);
    }

    if (invoice.dueDate && new Date() > new Date(invoice.dueDate) && invoice.amount > 0) {
      await paymentService.handleExpiredReservation(invoice);
      throw new AppError('The 72-hour payment deadline for this reservation has expired. Your seat has been released.', 400);
    }

    const { method, packageType } = req.body;
    const result = await paymentService.confirmPayment({ invoice, method: method || 'BankTransfer', packageType });

    res.json({
      success: true,
      message: 'Administrative payment confirmed successfully. Enrollment finalized.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: List all platform invoices and transactions.
 * GET /api/admin/payments
 */
async function adminList(req, res, next) {
  try {
    const data = await paymentService.adminListPayments(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Get detailed invoice & transaction audit history.
 * GET /api/admin/payments/:id
 */
async function adminGet(req, res, next) {
  try {
    const data = await paymentService.adminGetPaymentDetails(req.params.id);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Stripe Webhook Handler
 * POST /api/payments/webhook
 * Verifies cryptographic Stripe HMAC signature and idempotently confirms transaction.
 */
async function handleStripeWebhook(req, res, next) {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header.' });
  }

  if (!Buffer.isBuffer(req.rawBody)) {
    console.error('[STRIPE WEBHOOK ERROR] req.rawBody is missing or not a buffer.');
    return res.status(400).send('Webhook Error: raw body unavailable.');
  }

  const { getPaymentProvider } = require('../services/paymentProviders');
  const stripeProvider = getPaymentProvider('STRIPE');

  let event;
  try {
    event = stripeProvider.constructWebhookEvent(req.rawBody, sig);
  } catch (err) {
    console.error('[STRIPE WEBHOOK ERROR] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // 1. Verify session mode & status
        if (session.mode !== 'payment' || session.payment_status !== 'paid') {
          console.warn(`[STRIPE WEBHOOK] Ignored un-settled session: ${session.id}, status: ${session.payment_status}`);
          break;
        }

        // 2. Resolve transaction
        let transactionId = session.metadata?.transactionId;
        let tx = null;
        if (transactionId) {
          tx = await PaymentTransaction.findOne({ transactionId }).populate('invoice');
        }
        if (!tx) {
          tx = await PaymentTransaction.findOne({ stripeCheckoutSessionId: session.id }).populate('invoice');
        }

        if (!tx) {
          console.error(`[STRIPE WEBHOOK] Ignored: no transaction found for session ${session.id}`);
          break;
        }

        // 3. Idempotency check: if already settled as Paid, acknowledge immediately
        if (tx.status === 'Paid') {
          break;
        }

        // 4. Verify currency matches authoritative transaction
        const expectedCurrency = (tx.currency || 'EGP').toLowerCase();
        if (String(session.currency || '').toLowerCase() !== expectedCurrency) {
          console.error(`[STRIPE WEBHOOK] Currency mismatch for session ${session.id}: received ${session.currency}, expected ${expectedCurrency}`);
          break;
        }

        // 5. Verify amount matches authoritative transaction amount in minor units
        const expectedAmountMinor = Math.round(Number(tx.amount) * 100);
        if (Number(session.amount_total) !== expectedAmountMinor) {
          console.error(`[STRIPE WEBHOOK] Amount mismatch for session ${session.id}: received ${session.amount_total}, expected ${expectedAmountMinor}`);
          break;
        }

        // 6. Verify student metadata matches transaction student
        const txStudentId = tx.student?._id ? tx.student._id.toString() : tx.student?.toString();
        if (session.metadata?.studentId && txStudentId && session.metadata.studentId !== txStudentId) {
          console.error(`[STRIPE WEBHOOK] Student mismatch for session ${session.id}: metadata ${session.metadata.studentId} != ${txStudentId}`);
          break;
        }

        // 7. Check if invoice was already Overdue/Expired/Cancelled (Late payment handling)
        if (tx.invoice && ['Overdue', 'Expired', 'Cancelled'].includes(tx.invoice.status)) {
          console.error(`[STRIPE WEBHOOK] REQUIRES MANUAL REFUND: Late payment received for ${tx.invoice.status} invoice ${tx.invoice._id}`);
          tx.status = 'Requires_Refund';
          tx.failureReason = `Late payment received after invoice ${tx.invoice.status}. Seat was released; manual financial reconciliation required.`;
          tx.providerReference = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || session.id;
          await tx.save();
          break;
        }

        // 8. Atomically finalize payment and enrollment
        await paymentService.verifyAndFinalizePayment({
          transactionId: tx.transactionId,
          verifiedSession: session,
          providerReference: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || session.id,
          webhookEventId: event.id,
        });
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const tx = await PaymentTransaction.findOne({
          $or: [
            { stripeCheckoutSessionId: session.id },
            { transactionId: session.metadata?.transactionId },
          ],
        }).populate('invoice');

        if (tx && tx.status !== 'Paid') {
          tx.status = 'Cancelled';
          tx.failureReason = 'Checkout session expired (30-minute window).';
          await tx.save();

          // Revert invoice back to Pending so student can retry before the 72h deadline
          if (tx.invoice && tx.invoice.status === 'Payment Initiated') {
            tx.invoice.status = 'Pending';
            await tx.invoice.save();
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const tx = await PaymentTransaction.findOne({
          $or: [
            { stripePaymentIntentId: intent.id },
            { 'metadata.sessionToken': intent.id },
          ],
        }).populate('invoice');

        if (tx && tx.status !== 'Paid') {
          tx.status = 'Failed';
          tx.failureReason = intent.last_payment_error?.message || 'Payment card declined by issuer.';
          await tx.save();

          // Revert invoice back to Pending so student can retry
          if (tx.invoice && tx.invoice.status === 'Payment Initiated') {
            tx.invoice.status = 'Pending';
            await tx.invoice.save();
          }

          try {
            const { notify } = require('../services/notificationService');
            await notify({
              recipient: tx.student,
              title: 'Payment Attempt Declined',
              message: `Your tuition payment of ${tx.amount} ${tx.currency} could not be processed: ${tx.failureReason}. You can retry before the 72-hour deadline.`,
              type: 'warning',
              relatedCourse: tx.invoice?.course,
              relatedApplication: tx.invoice?.application,
            });
          } catch (_) {}
        }
        break;
      }

      default:
        // Acknowledge other event types safely
        break;
    }

    res.json({ received: true, type: event.type });
  } catch (err) {
    console.error('[STRIPE WEBHOOK HANDLER ERROR]:', err);
    res.status(500).json({ error: 'Webhook processing error', details: err.message });
  }
}

/**
 * Checks status of a payment session (for redirect return landing page).
 * GET /api/payments/session-status/:sessionId
 */
async function getPaymentSessionStatus(req, res, next) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      throw new AppError('sessionId parameter is required.', 400);
    }

    const transaction = await PaymentTransaction.findOne({
      $or: [
        { stripeCheckoutSessionId: sessionId },
        { transactionId: sessionId },
        { providerReference: sessionId },
        { 'metadata.sessionToken': sessionId },
      ],
    })
      .populate('invoice')
      .populate('student', 'fullName email');

    if (!transaction) {
      throw new AppError('Payment transaction not found for this session.', 404);
    }

    const isOwner = req.user && String(transaction.student?._id || transaction.student) === String(req.user._id);
    const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you cannot access another user payment session.', 403);
    }

    // If transaction is still initiated/pending, and provider is Stripe, attempt live verification
    if (transaction.status !== 'Paid' && transaction.provider === 'STRIPE') {
      try {
        const { getPaymentProvider } = require('../services/paymentProviders');
        const stripeProvider = getPaymentProvider('STRIPE');
        const verifyRes = await stripeProvider.verifyPayment({
          transactionId: transaction.transactionId,
          transaction,
          invoice: transaction.invoice,
          student: transaction.student,
          payload: { sessionId },
        });

        if (verifyRes.isVerified && verifyRes.status === 'SUCCESS') {
          await paymentService.verifyAndFinalizePayment({
            transactionId: transaction.transactionId,
            providerReference: verifyRes.providerReference,
          });
          const refreshed = await PaymentTransaction.findById(transaction._id).populate('invoice');
          return res.json({
            success: true,
            status: refreshed.status,
            isSettled: refreshed.status === 'Paid',
            transaction: refreshed,
            invoice: refreshed.invoice,
          });
        }
      } catch (_) {
        // Fall back to returning current database state
      }
    }

    res.json({
      success: true,
      status: transaction.status,
      isSettled: transaction.status === 'Paid',
      transaction,
      invoice: transaction.invoice,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  myPayments,
  getInvoiceDetails,
  calculatePrice,
  prepareInvoice,
  initiatePayment,
  verifyPayment,
  payInvoice,
  adminList,
  adminGet,
  handleStripeWebhook,
  getPaymentSessionStatus,
};
