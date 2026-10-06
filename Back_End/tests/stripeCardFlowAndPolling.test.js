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
const User = require('../src/models/User');

describe('EGSA Space Academy — Complete Card Payment Flow & Polling Verification', () => {
  const studentId = new mongoose.Types.ObjectId();
  const anotherStudentId = new mongoose.Types.ObjectId();
  const invoiceId = new mongoose.Types.ObjectId();
  const applicationId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const cohortId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe('1. Card Payment Initiation & Stripe Provider Enforcement', () => {
    it('fails closed and reports missing Stripe configuration without silent mock shortcut', async () => {
      const mockInvoice = {
        _id: invoiceId,
        student: studentId,
        amount: 2500,
        currency: 'EGP',
        status: 'Invoice Issued',
        application: {
          _id: applicationId,
          status: 'Accepted',
        },
        course: {
          _id: courseId,
          title: 'Satellite Ground Operations',
          price: 2500,
          currency: 'EGP',
        },
        save: jest.fn().mockResolvedValue(true),
      };

      Invoice.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockInvoice),
        }),
      });

      const mockTxn = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN_TEST_FAIL_CLOSED',
        status: 'Initiated',
        save: jest.fn().mockResolvedValue(true),
      };

      PaymentTransaction.create.mockResolvedValue(mockTxn);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: studentId, fullName: 'Sara Ahmed', email: 'sara@egsa.gov.eg' }),
      });

      // No STRIPE_SECRET_KEY set in process.env
      await expect(
        paymentService.initiatePayment({
          invoiceId,
          studentId,
          method: 'Card',
        })
      ).rejects.toThrow(/STRIPE_SECRET_KEY is not configured/i);

      // Verify transaction marked Failed and invoice reverted to Pending for retry
      expect(mockTxn.status).toBe('Failed');
      expect(mockTxn.failureReason).toMatch(/STRIPE_SECRET_KEY/i);
      expect(mockTxn.save).toHaveBeenCalled();
      expect(mockInvoice.status).toBe('Pending');
      expect(mockInvoice.save).toHaveBeenCalled();
    });

    it('reports actual limitation when Stripe returns currency or payment method unsupported error', async () => {
      const provider = new StripePaymentProvider();
      const mockStripe = {
        checkout: {
          sessions: {
            create: jest.fn().mockRejectedValue({
              type: 'StripeInvalidRequestError',
              message: 'The currency egp is not currently supported for your account.',
            }),
          },
        },
      };
      provider.stripeClient = mockStripe;

      const mockInvoice = {
        _id: invoiceId,
        amount: 3000,
        currency: 'EGP',
        course: { title: 'CanSat Workshop' },
      };
      const mockTxn = { transactionId: 'TXN_CURR_ERR' };
      const mockStudent = { email: 'student@egsa.gov.eg' };

      await expect(
        provider.initiatePayment({
          invoice: mockInvoice,
          transaction: mockTxn,
          student: mockStudent,
        })
      ).rejects.toThrow(/The currency "EGP" or card payment method is not supported/i);
    });

    it('creates hosted checkout session with card payment method, customer email, and expiration safeguard', async () => {
      const provider = new StripePaymentProvider();
      const mockCreatedSession = {
        id: 'cs_test_session_card_flow',
        url: 'https://checkout.stripe.com/c/pay/cs_test_session_card_flow',
        payment_intent: 'pi_test_card_flow',
      };
      const mockStripe = {
        checkout: {
          sessions: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
        },
      };
      provider.stripeClient = mockStripe;

      const mockInvoice = {
        _id: invoiceId,
        amount: 2500,
        currency: 'EGP',
        course: { title: 'Spacecraft Navigation' },
        packageType: 'WITHOUT_TRANSPORTATION',
        application: applicationId,
        student: studentId,
      };
      const mockTxn = { transactionId: 'TXN_CARD_SUCCESS' };
      const mockStudent = { _id: studentId, email: 'student@egsa.gov.eg' };

      const res = await provider.initiatePayment({
        invoice: mockInvoice,
        transaction: mockTxn,
        student: mockStudent,
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      const args = mockStripe.checkout.sessions.create.mock.calls[0][0];

      // Verifies card payment method configuration
      expect(args.payment_method_types).toEqual(['card']);
      expect(args.mode).toBe('payment');
      expect(args.customer_email).toBe('student@egsa.gov.eg');
      expect(args.client_reference_id).toBe(invoiceId.toString());
      expect(args.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 1800);
      expect(args.line_items[0].price_data.unit_amount).toBe(250000); // 2500 EGP in minor units
      expect(args.line_items[0].price_data.currency).toBe('egp');

      expect(res.paymentUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_session_card_flow');
      expect(res.isMock).toBe(false);
      expect(mockTxn.stripeCheckoutSessionId).toBe('cs_test_session_card_flow');
    });
  });

  describe('2. Bounded Polling & Session Status Endpoint', () => {
    it('populates course and cohort on invoice and verifies student ownership', async () => {
      const mockInvoice = {
        _id: invoiceId,
        amount: 2500,
        currency: 'EGP',
        course: { _id: courseId, title: 'Satellite Communication' },
        cohort: { _id: cohortId, name: 'Cohort Gamma' },
      };

      const mockTxn = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN_POLL_1',
        stripeCheckoutSessionId: 'cs_poll_test',
        student: { _id: studentId, fullName: 'Sara Ahmed', email: 'sara@egsa.gov.eg' },
        invoice: mockInvoice,
        status: 'Paid',
        provider: 'STRIPE',
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockTxn),
        }),
      });

      const mockReq = {
        params: { sessionId: 'cs_poll_test' },
        user: { _id: studentId, role: 'student' },
      };
      const mockRes = {
        json: jest.fn(),
      };
      const mockNext = jest.fn();

      await paymentController.getPaymentSessionStatus(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'Paid',
          isSettled: true,
          invoice: expect.objectContaining({
            course: expect.objectContaining({ title: 'Satellite Communication' }),
            cohort: expect.objectContaining({ name: 'Cohort Gamma' }),
          }),
        })
      );
    });

    it('rejects cross-student IDOR access on payment session lookup', async () => {
      const mockTxn = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN_IDOR_TEST',
        student: studentId, // Belongs to Student A
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockTxn),
        }),
      });

      const mockReq = {
        params: { sessionId: 'cs_idor_test' },
        user: { _id: anotherStudentId, role: 'student' }, // Student B attempts lookup
      };
      const mockRes = {};
      const mockNext = jest.fn();

      await paymentController.getPaymentSessionStatus(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringMatching(/forbidden/i),
        })
      );
    });

    it('updates transaction to Cancelled and reverts invoice to Pending when Stripe session expires', async () => {
      const mockInvoice = {
        _id: invoiceId,
        status: 'Payment Initiated',
      };

      const mockTxn = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN_EXP_TEST',
        stripeCheckoutSessionId: 'cs_expired_test',
        student: studentId,
        invoice: mockInvoice,
        status: 'Initiated',
        provider: 'STRIPE',
        save: jest.fn().mockResolvedValue(true),
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockTxn),
        }),
      });

      const { getPaymentProvider } = require('../src/services/paymentProviders');
      const stripeProv = getPaymentProvider('STRIPE');
      jest.spyOn(stripeProv, 'verifyPayment').mockResolvedValue({
        isVerified: false,
        status: 'CANCELLED',
        failureReason: 'Checkout session expired.',
      });

      Invoice.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

      const mockReq = {
        params: { sessionId: 'cs_expired_test' },
        user: { _id: studentId, role: 'student' },
      };
      const mockRes = { json: jest.fn() };
      const mockNext = jest.fn();

      await paymentController.getPaymentSessionStatus(mockReq, mockRes, mockNext);

      expect(mockTxn.status).toBe('Cancelled');
      expect(mockTxn.save).toHaveBeenCalled();
      expect(Invoice.findByIdAndUpdate).toHaveBeenCalledWith(invoiceId, { status: 'Pending' });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'Cancelled',
          isSettled: false,
        })
      );
    });
  });
});
