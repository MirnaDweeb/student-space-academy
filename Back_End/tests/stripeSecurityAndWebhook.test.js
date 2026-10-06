jest.mock('../src/models/Invoice');
jest.mock('../src/models/PaymentTransaction');
jest.mock('../src/models/Application');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Course');
jest.mock('../src/models/User');
jest.mock('../src/services/notificationService');
jest.mock('../src/utils/email');

const mongoose = require('mongoose');
const StripePaymentProvider = require('../src/services/paymentProviders/StripePaymentProvider');
const paymentController = require('../src/controllers/paymentController');
const paymentService = require('../src/services/paymentService');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const Invoice = require('../src/models/Invoice');
const Application = require('../src/models/Application');
const Enrollment = require('../src/models/Enrollment');

describe('EGSA Space Academy Payment Security & Webhook Hardening Test Suite', () => {
  const studentAId = new mongoose.Types.ObjectId();
  const studentBId = new mongoose.Types.ObjectId();
  const invoiceId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const cohortId = new mongoose.Types.ObjectId();
  const applicationId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('A. Elimination of Forged Stripe Verification & Authoritative Checks', () => {
    let provider;
    let mockStripeInstance;

    beforeEach(() => {
      provider = new StripePaymentProvider();
      mockStripeInstance = {
        checkout: {
          sessions: {
            retrieve: jest.fn(),
          },
        },
      };
      provider.stripeClient = mockStripeInstance;
    });

    it('rejects verification if client passes forged payload.session without server-side retrieval', async () => {
      // Simulate client attempting to forge verification by passing a fake session object
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_real_123',
        mode: 'payment',
        payment_status: 'unpaid', // Real status on Stripe is unpaid!
        currency: 'egp',
        amount_total: 300000,
      });

      const result = await provider.verifyPayment({
        transactionId: 'TXN_TEST_1',
        payload: {
          sessionId: 'cs_real_123',
          session: { payment_status: 'paid' }, // Forged payload should be ignored!
        },
        transaction: {
          stripeCheckoutSessionId: 'cs_real_123',
          amount: 3000,
          currency: 'EGP',
        },
        invoice: {
          _id: invoiceId,
          amount: 3000,
          currency: 'EGP',
        },
      });

      expect(mockStripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_real_123');
      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toMatch(/not settled/i);
    });

    it('rejects verification when checkout mode is not payment (e.g. setup or subscription)', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_mode',
        mode: 'setup',
        payment_status: 'paid',
        currency: 'egp',
        amount_total: 300000,
      });

      const result = await provider.verifyPayment({
        transactionId: 'TXN_MODE_TEST',
        payload: { sessionId: 'cs_test_mode' },
        transaction: { stripeCheckoutSessionId: 'cs_test_mode', amount: 3000 },
        invoice: { _id: invoiceId, amount: 3000, currency: 'EGP' },
      });

      expect(result.isVerified).toBe(false);
      expect(result.failureReason).toMatch(/invalid checkout session mode/i);
    });

    it('rejects verification when amount in minor units does not match authoritative invoice amount', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_amount',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'egp',
        amount_total: 150000, // 1,500 EGP instead of 3,000 EGP
      });

      const result = await provider.verifyPayment({
        transactionId: 'TXN_AMOUNT_MISMATCH',
        payload: { sessionId: 'cs_test_amount' },
        transaction: { stripeCheckoutSessionId: 'cs_test_amount', amount: 3000 },
        invoice: { _id: invoiceId, amount: 3000, currency: 'EGP' },
      });

      expect(result.isVerified).toBe(false);
      expect(result.failureReason).toMatch(/amount mismatch/i);
    });

    it('rejects verification when currency does not match authoritative invoice currency', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_currency',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'usd', // Attacker attempted paying in USD
        amount_total: 300000,
      });

      const result = await provider.verifyPayment({
        transactionId: 'TXN_CURRENCY_MISMATCH',
        payload: { sessionId: 'cs_test_currency' },
        transaction: { stripeCheckoutSessionId: 'cs_test_currency', amount: 3000, currency: 'EGP' },
        invoice: { _id: invoiceId, amount: 3000, currency: 'EGP' },
      });

      expect(result.isVerified).toBe(false);
      expect(result.failureReason).toMatch(/currency mismatch/i);
    });

    it('rejects verification when student metadata does not match authoritative student record', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_student_mismatch',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'egp',
        amount_total: 300000,
        metadata: {
          studentId: studentBId.toString(), // Belongs to student B, not student A!
          invoiceId: invoiceId.toString(),
          transactionId: 'TXN_STUDENT_MISMATCH',
        },
      });

      const result = await provider.verifyPayment({
        transactionId: 'TXN_STUDENT_MISMATCH',
        payload: { sessionId: 'cs_test_student_mismatch' },
        transaction: {
          stripeCheckoutSessionId: 'cs_test_student_mismatch',
          amount: 3000,
          currency: 'EGP',
          student: studentAId,
        },
        invoice: { _id: invoiceId, amount: 3000, currency: 'EGP' },
        student: { _id: studentAId },
      });

      expect(result.isVerified).toBe(false);
      expect(result.failureReason).toMatch(/student ownership mismatch/i);
    });

    it('successfully verifies transaction when all authoritative checks match exactly', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        id: 'cs_test_success_123',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'egp',
        amount_total: 300000,
        payment_intent: 'pi_test_valid_intent',
        metadata: {
          studentId: studentAId.toString(),
          invoiceId: invoiceId.toString(),
          transactionId: 'TXN_VALID_SUCCESS',
        },
      });

      const result = await provider.verifyPayment({
        transactionId: 'TXN_VALID_SUCCESS',
        payload: { sessionId: 'cs_test_success_123' },
        transaction: {
          stripeCheckoutSessionId: 'cs_test_success_123',
          amount: 3000,
          currency: 'EGP',
          student: studentAId,
        },
        invoice: { _id: invoiceId, amount: 3000, currency: 'EGP' },
        student: { _id: studentAId },
      });

      expect(result.isVerified).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.paidAmount).toBe(3000);
      expect(result.providerReference).toBe('pi_test_valid_intent');
    });
  });

  describe('B. Stripe Webhook Cryptographic Verification & Idempotent Handling', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
      mockReq = {
        headers: {},
        rawBody: null,
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
    });

    it('rejects webhook with 400 when stripe-signature header is missing', async () => {
      mockReq.rawBody = Buffer.from('{}');
      await paymentController.handleStripeWebhook(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/missing/i) }));
    });

    it('rejects webhook with 400 when req.rawBody is missing or not a Buffer', async () => {
      mockReq.headers['stripe-signature'] = 't=123,v1=fake_sig';
      mockReq.rawBody = null;
      await paymentController.handleStripeWebhook(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringMatching(/raw body unavailable/i));
    });

    it('rejects webhook with 400 when HMAC signature verification fails', async () => {
      mockReq.headers['stripe-signature'] = 't=123,v1=invalid_sig';
      mockReq.rawBody = Buffer.from('{"test":"bad"}');

      const { getPaymentProvider } = require('../src/services/paymentProviders');
      const stripeProv = getPaymentProvider('STRIPE');
      jest.spyOn(stripeProv, 'constructWebhookEvent').mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      await paymentController.handleStripeWebhook(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringMatching(/Webhook Error/i));
    });

    it('handles checkout.session.completed and finalizes enrollment atomically', async () => {
      mockReq.headers['stripe-signature'] = 't=123,v1=valid_sig';
      mockReq.rawBody = Buffer.from('{"id":"evt_123"}');

      const validSession = {
        id: 'cs_valid_webhook_session',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'egp',
        amount_total: 300000,
        payment_intent: 'pi_valid_intent',
        metadata: {
          transactionId: 'TXN_WEBHOOK_1',
          studentId: studentAId.toString(),
          invoiceId: invoiceId.toString(),
        },
      };

      const { getPaymentProvider } = require('../src/services/paymentProviders');
      const stripeProv = getPaymentProvider('STRIPE');
      jest.spyOn(stripeProv, 'constructWebhookEvent').mockReturnValue({
        id: 'evt_valid_123',
        type: 'checkout.session.completed',
        data: { object: validSession },
      });

      const mockTxn = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN_WEBHOOK_1',
        stripeCheckoutSessionId: 'cs_valid_webhook_session',
        amount: 3000,
        currency: 'EGP',
        status: 'Initiated',
        student: studentAId,
        invoice: {
          _id: invoiceId,
          status: 'Invoice Issued',
        },
        save: jest.fn().mockResolvedValue(true),
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTxn),
      });

      jest.spyOn(paymentService, 'verifyAndFinalizePayment').mockResolvedValue({
        success: true,
        status: 'PAID',
      });

      await paymentController.handleStripeWebhook(mockReq, mockRes);

      expect(paymentService.verifyAndFinalizePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'TXN_WEBHOOK_1',
          webhookEventId: 'evt_valid_123',
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ received: true }));
    });

    it('handles duplicate webhook event idempotently without re-settlement', async () => {
      mockReq.headers['stripe-signature'] = 't=123,v1=valid_sig';
      mockReq.rawBody = Buffer.from('{"id":"evt_dup_123"}');

      const validSession = {
        id: 'cs_dup_session',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'egp',
        amount_total: 300000,
        metadata: { transactionId: 'TXN_ALREADY_PAID' },
      };

      const { getPaymentProvider } = require('../src/services/paymentProviders');
      const stripeProv = getPaymentProvider('STRIPE');
      jest.spyOn(stripeProv, 'constructWebhookEvent').mockReturnValue({
        id: 'evt_dup_123',
        type: 'checkout.session.completed',
        data: { object: validSession },
      });

      const alreadySettledTxn = {
        transactionId: 'TXN_ALREADY_PAID',
        status: 'Paid', // Already settled!
        invoice: { _id: invoiceId, status: 'Paid' },
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(alreadySettledTxn),
      });

      jest.spyOn(paymentService, 'verifyAndFinalizePayment');

      await paymentController.handleStripeWebhook(mockReq, mockRes);

      // Verify finalize was NOT called again for already settled transaction
      expect(paymentService.verifyAndFinalizePayment).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ received: true }));
    });

    it('marks transaction as Requires_Refund if payment completes after seat release (late payment)', async () => {
      mockReq.headers['stripe-signature'] = 't=123,v1=valid_sig';
      mockReq.rawBody = Buffer.from('{"id":"evt_late_123"}');

      const lateSession = {
        id: 'cs_late_session',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'egp',
        amount_total: 300000,
        payment_intent: 'pi_late_intent',
        metadata: {
          transactionId: 'TXN_LATE_PAYMENT',
          studentId: studentAId.toString(),
        },
      };

      const { getPaymentProvider } = require('../src/services/paymentProviders');
      const stripeProv = getPaymentProvider('STRIPE');
      jest.spyOn(stripeProv, 'constructWebhookEvent').mockReturnValue({
        id: 'evt_late_123',
        type: 'checkout.session.completed',
        data: { object: lateSession },
      });

      const lateTxn = {
        transactionId: 'TXN_LATE_PAYMENT',
        amount: 3000,
        currency: 'EGP',
        status: 'Initiated',
        student: studentAId,
        invoice: {
          _id: invoiceId,
          status: 'Overdue', // Invoice was already marked Overdue / Cancelled!
        },
        save: jest.fn().mockResolvedValue(true),
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(lateTxn),
      });

      jest.spyOn(paymentService, 'verifyAndFinalizePayment');

      await paymentController.handleStripeWebhook(mockReq, mockRes);

      expect(paymentService.verifyAndFinalizePayment).not.toHaveBeenCalled();
      expect(lateTxn.status).toBe('Requires_Refund');
      expect(lateTxn.failureReason).toMatch(/Late payment received/i);
      expect(lateTxn.save).toHaveBeenCalled();
    });

    it('handles checkout.session.expired by cancelling transaction and reverting invoice to Pending for retry', async () => {
      mockReq.headers['stripe-signature'] = 't=123,v1=valid_sig';
      mockReq.rawBody = Buffer.from('{"id":"evt_exp_123"}');

      const expiredSession = {
        id: 'cs_expired_session',
        metadata: { transactionId: 'TXN_EXPIRED_1' },
      };

      const { getPaymentProvider } = require('../src/services/paymentProviders');
      const stripeProv = getPaymentProvider('STRIPE');
      jest.spyOn(stripeProv, 'constructWebhookEvent').mockReturnValue({
        id: 'evt_exp_123',
        type: 'checkout.session.expired',
        data: { object: expiredSession },
      });

      const mockInvoice = {
        _id: invoiceId,
        status: 'Payment Initiated',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockTxn = {
        transactionId: 'TXN_EXPIRED_1',
        status: 'Initiated',
        invoice: mockInvoice,
        save: jest.fn().mockResolvedValue(true),
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTxn),
      });

      await paymentController.handleStripeWebhook(mockReq, mockRes);

      expect(mockTxn.status).toBe('Cancelled');
      expect(mockTxn.failureReason).toMatch(/expired/i);
      expect(mockInvoice.status).toBe('Pending'); // Reverted so student can retry
      expect(mockInvoice.save).toHaveBeenCalled();
      expect(mockTxn.save).toHaveBeenCalled();
    });

    it('handles payment_intent.payment_failed by setting transaction Failed and reverting invoice to Pending', async () => {
      mockReq.headers['stripe-signature'] = 't=123,v1=valid_sig';
      mockReq.rawBody = Buffer.from('{"id":"evt_fail_123"}');

      const failedIntent = {
        id: 'pi_failed_intent',
        last_payment_error: { message: 'Your card has insufficient funds.' },
      };

      const { getPaymentProvider } = require('../src/services/paymentProviders');
      const stripeProv = getPaymentProvider('STRIPE');
      jest.spyOn(stripeProv, 'constructWebhookEvent').mockReturnValue({
        id: 'evt_fail_123',
        type: 'payment_intent.payment_failed',
        data: { object: failedIntent },
      });

      const mockInvoice = {
        _id: invoiceId,
        status: 'Payment Initiated',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockTxn = {
        transactionId: 'TXN_FAILED_INTENT',
        status: 'Initiated',
        invoice: mockInvoice,
        student: studentAId,
        save: jest.fn().mockResolvedValue(true),
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockTxn),
      });

      await paymentController.handleStripeWebhook(mockReq, mockRes);

      expect(mockTxn.status).toBe('Failed');
      expect(mockTxn.failureReason).toBe('Your card has insufficient funds.');
      expect(mockInvoice.status).toBe('Pending');
      expect(mockInvoice.save).toHaveBeenCalled();
      expect(mockTxn.save).toHaveBeenCalled();
    });
  });

  describe('C. Payment Bypass Elimination & Role Enforcement', () => {
    it('blocks regular students from calling payInvoice (direct payment bypass forbidden)', async () => {
      const mockReq = {
        params: { invoiceId: invoiceId.toString() },
        user: { _id: studentAId, role: 'student' }, // Regular student
        body: { method: 'Card' },
      };
      const mockRes = {};
      const mockNext = jest.fn();

      await paymentController.payInvoice(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringMatching(/direct student payment bypass is disabled/i),
        })
      );
    });

    it('permits authorized admin to record legitimate offline cashier payment', async () => {
      const mockReq = {
        params: { invoiceId: invoiceId.toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' }, // Admin
        body: { method: 'BankTransfer', packageType: 'WITHOUT_TRANSPORTATION' },
      };
      const mockRes = {
        json: jest.fn(),
      };
      const mockNext = jest.fn();

      const mockInvoice = {
        _id: invoiceId,
        amount: 3000,
        status: 'Invoice Issued',
        application: applicationId,
      };

      Invoice.findOne.mockResolvedValue(mockInvoice);
      Application.findById.mockResolvedValue({
        _id: applicationId,
        status: 'Accepted',
      });

      jest.spyOn(paymentService, 'confirmPayment').mockResolvedValue({
        invoice: { ...mockInvoice, status: 'Paid' },
        transaction: { transactionId: 'TXN_ADMIN_1', status: 'Paid' },
      });

      await paymentController.payInvoice(mockReq, mockRes, mockNext);

      expect(paymentService.confirmPayment).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringMatching(/administrative payment confirmed/i),
        })
      );
    });
  });
});
