jest.mock('../src/models/Invoice');
jest.mock('../src/models/PaymentTransaction');
jest.mock('../src/models/Application');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Course');
jest.mock('../src/models/TrainingSession');
jest.mock('../src/models/Media');
jest.mock('../src/services/notificationService');
jest.mock('../src/utils/email');

const mongoose = require('mongoose');
const StripePaymentProvider = require('../src/services/paymentProviders/StripePaymentProvider');
const MockPaymentProvider = require('../src/services/paymentProviders/MockPaymentProvider');
const { getPaymentProvider } = require('../src/services/paymentProviders');
const paymentService = require('../src/services/paymentService');
const mediaService = require('../src/services/mediaService');
const Invoice = require('../src/models/Invoice');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const Application = require('../src/models/Application');
const Enrollment = require('../src/models/Enrollment');
const Media = require('../src/models/Media');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const TrainingSession = require('../src/models/TrainingSession');

describe('Stripe Payment Integration & Security Verification', () => {
  const studentAId = new mongoose.Types.ObjectId();
  const studentBId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const cohortId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment Provider Registry & Abstraction', () => {
    it('should register both DEVELOPMENT_MOCK and STRIPE providers', () => {
      const mockProv = getPaymentProvider('DEVELOPMENT_MOCK');
      expect(mockProv).toBeInstanceOf(MockPaymentProvider);
      expect(mockProv.name).toBe('DEVELOPMENT_MOCK');

      const stripeProv = getPaymentProvider('STRIPE');
      expect(stripeProv).toBeInstanceOf(StripePaymentProvider);
      expect(stripeProv.name).toBe('STRIPE');
    });

    it('should gracefully fallback to DEVELOPMENT_MOCK if STRIPE_SECRET_KEY is absent and provider is unset', () => {
      const originalKey = process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;
      const originalProv = process.env.PAYMENT_PROVIDER;
      delete process.env.PAYMENT_PROVIDER;

      const provider = getPaymentProvider();
      expect(provider.name).toBe('DEVELOPMENT_MOCK');

      process.env.STRIPE_SECRET_KEY = originalKey;
      process.env.PAYMENT_PROVIDER = originalProv;
    });

    it('should throw an informative error if Stripe client is initialized without STRIPE_SECRET_KEY', () => {
      const originalKey = process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;

      const provider = new StripePaymentProvider();
      expect(() => provider.getStripeClient()).toThrow('STRIPE_SECRET_KEY is not configured');

      process.env.STRIPE_SECRET_KEY = originalKey;
    });
  });

  describe('Authoritative Pricing & Server-Side Security', () => {
    it('strictly calculates tuition based on database Course configuration, ignoring client amounts', () => {
      const fakeCourse = {
        _id: courseId,
        price: 2500,
        transportationPrice: 600,
        currency: 'EGP',
      };

      // Standard package
      const standard = paymentService.calculatePricing(fakeCourse, 'WITHOUT_TRANSPORTATION');
      expect(standard.basePrice).toBe(2500);
      expect(standard.transportationPrice).toBe(0);
      expect(standard.totalAmount).toBe(2500);
      expect(standard.currency).toBe('EGP');

      // Transportation package
      const withTrans = paymentService.calculatePricing(fakeCourse, 'WITH_TRANSPORTATION');
      expect(withTrans.basePrice).toBe(2500);
      expect(withTrans.transportationPrice).toBe(600);
      expect(withTrans.totalAmount).toBe(3100);
    });

    it('rejects pricing calculation when course object is missing', () => {
      expect(() => paymentService.calculatePricing(null)).toThrow('Course record is required');
    });
  });

  describe('Stripe Checkout Session Construction', () => {
    it('constructs correct session metadata, line items and return URLs', async () => {
      const provider = new StripePaymentProvider();
      const mockStripeInstance = {
        checkout: {
          sessions: {
            create: jest.fn().mockResolvedValue({
              id: 'cs_test_session_123',
              url: 'https://checkout.stripe.com/c/pay/cs_test_session_123',
              payment_intent: 'pi_test_intent_456',
            }),
          },
        },
      };
      provider.stripeClient = mockStripeInstance;

      const mockInvoice = {
        _id: new mongoose.Types.ObjectId(),
        amount: 3100,
        baseAmount: 2500,
        transportationAmount: 600,
        packageType: 'WITH_TRANSPORTATION',
        currency: 'EGP',
        invoiceNumber: 'EGSA-INV-998877',
        course: { title: 'CanSat & Small Satellite Engineering' },
        application: new mongoose.Types.ObjectId(),
        student: studentAId,
      };

      const mockTransaction = {
        transactionId: 'TXN_TEST_101',
      };

      const mockStudent = {
        _id: studentAId,
        email: 'astronaut@egsa.gov.eg',
      };

      const sessionResult = await provider.initiatePayment({
        invoice: mockInvoice,
        transaction: mockTransaction,
        student: mockStudent,
      });

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledTimes(1);
      const callArgs = mockStripeInstance.checkout.sessions.create.mock.calls[0][0];

      expect(callArgs.customer_email).toBe('astronaut@egsa.gov.eg');
      expect(callArgs.client_reference_id).toBe(mockInvoice._id.toString());
      expect(callArgs.metadata.transactionId).toBe('TXN_TEST_101');
      expect(callArgs.metadata.invoiceId).toBe(mockInvoice._id.toString());
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(310000); // 3100 * 100 in cents
      expect(callArgs.line_items[0].price_data.currency).toBe('egp');

      expect(sessionResult.paymentUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_session_123');
      expect(sessionResult.sessionToken).toBe('cs_test_session_123');
      expect(mockTransaction.stripeCheckoutSessionId).toBe('cs_test_session_123');
      expect(mockTransaction.stripePaymentIntentId).toBe('pi_test_intent_456');
    });
  });

  describe('Payment Verification & Idempotency Protection', () => {
    it('settles invoice, confirms application, and creates enrollment idempotently', async () => {
      const invoiceId = new mongoose.Types.ObjectId();
      const applicationId = new mongoose.Types.ObjectId();
      const txnObjectId = new mongoose.Types.ObjectId();

      const mockInvoice = {
        _id: invoiceId,
        amount: 3000,
        currency: 'EGP',
        status: 'Invoice Issued',
        course: courseId,
        application: applicationId,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockTxn = {
        _id: txnObjectId,
        transactionId: 'TXN_IDEMPOTENT_TEST',
        student: { _id: studentAId, fullName: 'Ahmed Space', email: 'ahmed@egsa.gov.eg' },
        invoice: mockInvoice,
        amount: 3000,
        currency: 'EGP',
        packageType: 'WITHOUT_TRANSPORTATION',
        status: 'Initiated',
        provider: 'DEVELOPMENT_MOCK',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockApplication = {
        _id: applicationId,
        student: studentAId,
        course: courseId,
        cohort: cohortId,
        status: 'Accepted',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockTxn),
        }),
      });

      Invoice.findOneAndUpdate.mockResolvedValue({
        ...mockInvoice,
        status: 'Paid',
      });

      Application.findById.mockResolvedValue(mockApplication);

      Enrollment.findOneAndUpdate.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        student: studentAId,
        course: courseId,
        status: 'Confirmed',
      });

      Course.findById.mockResolvedValue({
        _id: courseId,
        title: 'Satellite Ground Operations',
      });

      Cohort.findById.mockResolvedValue({
        _id: cohortId,
        name: 'Cohort Alpha',
      });

      TrainingSession.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          sessionNumber: 1,
          startTime: '10:00 AM',
          endTime: '03:00 PM',
          location: 'Space City, Cairo',
        }),
      });

      // 1st Verification
      const firstResult = await paymentService.verifyAndFinalizePayment({
        transactionId: 'TXN_IDEMPOTENT_TEST',
        studentId: studentAId,
        status: 'SUCCESS',
      });

      expect(firstResult.success).toBe(true);
      expect(firstResult.status).toBe('PAID');
      expect(mockTxn.status).toBe('Paid');
      expect(mockApplication.status).toBe('Confirmed');

      // 2nd (Duplicated / Replayed) Verification
      // Simulate transaction status now set to 'Paid' in DB
      mockTxn.status = 'Paid';
      Enrollment.findOne.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: 'Confirmed',
      });

      const secondResult = await paymentService.verifyAndFinalizePayment({
        transactionId: 'TXN_IDEMPOTENT_TEST',
        studentId: studentAId,
        status: 'SUCCESS',
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.alreadySettled).toBe(true);
      // Ensure invoice was not modified a second time
      expect(Invoice.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('rejects unauthorized access when a student attempts to settle another student transaction (IDOR check)', async () => {
      const mockTxn = {
        transactionId: 'TXN_SECRET_STUDENT_A',
        student: { _id: studentAId },
        status: 'Initiated',
      };

      PaymentTransaction.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockTxn),
        }),
      });

      await expect(
        paymentService.verifyAndFinalizePayment({
          transactionId: 'TXN_SECRET_STUDENT_A',
          studentId: studentBId, // Attempt by student B
        })
      ).rejects.toThrow('Unauthorized: transaction does not belong to this student');
    });
  });
});

