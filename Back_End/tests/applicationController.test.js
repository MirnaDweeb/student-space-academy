jest.mock('../src/models/Application');
jest.mock('../src/models/Course');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/StudentProfile');
jest.mock('../src/models/ReadinessAttempt');
jest.mock('../src/services/eligibilityService');
jest.mock('../src/services/paymentService');
jest.mock('../src/services/notificationService');

const Application = require('../src/models/Application');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
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
  Application.create.mockImplementation((doc) => Promise.resolve({ _id: 'app-1', ...doc }));
  issueInvoice.mockResolvedValue({ _id: 'invoice-1' });
  notify.mockResolvedValue({});
  return course;
}

describe('createApplication - atomic cohort seat reservation', () => {
  afterEach(() => jest.clearAllMocks());

  test('reserves a seat atomically and marks the application Eligible - Payment Pending when a seat is available', async () => {
    const cohort = { _id: 'cohort-1', capacity: 30, seatsTaken: 10 };
    baseSetup({ cohort, reservedResult: { _id: 'cohort-1', capacity: 30, seatsTaken: 11 } });

    const req = { body: { courseId: 'course-1', readinessAttemptId: 'attempt-1' }, user: { _id: 'student-1' } };
    const res = mockRes();
    const next = jest.fn();

    await createApplication(req, res, next);

    expect(next).not.toHaveBeenCalled();
    // The reservation must be a single conditional update, not a separate check-then-increment.
    expect(Cohort.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'cohort-1', $expr: { $lt: ['$seatsTaken', '$capacity'] } },
      { $inc: { seatsTaken: 1 } },
      { new: true }
    );
    expect(Application.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Eligible - Payment Pending' })
    );
    expect(issueInvoice).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('waitlists the application when the atomic reservation finds no seat left (lost the race)', async () => {
    const cohort = { _id: 'cohort-1', capacity: 30, seatsTaken: 30 };
    // findOneAndUpdate returns null: the $expr condition failed because another
    // request took the last seat between the findOne and this write.
    baseSetup({ cohort, reservedResult: null });

    const req = { body: { courseId: 'course-1', readinessAttemptId: 'attempt-1' }, user: { _id: 'student-1' } };
    const res = mockRes();
    const next = jest.fn();

    await createApplication(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Application.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Waitlisted' })
    );
    expect(issueInvoice).not.toHaveBeenCalled();
  });

  test('two concurrent requests for the last seat cannot both succeed', async () => {
    const cohort = { _id: 'cohort-1', capacity: 1, seatsTaken: 0 };
    const course = baseSetup({ cohort, reservedResult: null });

    // Simulate: first call's atomic update succeeds, second call's fails,
    // as would happen with a real DB enforcing the $expr condition.
    Cohort.findOneAndUpdate
      .mockResolvedValueOnce({ _id: 'cohort-1', capacity: 1, seatsTaken: 1 })
      .mockResolvedValueOnce(null);

    const req1 = { body: { courseId: course._id, readinessAttemptId: 'attempt-1' }, user: { _id: 'student-1' } };
    const req2 = { body: { courseId: course._id, readinessAttemptId: 'attempt-1' }, user: { _id: 'student-2' } };
    const res1 = mockRes();
    const res2 = mockRes();

    await Promise.all([
      createApplication(req1, res1, jest.fn()),
      createApplication(req2, res2, jest.fn()),
    ]);

    const statuses = Application.create.mock.calls.map((call) => call[0].status);
    expect(statuses).toEqual(expect.arrayContaining(['Eligible - Payment Pending', 'Waitlisted']));
    expect(issueInvoice).toHaveBeenCalledTimes(1);
  });

  test('proceeds without seat enforcement when no cohort exists yet for the course (missing capacity data)', async () => {
    baseSetup({ cohort: null, reservedResult: null });

    const req = { body: { courseId: 'course-1', readinessAttemptId: 'attempt-1' }, user: { _id: 'student-1' } };
    const res = mockRes();
    const next = jest.fn();

    await createApplication(req, res, next);

    expect(Cohort.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Application.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Eligible - Payment Pending' })
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
  });
});
