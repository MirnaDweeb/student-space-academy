const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
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

// Gateway Webhook / Transaction Callback: Cryptographically verified Paymob HMAC callback
router.post('/webhook', ctrl.handleGatewayWebhook);
router.post('/callback', ctrl.handleGatewayWebhook);
router.get('/callback', ctrl.handleGatewayWebhook);

// Student: Query session payment status (e.g. after return from Paymob checkout)
router.get('/session-status/:sessionId', protect, ctrl.getPaymentSessionStatus);

// Student: Refund Account Details (register, view masked destination)
router.get('/refund-account', protect, ctrl.getRefundAccount);
router.post('/refund-account', protect, ctrl.saveRefundAccount);

// Student: Refund Requests
router.post('/invoices/:invoiceId/refund-request', protect, ctrl.requestRefund);
router.get('/my-refunds', protect, ctrl.myRefunds);

// Administrative offline payment settlement (cash/wire recorded by cashier)
router.post('/:invoiceId/pay', protect, authorize('admin', 'superadmin'), validate(payInvoiceValidator), ctrl.payInvoice);

module.exports = router;
