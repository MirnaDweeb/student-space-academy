jest.mock('../src/models/Course');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Application');
jest.mock('../src/models/StudentProfile');
jest.mock('../src/models/ReadinessQuestion');
jest.mock('../src/models/ReadinessAttempt');
jest.mock('../src/models/Invoice');
jest.mock('../src/services/notificationService');

const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Application = require('../src/models/Application');
const StudentProfile = require('../src/models/StudentProfile');
const ReadinessQuestion = require('../src/models/ReadinessQuestion');
const ReadinessAttempt = require('../src/models/ReadinessAttempt');
const Invoice = require('../src/models/Invoice');
const { notify } = require('../src/services/notificationService');

const { crossfitCourse, crossfitQuestions } = require('../src/seed/data/crossfitCourseData');
const { scoreAttempt } = require('../src/services/readinessService');
const { startAssessment, submitAssessment } = require('../src/controllers/readinessController');
const { createApplication } = require('../src/controllers/applicationController');
const { getOrCreateInvoiceForApplication } = require('../src/services/paymentService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('CrossFit Readiness Assessment & Admissions-To-Payment Flow', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. CrossFit Assessment Configuration & Question Bank', () => {
    test('contains the official CrossFit course with 12 comprehensive multiple-choice questions', () => {
      expect(crossfitCourse).toBeDefined();
      expect(crossfitCourse.title).toContain('CrossFit');
      expect(crossfitCourse.slug).toBe('crossfit-functional-fitness-program');
      expect(crossfitCourse.price).toBe(1500);
      expect(crossfitCourse.category).toBe('Physical Conditioning & Human Spaceflight');

      expect(crossfitQuestions).toHaveLength(12);

      // Verify all 12 domains are represented with 3-4 options and valid answer indices
      crossfitQuestions.forEach((q, idx) => {
        expect(q.question).toBeDefined();
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(q.options.length).toBeLessThanOrEqual(4);
        expect(q.correctAnswerIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctAnswerIndex).toBeLessThan(q.options.length);
        expect(q.topic).toBeDefined();
      });
    });
  });

  describe('2. Question Delivery & Answer Security', () => {
    test('startAssessment returns questions WITHOUT exposing correctAnswerIndex to the client', async () => {
      const mockCourse = {
        _id: 'crossfit-course-123',
        title: 'CrossFit & Functional Fitness Program',
        slug: 'crossfit-functional-fitness-program',
      };
      Course.findById.mockResolvedValue(mockCourse);

      const mockDbQuestions = crossfitQuestions.map((q, idx) => ({
        _id: `q-${idx}`,
        question: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        topic: q.topic,
        difficulty: q.difficulty,
      }));

      ReadinessQuestion.aggregate.mockResolvedValue(mockDbQuestions);
      ReadinessAttempt.create.mockResolvedValue({
        _id: 'attempt-xyz',
        student: 'student-123',
        course: mockCourse._id,
        questions: mockDbQuestions.map((q) => q._id),
        status: 'InProgress',
      });

      const req = {
        body: { courseId: mockCourse._id },
        user: { _id: 'student-123' },
      };
      const res = mockRes();
      const next = jest.fn();

      await startAssessment(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      const data = res.json.mock.calls[0][0].data;
      expect(data.attemptId).toBe('attempt-xyz');
      expect(data.questions).toHaveLength(12);

      // CRITICAL: Ensure correctAnswerIndex is NOT in the response payload
      data.questions.forEach((clientQ) => {
        expect(clientQ.correctAnswerIndex).toBeUndefined();
        expect(clientQ.question).toBeDefined();
        expect(clientQ.options).toBeDefined();
        expect(clientQ.topic).toBeDefined();
      });
    });
  });

  describe('3. Server-Side Scoring & Outcome Tiers', () => {
    const questions = crossfitQuestions.map((q, idx) => ({
      _id: `q-${idx}`,
      topic: q.topic,
      correctAnswerIndex: q.correctAnswerIndex,
    }));
    const course = {
      title: 'CrossFit & Functional Fitness Program',
      slug: 'crossfit-functional-fitness-program',
      minReadinessScore: 80,
      recommendedPreviousCourses: [],
    };

    test('80–100% yields READY outcome', async () => {
      // 10 correct out of 12 = 83.3%
      const answers = questions.map((q, idx) => ({
        question: q._id,
        isCorrect: idx < 10,
      }));
      const attempt = { answers, questions };

      const result = await scoreAttempt(attempt, course);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.outcome).toBe('READY');
    });

    test('50–79% yields FOUNDATION_REQUIRED outcome with identified gaps', async () => {
      // 7 correct out of 12 = 58.3%
      const answers = questions.map((q, idx) => ({
        question: q._id,
        isCorrect: idx < 7,
      }));
      const attempt = { answers, questions };

      const result = await scoreAttempt(attempt, course);
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(80);
      expect(result.outcome).toBe('FOUNDATION_REQUIRED');
      expect(result.knowledgeGaps.length).toBeGreaterThan(0);
    });

    test('Below 50% yields MANUAL_REVIEW outcome', async () => {
      // 4 correct out of 12 = 33.3%
      const answers = questions.map((q, idx) => ({
        question: q._id,
        isCorrect: idx < 4,
      }));
      const attempt = { answers, questions };

      const result = await scoreAttempt(attempt, course);
      expect(result.score).toBeLessThan(50);
      expect(result.outcome).toBe('MANUAL_REVIEW');
    });
  });

  describe('4. Submission Validation & Idempotency Protection', () => {
    test('rejects empty or missing answers array with 400 error', async () => {
      const req = {
        params: { attemptId: 'attempt-1' },
        body: { answers: [] },
        user: { _id: 'student-1' },
      };
      const res = mockRes();
      const next = jest.fn();

      await submitAssessment(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Assessment submission must contain an array of answers.',
          statusCode: 400,
        })
      );
    });

    test('rejects re-submission of already submitted attempt with 400 error', async () => {
      const mockAttempt = {
        _id: 'attempt-1',
        status: 'Submitted',
        student: 'student-1',
        populate: jest.fn().mockReturnThis(),
      };
      ReadinessAttempt.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAttempt),
      });

      const req = {
        params: { attemptId: 'attempt-1' },
        body: { answers: [{ questionId: 'q-1', selectedIndex: 0 }] },
        user: { _id: 'student-1' },
      };
      const res = mockRes();
      const next = jest.fn();

      await submitAssessment(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Assessment already submitted.',
          statusCode: 400,
        })
      );
    });
  });

  describe('5. Application Linking & Duplicate Prevention', () => {
    test('createApplication returns existing active application without creating a duplicate', async () => {
      const course = { _id: 'course-crossfit', title: 'CrossFit', price: 1500 };
      Course.findById.mockResolvedValue(course);
      StudentProfile.findOne.mockResolvedValue({ _id: 'profile-1' });

      const existingApp = {
        _id: 'app-existing-1',
        student: 'student-1',
        course: course._id,
        status: 'Under Review',
        readinessAttempt: 'attempt-old',
        save: jest.fn().mockResolvedValue(true),
      };

      Application.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(existingApp),
      });

      const req = {
        body: { courseId: course._id, readinessAttemptId: 'attempt-new' },
        user: { _id: 'student-1' },
      };
      const res = mockRes();
      const next = jest.fn();

      await createApplication(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(Application.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: existingApp,
          message: 'Active application already exists for this course.',
        })
      );
    });
  });

  describe('6. Admission Rules & Payment Access Gating', () => {
    test('denies payment access for applications not yet formally Accepted', async () => {
      const unapprovedApp = {
        _id: 'app-pending-review',
        student: 'student-1',
        status: 'Under Review',
        populate: jest.fn().mockReturnThis(),
      };

      Application.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(unapprovedApp),
        }),
      });

      await expect(
        getOrCreateInvoiceForApplication({
          applicationId: unapprovedApp._id,
          studentId: 'student-1',
        })
      ).rejects.toThrow(/Payment is not accessible/);
    });

    test('permits payment access and returns invoice when application is Accepted', async () => {
      const course = { _id: 'course-1', price: 1500, transportationPrice: 500, currency: 'EGP' };
      const acceptedApp = {
        _id: 'app-accepted',
        student: 'student-1',
        status: 'Accepted',
        course,
        cohort: { _id: 'cohort-1' },
        populate: jest.fn().mockReturnThis(),
      };

      Application.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(acceptedApp),
        }),
      });

      const existingInvoice = {
        _id: 'invoice-100',
        application: acceptedApp._id,
        student: 'student-1',
        status: 'Invoice Issued',
        amount: 1500,
        save: jest.fn().mockResolvedValue(true),
      };

      Invoice.findOne.mockResolvedValue(existingInvoice);

      const result = await getOrCreateInvoiceForApplication({
        applicationId: acceptedApp._id,
        studentId: 'student-1',
      });

      expect(result.invoice).toBeDefined();
      expect(result.invoice._id).toBe('invoice-100');
      expect(result.application.status).toBe('Accepted');
    });
  });
});
