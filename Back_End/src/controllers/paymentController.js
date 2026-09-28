const Invoice = require('../models/Invoice');
const PaymentTransaction = require('../models/PaymentTransaction');
const Course = require('../models/Course');
const paymentService = require('../services/paymentService');
const { AppError } = require('../middleware/error');

/**
 * Returns all invoices and payment transactions for the authenticated student.
 * GET /api/payments/my
 */
async function myPayments(req, res, next) {
  try {
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
    const { courseId, packageType } = req.body;
    if (!courseId) {
      throw new AppError('courseId is required.', 400);
    }

    const course = await Course.findById(courseId);
    if (!course) {
      throw new AppError('Course not found.', 404);
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
    const invoiceId = req.params.invoiceId || req.body.invoiceId;
    if (!invoiceId) {
      throw new AppError('invoiceId is required.', 400);
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
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies gateway transaction outcome and finalizes enrollment.
 * POST /api/payments/verify
 */
async function verifyPayment(req, res, next) {
  try {
    const { transactionId, providerPayload, simulateFailure } = req.body;
    if (!transactionId) {
      throw new AppError('transactionId is required.', 400);
    }

    const result = await paymentService.verifyAndFinalizePayment({
      transactionId,
      providerPayload: {
        ...(providerPayload || {}),
        simulateFailure: simulateFailure === true,
      },
      studentId: req.user._id,
    });

    res.json({
      success: result.success,
      message: result.success
        ? 'Payment verified and confirmed successfully! Enrollment finalized.'
        : `Payment verification failed: ${result.failureReason}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Backward-compatible payment endpoint (executes instant mock payment in dev).
 * POST /api/payments/:invoiceId/pay
 */
async function payInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.invoiceId, student: req.user._id });
    if (!invoice) throw new AppError('Invoice not found.', 404);
    if (invoice.status === 'Paid' || invoice.status === 'PAID') {
      throw new AppError('Invoice already paid.', 400);
    }

    const { method, packageType } = req.body;
    const result = await paymentService.confirmPayment({ invoice, method, packageType });

    res.json({
      success: true,
      message: 'Payment confirmed successfully. Enrollment finalized.',
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
};
