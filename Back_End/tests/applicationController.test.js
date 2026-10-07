jest.mock('../src/models/Application');
jest.mock('../src/models/Course');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/StudentProfile');
jest.mock('../src/models/ReadinessAttempt');
jest.mock('../src/models/Invoice');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/User');
jest.mock('../src/services/eligibilityService');
jest.mock('../src/services/paymentService');
jest.mock('../src/services/notificationService');

const Application = require('../src/models/Application');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Invoice = require('../src/models/Invoice');
const Enrollment = require('../src/models/Enrollment');
const User = require('../src/models/User');
const StudentProfile = require('../src/models/StudentProfile');
const ReadinessAttempt = require('../src/models/ReadinessAttempt');
const { checkCourseFit } = require('../src/services/eligibilityService');
const { issueInvoice } = require('../src/services/paymentService');
const { notify } = require('../src/services/notificationService');
const { createApplication } = require('../src/controllers/applicationController');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function baseSetup({ cohort, reservedResult }) {
  const course = { _id: 'course-1', title: 'Test Course', price: 3000 };
  Course.findById.mockResolvedValue(course);
  StudentProfile.findOne.mockResolvedValue({ _id: 'profile-1', completedCourses: [], experience: [] });
  checkCourseFit.mockResolvedValue({ result: 'Eligible', reasons: [{ code: 'OK', message: 'ok' }], requiresReadiness: true });
  ReadinessAttempt.findOne.mockResolvedValue({ _id: 'attempt-1', outcome: 'READY' });
  Cohort.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(cohort) });
  Cohort.findOneAndUpdate.mockResolvedValue(reservedResult);
  Application.create.mockImplementation((doc) =>
    Promise.resolve({
      _id: 'app-1',
      ...doc,
      save: jest.fn().mockResolvedValue(true),
    })
  );
  Invoice.findOne = jest.fn().mockResolvedValue(null);
  User.findById = jest.fn().mockResolvedValue({ email: 'test@example.com', fullName: 'Test Student' });
  issueInvoice.mockResolvedValue({ _id: 'invoice-1' });
  notify.mockResolvedValue({});
  return course;
}

describe('createApplication - admissions lifecycle enforcement', () => {
  afterEach(() => jest.clearAllMocks());

  test('creates an application with automatic acceptance, atomic seat reservation, and invoice issuance for eligible candidates', async () => {
    const cohort = { _id: 'cohort-1', capacity: 30, seatsTaken: 10 };
    baseSetup({ cohort, reservedResult: { _id: 'cohort-1', seatsTaken: 11 } });

    const req = { body: { courseId: 'course-1', readinessAttemptId: 'attempt-1' }, user: { _id: 'student-1' } };
    const res = mockRes();
    const next = jest.fn();

    await createApplication(req, res, next);

    expect(next).not.toHaveBeenCalled();
    // Direct admission: atomically reserve seat and issue invoice
    expect(Cohort.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'cohort-1', $expr: { $lt: ['$seatsTaken', '$capacity'] } },
      { $inc: { seatsTaken: 1 } },
      { new: true }
    );
    expect(issueInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        student: 'student-1',
        course: expect.objectContaining({ _id: 'course-1' }),
      })
    );
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
  });

  test('sets eligibilityStatus to Not Started when no readiness attempt is provided and course has assessment', async () => {
    const cohort = { _id: 'cohort-1', capacity: 30, seatsTaken: 10 };
    baseSetup({ cohort, reservedResult: null });
    ReadinessAttempt.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
    const ReadinessQuestion = require('../src/models/ReadinessQuestion');
    ReadinessQuestion.exists = jest.fn().mockResolvedValue(true);

    const req = { body: { courseId: 'course-1' }, user: { _id: 'student-1' } };
    const res = mockRes();
    const next = jest.fn();

    await createApplication(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Submitted',
        eligibilityStatus: 'Not Started',
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('sets status to Foundation Recommended if readiness outcome is FOUNDATION_REQUIRED', async () => {
    const cohort = { _id: 'cohort-1', capacity: 30, seatsTaken: 10 };
    baseSetup({ cohort, reservedResult: null });
    ReadinessAttempt.findOne.mockResolvedValue({ _id: 'attempt-2', outcome: 'FOUNDATION_REQUIRED' });

    const req = { body: { courseId: 'course-1', readinessAttemptId: 'attempt-2' }, user: { _id: 'student-1' } };
    const res = mockRes();
    const next = jest.fn();

    await createApplication(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Foundation Recommended',
        eligibilityStatus: 'Not Eligible',
      })
    );
  });

  test('rejects applications for courses without published pricing instead of issuing a NaN invoice', async () => {
    const course = { _id: 'course-2', title: 'Cybersecurity Course', price: null };
    Course.findById.mockResolvedValue(course);

    const req = { body: { courseId: 'course-2' }, user: { _id: 'student-1' } };
    const res = mockRes();
    const next = jest.fn();

    await createApplication(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/pricing/i) }));
    expect(Application.create).not.toHaveBeenCalled();

    await createApplication(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/pricing/i) }));
    expect(Application.create).not.toHaveBeenCalled();
  });
});
