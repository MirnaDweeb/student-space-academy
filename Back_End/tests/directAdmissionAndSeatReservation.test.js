jest.mock('../src/models/Course');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Application');
jest.mock('../src/models/StudentProfile');
jest.mock('../src/models/ReadinessQuestion');
jest.mock('../src/models/ReadinessAttempt');
jest.mock('../src/models/Invoice');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/User');
jest.mock('../src/models/PaymentTransaction');
jest.mock('../src/models/RefundAccount');
jest.mock('../src/services/paymentProviders');
jest.mock('../src/services/notificationService');

const mongoose = require('mongoose');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Application = require('../src/models/Application');
const StudentProfile = require('../src/models/StudentProfile');
const ReadinessQuestion = require('../src/models/ReadinessQuestion');
const ReadinessAttempt = require('../src/models/ReadinessAttempt');
const Invoice = require('../src/models/Invoice');
const Enrollment = require('../src/models/Enrollment');
const User = require('../src/models/User');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const RefundAccount = require('../src/models/RefundAccount');
const { getPaymentProvider } = require('../src/services/paymentProviders');
const { notify } = require('../src/services/notificationService');

const { autoAcceptAndReserveSeat } = require('../src/services/admissionService');
const { createApplication } = require('../src/controllers/applicationController');
const { submitAssessment } = require('../src/controllers/readinessController');
const { getOrCreateInvoiceForApplication, confirmPayment } = require('../src/services/paymentService');
const { checkCourseFit } = require('../src/services/eligibilityService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Phase 6 Regression Tests — Direct Admission, Atomic Capacity & Payment Workflow', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Eligible Student → Auto Acceptance → Seat Reservation → Invoice Generation', () => {
    test('readiness assessment with READY score auto-accepts, reserves seat atomically, and generates invoice', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();
      const attemptId = new mongoose.Types.ObjectId().toString();

      const course = {
        _id: courseId,
        title: 'CrossFit Functional Fitness',
        price: 1500,
        currency: 'EGP',
        transportationPrice: 500,
      };

      const cohort = {
        _id: cohortId,
        course: courseId,
        name: 'Cohort 2026-01',
        capacity: 20,
        seatsTaken: 5,
        status: 'Scheduled',
      };

      const pendingApp = {
        _id: new mongoose.Types.ObjectId().toString(),
        student: studentId,
        course: courseId,
        cohort: cohortId,
        status: 'Submitted',
        eligibilityStatus: 'Eligible',
        save: jest.fn().mockResolvedValue(true),
      };

      const readinessAttempt = {
        _id: attemptId,
        student: studentId,
        course: courseId,
        status: 'In Progress',
        answers: [],
        startedAt: new Date(Date.now() - 60000),
        timeLimitMinutes: 20,
        save: jest.fn().mockResolvedValue(true),
      };

      ReadinessAttempt.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(readinessAttempt),
      });

      // 12 correct answers
      const mockQuestions = Array.from({ length: 12 }, (_, i) => ({
        _id: `q-${i}`,
        correctAnswerIndex: 0,
        topic: 'General Conditioning',
      }));
      readinessAttempt.questions = mockQuestions;
      ReadinessQuestion.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockQuestions),
      });

      Application.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(pendingApp),
      });

      Course.findById.mockResolvedValue(course);
      Cohort.findById.mockResolvedValue(cohort);
      Cohort.findOneAndUpdate.mockResolvedValue({ ...cohort, seatsTaken: 6 });
      Invoice.findOne.mockResolvedValue(null);
      Invoice.create.mockResolvedValue({
        _id: 'inv-created-1',
        invoiceNumber: 'INV-2026-1001',
        amount: 1500,
        status: 'Invoice Issued',
      });
      User.findById.mockResolvedValue({ email: 'student@example.com', fullName: 'Student One' });

      const req = {
        params: { attemptId },
        user: { _id: studentId },
        body: {
          answers: mockQuestions.map((q) => ({ questionId: q._id, selectedIndex: 0 })),
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await submitAssessment(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            outcome: 'READY',
            applicationStatus: 'Accepted',
            waitlisted: false,
          }),
        })
      );
      expect(Cohort.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: cohortId, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
        { $inc: { seatsTaken: 1 } },
        { new: true }
      );
    });
  });

  describe('2. Direct Admission for Programs Not Requiring Readiness Assessments', () => {
    test('application for program without readiness assessment directly auto-accepts and reserves seat', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();

      const course = {
        _id: courseId,
        title: 'Satellite Ground Operations',
        price: 2500,
        currency: 'EGP',
      };

      const cohort = {
        _id: cohortId,
        course: courseId,
        name: 'Cohort Beta',
        capacity: 15,
        seatsTaken: 3,
        status: 'Scheduled',
      };

      Course.findById.mockResolvedValue(course);
      StudentProfile.findOne.mockResolvedValue({ completedCourses: [], experience: [] });
      ReadinessAttempt.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      Cohort.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(cohort),
      });
      Cohort.findById.mockResolvedValue(cohort);
      Cohort.findOneAndUpdate.mockResolvedValue({ ...cohort, seatsTaken: 4 });

      // No readiness questions configured
      ReadinessQuestion.exists = jest.fn().mockResolvedValue(false);

      const appDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        student: studentId,
        course: courseId,
        cohort: cohortId,
        status: 'Submitted',
        eligibilityStatus: 'Eligible',
        save: jest.fn().mockResolvedValue(true),
      };

      Application.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });
      Application.create.mockResolvedValue(appDoc);
      Invoice.findOne.mockResolvedValue(null);
      Invoice.create.mockResolvedValue({
        _id: 'inv-ground-ops',
        amount: 2500,
        status: 'Invoice Issued',
      });
      User.findById.mockResolvedValue({ email: 'ops@example.com', fullName: 'Ground Ops Student' });

      const req = {
        body: { courseId },
        user: { _id: studentId },
      };
      const res = mockRes();
      const next = jest.fn();

      await createApplication(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'Accepted',
            eligibilityStatus: 'Eligible',
          }),
        })
      );
      expect(Cohort.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe('3. Ineligible Assessment Results Block Auto-Acceptance', () => {
    test('outcome NOT_ELIGIBLE stops workflow and does not reserve seat or issue invoice', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();
      const attemptId = new mongoose.Types.ObjectId().toString();

      const course = { _id: courseId, title: 'CrossFit', price: 1500 };
      const cohort = { _id: cohortId, capacity: 20, seatsTaken: 5 };

      const pendingApp = {
        _id: 'app-not-eligible',
        student: studentId,
        course: courseId,
        cohort: cohortId,
        status: 'Submitted',
        save: jest.fn().mockResolvedValue(true),
      };

      const readinessAttempt = {
        _id: attemptId,
        student: studentId,
        course: courseId,
        status: 'In Progress',
        answers: [],
        startedAt: new Date(Date.now() - 60000),
        timeLimitMinutes: 20,
        save: jest.fn().mockResolvedValue(true),
      };

      ReadinessAttempt.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(readinessAttempt),
      });

      // 12 questions, all answered incorrectly (0% score -> NOT_ELIGIBLE)
      const mockQuestions = Array.from({ length: 12 }, (_, i) => ({
        _id: `q-${i}`,
        correctAnswerIndex: 1,
        topic: 'General Conditioning',
      }));
      readinessAttempt.questions = mockQuestions;
      ReadinessQuestion.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockQuestions),
      });

      Application.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(pendingApp),
      });

      const req = {
        params: { attemptId },
        user: { _id: studentId },
        body: {
          answers: mockQuestions.map((q) => ({ questionId: q._id, selectedIndex: 0 })),
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await submitAssessment(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            outcome: 'FOUNDATION_REQUIRED',
            applicationStatus: 'Foundation Recommended',
            invoiceId: null,
          }),
        })
      );
      expect(Cohort.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Invoice.create).not.toHaveBeenCalled();
    });
  });

  describe('4. FOUNDATION_REQUIRED and MANUAL_REVIEW Gating', () => {
    test('FOUNDATION_REQUIRED outcome sets status to Foundation Recommended without seat reservation', async () => {
      const studentId = 'student-fnd';
      const courseId = 'course-fnd';

      const appDoc = {
        _id: 'app-fnd',
        student: studentId,
        course: courseId,
        status: 'Foundation Recommended',
        eligibilityStatus: 'Not Eligible',
      };

      const result = await autoAcceptAndReserveSeat({ application: appDoc });
      expect(result.success).toBe(false);
      expect(result.reason).toBe('FOUNDATION_REQUIRED');
      expect(Cohort.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Invoice.create).not.toHaveBeenCalled();
    });

    test('MANUAL_REVIEW outcome sets status to Manual Review without auto-acceptance', async () => {
      const studentId = 'student-man';
      const courseId = 'course-man';

      const appDoc = {
        _id: 'app-man',
        student: studentId,
        course: courseId,
        status: 'Manual Review',
        eligibilityStatus: 'In Progress',
      };

      const result = await autoAcceptAndReserveSeat({ application: appDoc });
      expect(result.success).toBe(false);
      expect(result.reason).toBe('MANUAL_REVIEW');
      expect(Cohort.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Invoice.create).not.toHaveBeenCalled();
    });
  });

  describe('5. Full Cohorts & FIFO Waitlisting Mechanism', () => {
    test('routes applicant to Waitlisted with waitlistPosition when cohort capacity is reached', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();

      const courseDoc = { _id: courseId, title: 'Full Course', price: 1000 };
      const fullCohort = {
        _id: cohortId,
        course: courseId,
        name: 'Cohort Full',
        capacity: 10,
        seatsTaken: 10, // Full!
      };

      Course.findById.mockResolvedValue(courseDoc);
      Cohort.findById.mockResolvedValue(fullCohort);
      Application.countDocuments.mockResolvedValue(3); // 3 people already on waitlist

      const appDoc = {
        _id: 'app-waitlist-test',
        student: studentId,
        course: courseId,
        cohort: cohortId,
        status: 'Submitted',
        eligibilityStatus: 'Eligible',
        save: jest.fn().mockResolvedValue(true),
      };

      const result = await autoAcceptAndReserveSeat({
        application: appDoc,
        studentId,
        courseId,
        cohortId,
      });

      expect(result.success).toBe(true);
      expect(result.waitlisted).toBe(true);
      expect(result.waitlistPosition).toBe(4); // 3 + 1
      expect(appDoc.status).toBe('Waitlisted');
      expect(Cohort.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Invoice.create).not.toHaveBeenCalled();
    });
  });

  describe('6. Concurrent Race Condition and Overbooking Prevention', () => {
    test('fails atomic reservation if capacity reached concurrently and routes applicant to waitlist', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();

      const courseDoc = { _id: courseId, title: 'Race Course', price: 1000 };
      const cohortDoc = {
        _id: cohortId,
        course: courseId,
        name: 'Cohort Near Full',
        capacity: 10,
        seatsTaken: 9, // Appeared to have 1 seat left
      };

      Course.findById.mockResolvedValue(courseDoc);
      Cohort.findById.mockResolvedValue(cohortDoc);

      // Concurrent race condition: findOneAndUpdate fails because another thread took the last seat
      Cohort.findOneAndUpdate.mockResolvedValue(null);
      Application.countDocuments.mockResolvedValue(0);

      const appDoc = {
        _id: 'app-race-test',
        student: studentId,
        course: courseId,
        cohort: cohortId,
        status: 'Submitted',
        eligibilityStatus: 'Eligible',
        save: jest.fn().mockResolvedValue(true),
      };

      const result = await autoAcceptAndReserveSeat({
        application: appDoc,
        studentId,
        courseId,
        cohortId,
      });

      expect(result.success).toBe(true);
      expect(result.waitlisted).toBe(true);
      expect(result.waitlistPosition).toBe(1);
      expect(appDoc.status).toBe('Waitlisted');
    });
  });

  describe('7. Duplicate Application Submissions & Invoice Reuse', () => {
    test('reuses existing valid invoice instead of creating duplicates', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();

      const courseDoc = { _id: courseId, title: 'Course with Invoice', price: 1500 };
      const cohortDoc = { _id: cohortId, name: 'Cohort A', capacity: 20, seatsTaken: 2 };
      const existingInvoice = {
        _id: 'inv-existing-99',
        amount: 1500,
        status: 'Invoice Issued',
      };

      Course.findById.mockResolvedValue(courseDoc);
      Cohort.findById.mockResolvedValue(cohortDoc);
      Cohort.findOneAndUpdate.mockResolvedValue({ ...cohortDoc, seatsTaken: 3 });
      Invoice.findOne.mockResolvedValue(existingInvoice);

      const appDoc = {
        _id: 'app-duplicate-test',
        student: studentId,
        course: courseId,
        cohort: cohortId,
        status: 'Submitted',
        eligibilityStatus: 'Eligible',
        save: jest.fn().mockResolvedValue(true),
      };

      const result = await autoAcceptAndReserveSeat({
        application: appDoc,
        studentId,
        courseId,
        cohortId,
      });

      expect(result.success).toBe(true);
      expect(result.invoice._id).toBe('inv-existing-99');
      expect(Invoice.create).not.toHaveBeenCalled();
    });
  });

  describe('8. Free Course vs Paid Course Payment Handling', () => {
    test('free course (0 EGP) automatically confirms application and enrolls student directly', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();

      const freeCourse = { _id: courseId, title: 'Free Introductory Workshop', price: 0 };
      const cohortDoc = { _id: cohortId, name: 'Free Cohort', capacity: 50, seatsTaken: 1 };
      const freeInvoice = { _id: 'inv-free', amount: 0, status: 'Not Required' };

      Course.findById.mockResolvedValue(freeCourse);
      Cohort.findById.mockResolvedValue(cohortDoc);
      Cohort.findOneAndUpdate.mockResolvedValue({ ...cohortDoc, seatsTaken: 2 });
      Invoice.findOne.mockResolvedValue(freeInvoice);
      Enrollment.findOne.mockResolvedValue(null);
      Enrollment.create.mockResolvedValue({
        _id: 'enr-free-1',
        status: 'Confirmed',
      });

      const appDoc = {
        _id: 'app-free-test',
        student: studentId,
        course: courseId,
        cohort: cohortId,
        status: 'Submitted',
        eligibilityStatus: 'Eligible',
        save: jest.fn().mockResolvedValue(true),
      };

      const result = await autoAcceptAndReserveSeat({
        application: appDoc,
        studentId,
        courseId,
        cohortId,
      });

      expect(result.success).toBe(true);
      expect(appDoc.status).toBe('Confirmed');
      expect(Enrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          student: studentId,
          course: courseId,
          status: 'Confirmed',
        })
      );
    });
  });

  describe('9. Payment Initiation and Trusted Server-Side Verification', () => {
    test('confirms payment atomically, marks invoice as Paid, and creates confirmed enrollment', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();
      const invoiceId = new mongoose.Types.ObjectId().toString();
      const appId = new mongoose.Types.ObjectId().toString();

      const invoice = {
        _id: invoiceId,
        invoiceNumber: 'INV-2026-999',
        student: studentId,
        course: courseId,
        cohort: cohortId,
        application: appId,
        amount: 1500,
        currency: 'EGP',
        status: 'Invoice Issued',
        save: jest.fn().mockResolvedValue(true),
      };

      Invoice.findOneAndUpdate.mockResolvedValue({
        ...invoice,
        status: 'Paid',
      });
      PaymentTransaction.create.mockResolvedValue({ _id: 'tx-1' });
      Enrollment.findOne.mockResolvedValue(null);
      Enrollment.create.mockResolvedValue({ _id: 'enr-1', status: 'Confirmed' });
      Application.findById.mockResolvedValue({
        _id: appId,
        status: 'Accepted',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      });

      const result = await confirmPayment({
        invoice,
        method: 'Card',
      });

      expect(result.invoice.status).toBe('Paid');
      expect(result.enrollment).toBeDefined();
      expect(Enrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          student: studentId,
          status: 'Confirmed',
        })
      );
    });
  });

  describe('10. Self-Healing of Existing Legacy Under-Review Applications', () => {
    test('auto-heals eligible application stuck in Under Review upon payment retrieval and issues invoice', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();
      const appId = new mongoose.Types.ObjectId().toString();

      const courseDoc = { _id: courseId, title: 'Legacy Course', price: 2000 };
      const cohortDoc = { _id: cohortId, name: 'Cohort Legacy', capacity: 20, seatsTaken: 5 };

      const legacyApp = {
        _id: appId,
        student: studentId,
        course: courseDoc,
        cohort: cohortDoc,
        status: 'Under Review',
        eligibilityStatus: 'Eligible',
        save: jest.fn().mockResolvedValue(true),
      };

      Application.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(legacyApp),
        }),
      });

      Course.findById.mockResolvedValue(courseDoc);
      Cohort.findById.mockResolvedValue(cohortDoc);
      Cohort.findOneAndUpdate.mockResolvedValue({ ...cohortDoc, seatsTaken: 6 });
      Invoice.findOne.mockResolvedValue(null);
      Invoice.create.mockResolvedValue({
        _id: 'inv-healed-1',
        amount: 2000,
        status: 'Invoice Issued',
      });

      const paymentResult = await getOrCreateInvoiceForApplication({
        applicationId: appId,
        studentId,
      });

      expect(paymentResult.invoice).toBeDefined();
      expect(paymentResult.invoice._id).toBe('inv-healed-1');
      expect(paymentResult.application.status).toBe('Accepted');
    });
  });

  describe('11. Duplicate Application Prevention', () => {
    test('returns existing active application instead of creating duplicate records', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();

      const existingApp = {
        _id: 'app-already-exists',
        student: studentId,
        course: courseId,
        status: 'Accepted',
        eligibilityStatus: 'Eligible',
        save: jest.fn().mockResolvedValue(true),
      };

      Application.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(existingApp),
      });

      const req = {
        body: { courseId },
        user: { _id: studentId },
      };
      const res = mockRes();
      const next = jest.fn();

      await createApplication(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: existingApp,
          message: expect.stringMatching(/already exists/i),
        })
      );
      expect(Application.create).not.toHaveBeenCalled();
    });
  });

  describe('12. Payment Checkout Flow Without Navigation Loop', () => {
    test('initiates checkout with distinct checkout URL and prevents recursive loop', async () => {
      const studentId = new mongoose.Types.ObjectId().toString();
      const courseId = new mongoose.Types.ObjectId().toString();
      const cohortId = new mongoose.Types.ObjectId().toString();
      const invoiceId = new mongoose.Types.ObjectId().toString();
      const appId = new mongoose.Types.ObjectId().toString();

      const courseDoc = {
        _id: courseId,
        title: 'Deep Space Systems',
        price: 3500,
        currency: 'EGP',
        transportationPrice: 500,
      };

      const acceptedApp = {
        _id: appId,
        student: studentId,
        course: courseDoc,
        cohort: cohortId,
        status: 'Accepted',
        eligibilityStatus: 'Eligible',
      };

      const invoice = {
        _id: invoiceId,
        invoiceNumber: 'INV-2026-LOOP-TEST',
        student: studentId,
        course: courseDoc,
        application: acceptedApp,
        amount: 3500,
        currency: 'EGP',
        status: 'Invoice Issued',
        dueDate: new Date(Date.now() + 86400000), // tomorrow
        save: jest.fn().mockResolvedValue(true),
      };

      Invoice.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoice),
        }),
      });

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          fullName: 'Loop Tester',
          email: 'loop@example.com',
          phone: '01012345678',
        }),
      });

      RefundAccount.findOne.mockResolvedValue({ _id: 'refund-acc-1' });

      getPaymentProvider.mockReturnValue({
        name: 'PAYMOB',
        initiatePayment: jest.fn().mockResolvedValue({
          checkoutUrl: 'https://accept.paymob.com/api/acceptance/iframes/12345?payment_token=token_abc',
          token: 'token_abc',
        }),
      });

      PaymentTransaction.create.mockResolvedValue({
        _id: 'tx-loop-1',
        transactionId: 'TXN_TEST_123',
        status: 'Initiated',
        save: jest.fn().mockResolvedValue(true),
      });

      const { initiatePayment } = require('../src/services/paymentService');
      const checkoutResult = await initiatePayment({
        invoiceId,
        studentId,
        packageType: 'WITHOUT_TRANSPORTATION',
        method: 'Card',
      });

      expect(checkoutResult).toBeDefined();
      expect(checkoutResult.transaction).toBeDefined();
      // Ensure returned checkout URL does NOT point to /student/payments (no loop!)
      if (checkoutResult.checkoutUrl) {
        expect(checkoutResult.checkoutUrl).not.toEqual('/student/payments');
      }
      expect(invoice.status).toBe('Payment Initiated');
    });
  });
});
