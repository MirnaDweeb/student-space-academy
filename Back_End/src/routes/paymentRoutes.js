const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { payInvoiceValidator } = require('../validators/cycleValidators');
const ctrl = require('../controllers/paymentController');

// Student: List my invoices and payment records
router.get('/my', protect, ctrl.myPayments);

// Student & Admin: Get single invoice details
router.get('/invoices/:id', protect, ctrl.getInvoiceDetails);

// Student: Calculate authoritative package pricing
router.post('/calculate', protect, ctrl.calculatePrice);
router.get('/calculate', protect, ctrl.calculatePrice);

// Student: Prepare / Update invoice for accepted application
router.post('/prepare', protect, ctrl.prepareInvoice);

// Student: Initiate payment session with gateway provider
router.post('/initiate', protect, ctrl.initiatePayment);
router.post('/:invoiceId/initiate', protect, ctrl.initiatePayment);

// Student: Verify gateway payment and finalize enrollment
router.post('/verify', protect, ctrl.verifyPayment);

// Gateway Webhook: Cryptographically verified Stripe webhook (unprotected, called by Stripe)
router.post('/webhook', ctrl.handleStripeWebhook);

// Student: Query session payment status (e.g. after return from Stripe checkout)
router.get('/session-status/:sessionId', protect, ctrl.getPaymentSessionStatus);

// Backward-compatible instant pay endpoint
router.post('/:invoiceId/pay', protect, validate(payInvoiceValidator), ctrl.payInvoice);

module.exports = router;
