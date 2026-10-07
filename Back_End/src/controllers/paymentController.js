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

    // Ensure all eligible applications have valid issued invoices discoverable by student
    try {
      const eligibleApps = await Application.find({
        student: req.user._id,
        eligibilityStatus: 'Eligible',
        status: { $in: ['Under Review', 'Submitted', 'Draft', 'Accepted', 'Eligible - Payment Pending'] },
      });
      for (const app of eligibleApps) {
        const invExists = await Invoice.exists({ application: app._id });
        if (!invExists) {
          const { autoAcceptAndReserveSeat } = require('../services/admissionService');
          await autoAcceptAndReserveSeat({ application: app });
        }
      }
    } catch (healErr) {
      console.error('[AUTO HEAL ERROR in myPayments]:', healErr.message);
    }

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
    let invoiceId = req.params?.invoiceId || req.body?.invoiceId;
    const applicationId = req.body?.applicationId;

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
 * Gateway Webhook Callback Handler
 * POST /api/payments/webhook
 * POST /api/payments/callback
 * Verifies Paymob cryptographic HMAC-SHA512 signature and idempotently finalizes transaction.
 */
async function handleGatewayWebhook(req, res, next) {
  // Paymob passes HMAC in query (for transaction callbacks) or in header
  const hmac =
    req.query?.hmac ||
    req.headers['x-paymob-hmac'] ||
    req.headers['hmac'] ||
    req.headers['stripe-signature']; // fallback check for compatibility

  if (!hmac) {
    return res.status(400).json({ error: 'Missing HMAC signature for callback verification.' });
  }

  const { getPaymentProvider } = require('../services/paymentProviders');
  const provider = getPaymentProvider('PAYMOB');

  // Transaction payload can be nested in req.body.obj or req.body or req.query
  const data = req.body?.obj || req.body || req.query;

  let isValidHmac = false;
  try {
    isValidHmac = provider.verifyWebhookHmac(data, hmac);
  } catch (err) {
    console.error('[GATEWAY WEBHOOK ERROR] HMAC check error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!isValidHmac) {
    console.error('[GATEWAY WEBHOOK ERROR] Cryptographic HMAC mismatch.');
    return res.status(401).json({ success: false, message: 'Webhook Error: Invalid HMAC cryptographic signature.' });
  }

  try {
    const orderId = String(data.order?.id !== undefined ? data.order.id : data['order.id'] || data.order || '');
    const merchantTxId = data.merchant_order_id || data.order?.merchant_order_id;
    const gatewayTxId = String(data.id || '');

    // Resolve transaction
    let tx = null;
    if (merchantTxId) {
      tx = await PaymentTransaction.findOne({ transactionId: merchantTxId }).populate('invoice');
    }
    if (!tx && orderId) {
      tx = await PaymentTransaction.findOne({
        $or: [{ providerOrderId: orderId }, { providerReference: orderId }],
      }).populate('invoice');
    }
    if (!tx && gatewayTxId) {
      tx = await PaymentTransaction.findOne({ providerReference: gatewayTxId }).populate('invoice');
    }

    if (!tx) {
      console.warn(`[GATEWAY WEBHOOK] Ignored: no transaction found for order ${orderId} / tx ${gatewayTxId}`);
      return res.json({ received: true, ignored: true, reason: 'transaction_not_found' });
    }

    // Idempotency: if already settled, return immediately
    if (tx.status === 'Paid') {
      return res.json({ received: true, status: 'already_settled' });
    }

    // Currency verification
    const expectedCurrency = (tx.currency || 'EGP').toLowerCase();
    const receivedCurrency = String(data.currency || '').toLowerCase();
    if (receivedCurrency && receivedCurrency !== expectedCurrency) {
      console.error(`[GATEWAY WEBHOOK] Currency mismatch: received ${receivedCurrency}, expected ${expectedCurrency}`);
      return res.status(400).send('Currency mismatch.');
    }

    // Amount verification in cents
    const expectedCents = Math.round(Number(tx.amount) * 100);
    const receivedCents = Number(data.amount_cents);
    if (receivedCents && receivedCents !== expectedCents) {
      console.error(`[GATEWAY WEBHOOK] Amount mismatch: received ${receivedCents}, expected ${expectedCents}`);
      return res.status(400).send('Amount mismatch.');
    }

    // Check if invoice was already Overdue/Expired/Cancelled (Late payment handling)
    if (tx.invoice && ['Overdue', 'Expired', 'Cancelled'].includes(tx.invoice.status)) {
      console.error(`[GATEWAY WEBHOOK] REQUIRES MANUAL REFUND: Late payment received for ${tx.invoice.status} invoice ${tx.invoice._id}`);
      tx.status = 'Requires_Refund';
      tx.failureReason = `Late payment received after invoice ${tx.invoice.status}. Seat was released; manual financial reconciliation required.`;
      tx.providerReference = gatewayTxId || orderId;
      await tx.save();
      return res.json({ received: true, status: 'requires_refund' });
    }

    const isSuccess = data.success === true || data.success === 'true';

    if (isSuccess) {
      await paymentService.verifyAndFinalizePayment({
        transactionId: tx.transactionId,
        verifiedCallbackData: data,
        providerReference: gatewayTxId || orderId,
        providerPayload: data,
      });
      return res.json({ received: true, status: 'settled_successfully' });
    } else {
      tx.status = 'Failed';
      tx.failureReason = data.data?.message || 'Payment declined by card gateway.';
      await tx.save();

      if (tx.invoice && tx.invoice.status === 'Payment Initiated') {
        tx.invoice.status = 'Pending';
        await tx.invoice.save();
      }

      return res.json({ received: true, status: 'marked_failed' });
    }
  } catch (err) {
    console.error('[GATEWAY WEBHOOK HANDLER ERROR]:', err);
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
        { providerSessionId: sessionId },
        { providerOrderId: sessionId },
        { providerReference: sessionId },
        { transactionId: sessionId },
        { stripeCheckoutSessionId: sessionId },
        { 'metadata.sessionToken': sessionId },
        { 'metadata.paymentKey': sessionId },
      ],
    })
      .populate({ path: 'invoice', populate: [{ path: 'course' }, { path: 'cohort' }] })
      .populate('student', 'fullName email');

    if (!transaction) {
      throw new AppError('Payment transaction not found for this session.', 404);
    }

    const isOwner = req.user && String(transaction.student?._id || transaction.student) === String(req.user._id);
    const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you cannot access another user payment session.', 403);
    }

    // If transaction is still initiated/pending, attempt live verification with provider
    if (transaction.status !== 'Paid') {
      try {
        const { getPaymentProvider } = require('../services/paymentProviders');
        const provider = getPaymentProvider(transaction.provider || 'PAYMOB');
        const verifyRes = await provider.verifyPayment({
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
          const refreshed = await PaymentTransaction.findById(transaction._id)
            .populate({ path: 'invoice', populate: [{ path: 'course' }, { path: 'cohort' }] })
            .populate('student', 'fullName email');
          return res.json({
            success: true,
            status: refreshed.status,
            isSettled: refreshed.status === 'Paid',
            transaction: refreshed,
            invoice: refreshed.invoice,
          });
        } else if (verifyRes.status === 'CANCELLED') {
          transaction.status = 'Cancelled';
          transaction.failureReason = verifyRes.failureReason || 'Checkout session expired or cancelled.';
          await transaction.save();
          if (transaction.invoice && transaction.invoice.status === 'Payment Initiated') {
            await Invoice.findByIdAndUpdate(transaction.invoice._id, { status: 'Pending' });
          }
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

/**
 * Student: Get masked refund account destination.
 * GET /api/payments/refund-account
 */
async function getRefundAccount(req, res, next) {
  try {
    const acc = await paymentService.getStudentRefundAccount(req.user._id);
    res.json({
      success: true,
      data: {
        accountHolderName: acc?.accountHolderName,
        refundMethod: acc?.refundMethod,
        bankName: acc?.bankName,
        maskedAccount: acc?.accountNumberMasked,
        maskedIban: acc?.ibanMasked,
        swiftCode: acc?.swiftCode,
        isConfirmed: acc?.isConfirmed,
        confirmedAt: acc?.confirmedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student: Save / Update refund destination.
 * POST /api/payments/refund-account
 */
async function saveRefundAccount(req, res, next) {
  try {
    const { accountHolderName, refundMethod, bankName, accountNumber, iban, swiftCode } = req.body;
    const acc = await paymentService.saveStudentRefundAccount({
      studentId: req.user._id,
      accountHolderName,
      refundMethod,
      bankName,
      accountNumber,
      iban,
      swiftCode,
      actorId: req.user._id,
    });

    res.json({
      success: true,
      message: 'Refund destination saved securely under EGSA Academy financial policy.',
      data: {
        accountHolderName: acc.accountHolderName,
        refundMethod: acc.refundMethod,
        bankName: acc.bankName,
        maskedAccount: acc.accountNumberMasked,
        maskedIban: acc.ibanMasked,
        swiftCode: acc.swiftCode,
        isConfirmed: acc.isConfirmed,
        confirmedAt: acc.confirmedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student: Submit a refund request.
 * POST /api/payments/invoices/:invoiceId/refund-request
 */
async function requestRefund(req, res, next) {
  try {
    const { amount, reason } = req.body;
    const refundReq = await paymentService.requestRefund({
      invoiceId: req.params.invoiceId,
      studentId: req.user._id,
      amount,
      reason,
    });

    res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully. It is now pending administrative review.',
      data: refundReq,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student: List my refund requests.
 * GET /api/payments/my-refunds
 */
async function myRefunds(req, res, next) {
  try {
    const refunds = await paymentService.listStudentRefunds(req.user._id);
    res.json({ success: true, data: refunds });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: List all platform refund requests.
 * GET /api/admin/refunds
 */
async function adminListRefunds(req, res, next) {
  try {
    const refunds = await paymentService.adminListRefunds(req.query);
    res.json({ success: true, data: refunds });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Get single refund request audit details.
 * GET /api/admin/refunds/:id
 */
async function adminGetRefund(req, res, next) {
  try {
    const refund = await paymentService.adminGetRefundDetails(req.params.id);
    res.json({ success: true, data: refund });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Review, approve, or reject refund request.
 * PATCH /api/admin/refunds/:id/review
 */
async function adminReviewRefund(req, res, next) {
  try {
    const { decision, decisionNote, approvedAmount } = req.body;
    const result = await paymentService.adminReviewRefund({
      refundRequestId: req.params.id,
      adminId: req.user._id,
      decision,
      decisionNote,
      approvedAmount,
    });

    res.json({
      success: true,
      message: `Refund request successfully ${decision.toLowerCase()}.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Execute and process approved refund.
 * POST /api/admin/refunds/:id/process
 */
async function adminProcessRefund(req, res, next) {
  try {
    const { settlementMethod, manualReference, notes } = req.body;
    const result = await paymentService.adminProcessRefund({
      refundRequestId: req.params.id,
      adminId: req.user._id,
      settlementMethod,
      manualReference,
      notes,
    });

    res.json({
      success: true,
      message: 'Refund settled and finalized successfully.',
      data: result,
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
  handleGatewayWebhook,
  handleStripeWebhook: handleGatewayWebhook, // Backward-compatible alias
  getPaymentSessionStatus,
  getRefundAccount,
  saveRefundAccount,
  requestRefund,
  myRefunds,
  adminListRefunds,
  adminGetRefund,
  adminReviewRefund,
  adminProcessRefund,
};

