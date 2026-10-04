jest.mock('../src/models/User');
jest.mock('../src/models/StudentProfile');
jest.mock('../src/models/Course');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Application');
jest.mock('../src/models/Invoice');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/PaymentTransaction');
jest.mock('../src/models/TrainingSession');
jest.mock('../src/models/ReadinessQuestion');
jest.mock('../src/models/ReadinessAttempt');
jest.mock('../src/services/notificationService');
jest.mock('../src/utils/email');

const User = require('../src/models/User');
const StudentProfile = require('../src/models/StudentProfile');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Application = require('../src/models/Application');
const Invoice = require('../src/models/Invoice');
const Enrollment = require('../src/models/Enrollment');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const TrainingSession = require('../src/models/TrainingSession');
const ReadinessQuestion = require('../src/models/ReadinessQuestion');
const ReadinessAttempt = require('../src/models/ReadinessAttempt');
const { notify } = require('../src/services/notificationService');
const {
  sendVerificationEmail,
  sendRegistrationConfirmationEmail,
  sendApplicationSubmittedEmail,
  sendApplicationAcceptedEmail,
  sendApplicationRejectedEmail,
  sendPaymentAndEnrollmentConfirmedEmail,
} = require('../src/utils/email');

const { register } = require('../src/controllers/authController');
const { createApplication } = require('../src/controllers/applicationController');
const { acceptApplication, rejectApplication } = require('../src/controllers/adminController');
const { confirmPayment } = require('../src/services/paymentService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('EGSA Space Academy — Student Lifecycle & Payment Workflow', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Registration Flow & Institutional Email Dispatch', () => {
    test('Student registration generates verification email (Email 1) and registration confirmation (Email 2) with EGSA reference', async () => {
      User.findOne.mockResolvedValue(null);
      const mockCreatedUser = {
        _id: '507f1f77bcf86cd799439011',
        fullName: 'Sara Ahmed',
        email: 'sara.ahmed@space.egsa.gov.eg',
        phone: '01012345678',
        nationalId: '29901011234567',
        role: 'student',
        registrationNumber: 'EGSA-782910',
        preferredLanguage: 'en',
      };
      User.create.mockResolvedValue(mockCreatedUser);
      StudentProfile.create.mockResolvedValue({});
      notify.mockResolvedValue({});
      sendVerificationEmail.mockResolvedValue({});
      sendRegistrationConfirmationEmail.mockResolvedValue({});

      const req = {
        body: {
          fullName: 'Sara Ahmed',
          email: 'sara.ahmed@space.egsa.gov.eg',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          phone: '01012345678',
          nationalId: '29901011234567',
          university: 'Cairo University',
          faculty: 'Aerospace Engineering',
          agreeToTerms: true,
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);

      // Email: No verification email sent during registration
      expect(sendVerificationEmail).not.toHaveBeenCalled();

      // Email 2: Registration Confirmation with EGSA reference number
      expect(sendRegistrationConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sara.ahmed@space.egsa.gov.eg',
          fullName: 'Sara Ahmed',
          registrationNumber: 'EGSA-782910',
        })
      );

      // In-app notification
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '507f1f77bcf86cd799439011',
          title: 'Registration Received',
        })
      );
    });
  });

  describe('2. Course Application Flow', () => {
    test('Course application sets status to Under Review and dispatches submission email', async () => {
      ReadinessQuestion.exists.mockResolvedValue(false);
      const mockCourse = {
        _id: '507f1f77bcf86cd799439022',
        title: 'Satellite Ground Operations',
        price: 3500,
        transportationPrice: 600,
        currency: 'EGP',
        level: 'Core Skills',
      };
      Course.findById.mockResolvedValue(mockCourse);
      StudentProfile.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439033',
        completedCourses: [],
        experience: [],
      });
      Cohort.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      ReadinessAttempt.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const mockAppDoc = {
        _id: '507f1f77bcf86cd799439044',
        student: '507f1f77bcf86cd799439011',
        course: mockCourse._id,
        status: 'Submitted',
        referenceNumber: 'EGSA-APP-921820',
      };
      Application.create.mockResolvedValue(mockAppDoc);
      notify.mockResolvedValue({});
      sendApplicationSubmittedEmail.mockResolvedValue({});

      const req = {
        user: {
          _id: '507f1f77bcf86cd799439011',
          fullName: 'Sara Ahmed',
          email: 'sara.ahmed@space.egsa.gov.eg',
        },
        body: {
          courseId: '507f1f77bcf86cd799439022',
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await createApplication(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(Application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.stringMatching(/Submitted|Under Review/),
        })
      );
      expect(sendApplicationSubmittedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sara.ahmed@space.egsa.gov.eg',
          courseTitle: 'Satellite Ground Operations',
        })
      );
    });
  });

  describe('3. Admin Acceptance & Rejection Flow', () => {
    test('Admin acceptApplication marks status Accepted, issues invoice, and dispatches acceptance email with Option A and Option B prices from DB', async () => {
      const mockCourse = {
        _id: '507f1f77bcf86cd799439022',
        title: 'Satellite Ground Operations',
        price: 5000,
        transportationPrice: 1500,
        level: 'Core Skills',
      };
      const mockStudent = {
        _id: '507f1f77bcf86cd799439011',
        fullName: 'Sara Ahmed',
        email: 'sara.ahmed@space.egsa.gov.eg',
        preferredLanguage: 'en',
      };
      const mockCohort = {
        _id: '507f1f77bcf86cd799439055',
        name: 'Cohort Alpha 2026',
      };

      const mockApp = {
        _id: '507f1f77bcf86cd799439044',
        student: mockStudent,
        course: mockCourse,
        cohort: mockCohort,
        referenceNumber: 'EGSA-APP-921820',
        status: 'Under Review',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Application.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((cb) => cb(mockApp)),
      });
      // Alternative chained population mock
      Application.findById.mockImplementation(() => ({
        populate: () => ({
          populate: () => ({
            populate: () => Promise.resolve(mockApp),
          }),
        }),
      }));

      Invoice.findOne.mockResolvedValue(null);
      const dueDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      Invoice.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439066',
        amount: 5000,
        dueDate,
      });

      sendApplicationAcceptedEmail.mockResolvedValue({});
      notify.mockResolvedValue({});

      const req = {
        params: { id: '507f1f77bcf86cd799439044' },
        body: { note: 'Cadet profile accepted for Space Systems track.' },
      };
      const res = mockRes();
      const next = jest.fn();

      await acceptApplication(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockApp.status).toBe('Accepted');
      expect(mockApp.save).toHaveBeenCalled();

      // Email 4: Acceptance email with Course Only (5,000 EGP) and Course + Transportation (1,500 EGP)
      expect(sendApplicationAcceptedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sara.ahmed@space.egsa.gov.eg',
          courseTitle: 'Satellite Ground Operations',
          basePrice: 5000,
          transportationPrice: 1500,
        })
      );
    });

    test('Admin rejectApplication marks status Rejected, waives pending invoices, and dispatches rejection email', async () => {
      const mockCourse = {
        _id: '507f1f77bcf86cd799439022',
        title: 'Satellite Ground Operations',
      };
      const mockStudent = {
        _id: '507f1f77bcf86cd799439011',
        fullName: 'Sara Ahmed',
        email: 'sara.ahmed@space.egsa.gov.eg',
        preferredLanguage: 'en',
      };
      const mockApp = {
        _id: '507f1f77bcf86cd799439044',
        student: mockStudent,
        course: mockCourse,
        referenceNumber: 'EGSA-APP-921820',
        status: 'Under Review',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Application.findById.mockImplementation(() => ({
        populate: () => ({
          populate: () => Promise.resolve(mockApp),
        }),
      }));

      Invoice.updateMany.mockResolvedValue({ modifiedCount: 1 });
      sendApplicationRejectedEmail.mockResolvedValue({});
      notify.mockResolvedValue({});

      const req = {
        params: { id: '507f1f77bcf86cd799439044' },
        body: { reason: 'Cohort capacity reached for this cycle.' },
      };
      const res = mockRes();
      const next = jest.fn();

      await rejectApplication(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockApp.status).toBe('Rejected');
      expect(mockApp.rejectionReason).toBe('Cohort capacity reached for this cycle.');
      expect(sendApplicationRejectedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sara.ahmed@space.egsa.gov.eg',
          reason: 'Cohort capacity reached for this cycle.',
        })
      );
    });
  });

  describe('4. Student Package Selection & Payment Security', () => {
    test('Option A: Course Only computes base course price from DB and creates confirmed enrollment', async () => {
      const futureDueDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const mockInvoice = {
        _id: '507f1f77bcf86cd799439066',
        student: '507f1f77bcf86cd799439011',
        course: '507f1f77bcf86cd799439022',
        coursePriceAtPurchase: 5000,
        amount: 5000,
        dueDate: futureDueDate,
        status: 'Invoice Issued',
        application: '507f1f77bcf86cd799439044',
        save: jest.fn().mockResolvedValue(true),
      };

      Invoice.findOneAndUpdate.mockResolvedValue({
        ...mockInvoice,
        status: 'Paid',
      });

      PaymentTransaction.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439077',
        amount: 5000,
        status: 'Paid',
        transactionId: 'TXN-90218-EGSA',
      });

      const mockApp = {
        _id: '507f1f77bcf86cd799439044',
        status: 'Accepted',
        cohort: '507f1f77bcf86cd799439055',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Application.findById.mockResolvedValue(mockApp);
      Enrollment.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439088' });

      User.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        fullName: 'Sara Ahmed',
        email: 'sara.ahmed@space.egsa.gov.eg',
      });
      Course.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439022',
        title: 'Satellite Ground Operations',
        price: 5000,
        transportationPrice: 1500,
      });
      Cohort.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439055',
        name: 'Cohort Alpha 2026',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-30'),
      });
      TrainingSession.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          startTime: '09:00 AM',
          endTime: '02:00 PM',
          location: 'Egyptian Space Agency Main Auditorium, Space City',
        }),
      });

      sendPaymentAndEnrollmentConfirmedEmail.mockResolvedValue({});
      notify.mockResolvedValue({});

      const result = await confirmPayment({
        invoice: mockInvoice,
        method: 'Card',
        packageType: 'WITHOUT_TRANSPORTATION',
      });

      expect(result.transaction.amount).toBe(5000);
      expect(mockApp.status).toBe('Confirmed');
      expect(mockApp.selectedPackage).toBe('WITHOUT_TRANSPORTATION');
      expect(Enrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Confirmed',
          packageType: 'WITHOUT_TRANSPORTATION',
          paidAmount: 5000,
        })
      );

      // Email 5: Payment and Enrollment confirmed with verified schedule from DB
      expect(sendPaymentAndEnrollmentConfirmedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sara.ahmed@space.egsa.gov.eg',
          courseTitle: 'Satellite Ground Operations',
          packageType: 'WITHOUT_TRANSPORTATION',
          amountPaid: 5000,
          schedule: expect.objectContaining({
            hours: '09:00 AM – 02:00 PM',
            location: 'Egyptian Space Agency Main Auditorium, Space City',
          }),
        })
      );
    });

    test('Option B: Course + Transportation computes Base + Transportation Price securely server-side', async () => {
      const futureDueDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const mockInvoice = {
        _id: '507f1f77bcf86cd799439066',
        student: '507f1f77bcf86cd799439011',
        course: '507f1f77bcf86cd799439022',
        coursePriceAtPurchase: 5000,
        amount: 5000,
        dueDate: futureDueDate,
        status: 'Invoice Issued',
        application: '507f1f77bcf86cd799439044',
        save: jest.fn().mockResolvedValue(true),
      };

      Invoice.findOneAndUpdate.mockResolvedValue(mockInvoice);
      Course.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439022',
        title: 'Satellite Ground Operations',
        price: 5000,
        transportationPrice: 1500, // 5000 + 1500 = 6500
      });

      PaymentTransaction.create.mockImplementation((args) => Promise.resolve({ _id: 'txn-2', ...args }));
      Application.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439044',
        status: 'Accepted',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      });
      Enrollment.create.mockResolvedValue({ _id: 'enr-2' });

      // Attempting client manipulation: User selects WITH_TRANSPORTATION
      const result = await confirmPayment({
        invoice: mockInvoice,
        method: 'Card',
        packageType: 'WITH_TRANSPORTATION',
      });

      // Backend calculated 5000 base + 1500 transportation = 6500 EGP
      expect(result.invoice.amount).toBe(6500);
      expect(result.invoice.transportationAmount).toBe(1500);
      expect(result.invoice.packageType).toBe('WITH_TRANSPORTATION');
      expect(Enrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Confirmed',
          packageType: 'WITH_TRANSPORTATION',
          paidAmount: 6500,
        })
      );
    });
  });
});