describe('Media Workflow End-to-End & Schema Verification', () => {
  const studentId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const cohortId = new mongoose.Types.ObjectId();
  const enrollmentId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows student to upload project media without mandatory training session', async () => {
    const mockEnrollment = {
      _id: enrollmentId,
      student: studentId,
      course: courseId,
      cohort: cohortId,
      status: 'Confirmed',
    };

    Enrollment.findOne.mockResolvedValue(mockEnrollment);

    const mockCreatedMedia = {
      _id: new mongoose.Types.ObjectId(),
      student: studentId,
      course: courseId,
      cohort: cohortId,
      enrollment: enrollmentId,
      category: 'Project',
      title: 'CubeSat Solar Panel Deployment Prototype',
      status: 'Pending_Review',
      fileUrl: '/uploads/media/test_cubesat.jpg',
    };

    Media.create.mockResolvedValue(mockCreatedMedia);

    const fakeFile = {
      filename: 'test_cubesat.jpg',
      originalname: 'solar_panel.jpg',
      mimetype: 'image/jpeg',
      size: 1024 * 500,
    };

    const media = await mediaService.createMediaSubmission(studentId, fakeFile, {
      courseId,
      cohortId,
      // sessionId omitted intentionally to test optional session
      category: 'Project',
      title: 'CubeSat Solar Panel Deployment Prototype',
      submitImmediately: true,
      consentConfirmed: true,
    });

    expect(Media.create).toHaveBeenCalledTimes(1);
    const createArgs = Media.create.mock.calls[0][0];
    expect(createArgs.session).toBeUndefined();
    expect(createArgs.category).toBe('Project');
    expect(createArgs.status).toBe('Pending_Review');
    expect(createArgs.enrollment).toBe(enrollmentId);
    expect(media.title).toBe('CubeSat Solar Panel Deployment Prototype');
  });

  it('blocks media upload if student is not actively enrolled in the course & cohort', async () => {
    Enrollment.findOne.mockResolvedValue(null);

    const fakeFile = {
      filename: 'hacker_upload.jpg',
      originalname: 'hacker.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
    };

    await expect(
      mediaService.createMediaSubmission(studentId, fakeFile, {
        courseId,
        cohortId,
        title: 'Unauthorized Photo',
      })
    ).rejects.toThrow('You are not actively enrolled in this course and cohort');
  });

  it('admin can list media with category and approve it, persisting state to database', async () => {
    const adminId = new mongoose.Types.ObjectId();
    const mediaId = new mongoose.Types.ObjectId();

    const mockMediaDoc = {
      _id: mediaId,
      title: 'Lab Work',
      status: 'Pending_Review',
      reviewHistory: [],
      save: jest.fn().mockResolvedValue(true),
    };

    Media.findById.mockResolvedValue(mockMediaDoc);

    const approved = await mediaService.approveMedia(mediaId, adminId, 'Approved for Academy exhibition');

    expect(mockMediaDoc.status).toBe('Approved');
    expect(mockMediaDoc.reviewedBy).toBe(adminId);
    expect(mockMediaDoc.reviewComment).toBe('Approved for Academy exhibition');
    expect(mockMediaDoc.reviewHistory.length).toBe(1);
    expect(mockMediaDoc.reviewHistory[0].action).toBe('Approved');
    expect(mockMediaDoc.save).toHaveBeenCalledTimes(1);
  });
});
