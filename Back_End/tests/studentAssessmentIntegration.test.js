jest.mock('../src/models/User');
jest.mock('../src/models/Course');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Assessment');
jest.mock('../src/models/StudentSubmission');
jest.mock('../src/models/AssessmentResult');
jest.mock('../src/models/Notification');
jest.mock('../src/services/notificationService');

const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Enrollment = require('../src/models/Enrollment');
const Assessment = require('../src/models/Assessment');
const StudentSubmission = require('../src/models/StudentSubmission');
const AssessmentResult = require('../src/models/AssessmentResult');
const Notification = require('../src/models/Notification');
const { notify } = require('../src/services/notificationService');

const assessmentService = require('../src/services/assessmentService');

describe('EGSA Space Academy — Student Assessment Workflow Integration Tests', () => {
  const studentUser = {
    _id: '507f191e810c19729de860ea',
    fullName: 'Cadet Sara',
    email: 'sara@space.egsa.gov.eg',
    role: 'student',
  };

  const courseId = '507f1f77bcf86cd799439011';
  const enrolledCohortId = '507f1f77bcf86cd799439022';
  const otherCohortId = '507f1f77bcf86cd799439033';
  const enrollmentId = '507f1f77bcf86cd799439044';

  beforeEach(() => {
    Notification.create.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Cohort Enrolled Assessments View & Scoping', () => {
    test('Student only sees assessments belonging to their active/confirmed cohort', async () => {
      Enrollment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([
            {
              _id: enrollmentId,
              student: studentUser._id,
              course: { _id: courseId, title: 'Satellite Engineering' },
              cohort: { _id: enrolledCohortId, name: 'Cohort 2026-A' },
              status: 'Active',
            },
          ]),
        }),
      });

      const mockAssessment1 = {
        _id: '607f1f77bcf86cd799439055',
        title: 'Satellite Orbital Mechanics Lab',
        course: { _id: courseId, title: 'Satellite Engineering' },
        cohort: { _id: enrolledCohortId, name: 'Cohort 2026-A' },
        dueDate: new Date(Date.now() + 86400000), // tomorrow
        status: 'Scheduled',
        maxScore: 100,
        submissionType: 'file',
        allowLateSubmission: false,
        allowResubmission: true,
      };

      Assessment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockResolvedValue([mockAssessment1]),
            }),
          }),
        }),
      });

      StudentSubmission.find.mockResolvedValue([]);
      AssessmentResult.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      });

      const data = await assessmentService.getStudentAssessments(studentUser._id);

      expect(data.sections.upcoming).toHaveLength(1);
      expect(data.sections.upcoming[0].title).toBe('Satellite Orbital Mechanics Lab');
      expect(data.sections.submitted).toHaveLength(0);
      expect(data.sections.evaluated).toHaveLength(0);
      expect(data.summary.totalAssessments).toBe(1);
      expect(data.summary.upcomingCount).toBe(1);
    });

    test('Returns empty sections if student has no active enrollments', async () => {
      Enrollment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([]),
        }),
      });

      const data = await assessmentService.getStudentAssessments(studentUser._id);
      expect(data.assessments).toEqual([]);
      expect(data.sections.upcoming).toEqual([]);
      expect(data.summary.totalAssessments).toBe(0);
    });
  });

  describe('2. Assessment Details Access & IDOR Prevention', () => {
    test('Allows student to view assessment details for their enrolled cohort', async () => {
      const mockAssessment = {
        _id: '607f1f77bcf86cd799439055',
        title: 'Satellite Orbital Mechanics Lab',
        description: 'Complete Keplerian orbital calculations.',
        instructions: 'Use the provided orbital dataset to compute delta-V.',
        attachments: [
          {
            fileName: 'kepler_dataset.csv',
            originalName: 'kepler_dataset.csv',
            fileUrl: '/uploads/assessments/kepler_dataset.csv',
            mimeType: 'text/csv',
            sizeBytes: 1024,
          },
        ],
        course: { _id: courseId, title: 'Satellite Engineering' },
        cohort: { _id: enrolledCohortId, name: 'Cohort 2026-A' },
        maxScore: 100,
        submissionType: 'both',
        dueDate: new Date(Date.now() + 86400000),
      };

      Assessment.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockAssessment),
          }),
        }),
      });

      Enrollment.findOne.mockResolvedValue({
        _id: enrollmentId,
        student: studentUser._id,
        cohort: enrolledCohortId,
        status: 'Active',
      });

      StudentSubmission.findOne.mockResolvedValue(null);
      AssessmentResult.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const details = await assessmentService.getAssessmentById(mockAssessment._id, studentUser);

      expect(details.assessment.title).toBe('Satellite Orbital Mechanics Lab');
      expect(details.assessment.instructions).toContain('orbital dataset');
      expect(details.assessment.attachments).toHaveLength(1);
      expect(details.submissionStatus).toBe('Not Submitted');
      expect(details.evaluationStatus).toBe('Not Evaluated');
      expect(details.result).toBeNull();
    });

    test('Prevents IDOR: Rejects student viewing assessment from an unenrolled cohort with 403', async () => {
      const foreignAssessment = {
        _id: '607f1f77bcf86cd799439099',
        title: 'Deep Space Navigation',
        cohort: { _id: otherCohortId, name: 'Cohort 2026-B' },
      };

      Assessment.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(foreignAssessment),
          }),
        }),
      });

      Enrollment.findOne.mockResolvedValue(null);

      await expect(
        assessmentService.getAssessmentById(foreignAssessment._id, studentUser)
      ).rejects.toThrow(/not authorized to view this assessment/i);
    });
  });

  describe('3. Student Submission & Policies Verification', () => {
    test('Successful submission with text answer and file upload', async () => {
      const mockAssessment = {
        _id: '607f1f77bcf86cd799439055',
        title: 'Satellite Orbital Mechanics Lab',
        course: courseId,
        cohort: enrolledCohortId,
        submissionType: 'both',
        dueDate: new Date(Date.now() + 86400000),
        allowLateSubmission: false,
        allowResubmission: true,
      };

      Assessment.findById.mockResolvedValue(mockAssessment);

      Enrollment.findOne.mockResolvedValue({
        _id: enrollmentId,
        student: studentUser._id,
        course: courseId,
        cohort: enrolledCohortId,
        status: 'Active',
      });

      StudentSubmission.findOne.mockResolvedValue(null);

      const createdSubmission = {
        _id: 'sub-101',
        assessment: mockAssessment._id,
        student: studentUser._id,
        course: courseId,
        cohort: enrolledCohortId,
        enrollment: enrollmentId,
        submissionType: 'both',
        textAnswer: 'Calculation yields delta-V of 1450 m/s.',
        file: {
          fileName: 'submission-cadet.pdf',
          originalName: 'orbital_report.pdf',
          fileUrl: '/uploads/assessments/submission-cadet.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
        },
        version: 1,
        status: 'Submitted',
        isLate: false,
      };

      StudentSubmission.create.mockResolvedValue(createdSubmission);

      const file = {
        filename: 'submission-cadet.pdf',
        originalname: 'orbital_report.pdf',
        mimetype: 'application/pdf',
        size: 2048,
      };

      const result = await assessmentService.submitAssessment(
        mockAssessment._id,
        studentUser,
        { textAnswer: 'Calculation yields delta-V of 1450 m/s.' },
        file
      );

      expect(result.status).toBe('Submitted');
      expect(result.version).toBe(1);
      expect(result.isLate).toBe(false);
      expect(StudentSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          student: studentUser._id,
          submissionType: 'both',
          version: 1,
        })
      );
    });

    test('Rejects submission after deadline when allowLateSubmission is false', async () => {
      const pastDeadlineAssessment = {
        _id: '607f1f77bcf86cd799439055',
        title: 'Satellite Orbital Mechanics Lab',
        course: courseId,
        cohort: enrolledCohortId,
        submissionType: 'text',
        dueDate: new Date(Date.now() - 3600000), // 1 hour ago
        allowLateSubmission: false,
      };

      Assessment.findById.mockResolvedValue(pastDeadlineAssessment);
      Enrollment.findOne.mockResolvedValue({ _id: enrollmentId, status: 'Active' });

      await expect(
        assessmentService.submitAssessment(pastDeadlineAssessment._id, studentUser, { textAnswer: 'Late work' }, null)
      ).rejects.toThrow(/Submission deadline has passed/i);
    });

    test('Allows late submission and marks isLate: true when allowLateSubmission is true', async () => {
      const pastDeadlineAssessment = {
        _id: '607f1f77bcf86cd799439055',
        title: 'Satellite Orbital Mechanics Lab',
        course: courseId,
        cohort: enrolledCohortId,
        submissionType: 'text',
        dueDate: new Date(Date.now() - 3600000),
        allowLateSubmission: true,
        allowResubmission: true,
      };

      Assessment.findById.mockResolvedValue(pastDeadlineAssessment);
      Enrollment.findOne.mockResolvedValue({ _id: enrollmentId, status: 'Active' });
      StudentSubmission.findOne.mockResolvedValue(null);

      const lateSubmission = {
        _id: 'sub-late',
        status: 'Submitted',
        isLate: true,
        version: 1,
      };
      StudentSubmission.create.mockResolvedValue(lateSubmission);

      const result = await assessmentService.submitAssessment(
        pastDeadlineAssessment._id,
        studentUser,
        { textAnswer: 'Completed late with instructor notice.' },
        null
      );

      expect(result.isLate).toBe(true);
      expect(StudentSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({ isLate: true })
      );
    });

    test('Blocks resubmission when allowResubmission is false', async () => {
      const noResubmitAssessment = {
        _id: '607f1f77bcf86cd799439055',
        submissionType: 'text',
        allowResubmission: false,
        dueDate: new Date(Date.now() + 86400000),
      };

      Assessment.findById.mockResolvedValue(noResubmitAssessment);
      Enrollment.findOne.mockResolvedValue({ _id: enrollmentId, status: 'Active' });

      StudentSubmission.findOne.mockResolvedValue({
        _id: 'existing-sub',
        version: 1,
        status: 'Submitted',
      });

      await expect(
        assessmentService.submitAssessment(noResubmitAssessment._id, studentUser, { textAnswer: 'New edit' }, null)
      ).rejects.toThrow(/resubmission is not permitted/i);
    });

    test('Handles resubmission when allowResubmission is true: archives history and increments version', async () => {
      const resubmitAssessment = {
        _id: '607f1f77bcf86cd799439055',
        allowResubmission: true,
        submissionType: 'text',
        dueDate: new Date(Date.now() + 86400000),
      };

      Assessment.findById.mockResolvedValue(resubmitAssessment);
      Enrollment.findOne.mockResolvedValue({ _id: enrollmentId, status: 'Active' });
      AssessmentResult.findOne.mockResolvedValue(null); // No finalized evaluation yet

      const existingSubmission = {
        _id: 'existing-sub',
        version: 1,
        status: 'Submitted',
        textAnswer: 'Version 1 answer',
        file: null,
        history: [],
        save: jest.fn().mockResolvedValue(this),
      };

      StudentSubmission.findOne.mockResolvedValue(existingSubmission);

      const updated = await assessmentService.submitAssessment(
        resubmitAssessment._id,
        studentUser,
        { textAnswer: 'Version 2 improved analysis' },
        null
      );

      expect(existingSubmission.version).toBe(2);
      expect(existingSubmission.textAnswer).toBe('Version 2 improved analysis');
      expect(existingSubmission.history).toHaveLength(1);
      expect(existingSubmission.history[0].version).toBe(1);
      expect(existingSubmission.save).toHaveBeenCalled();
    });
  });

  describe('4. Draft vs Published Evaluation Privacy Protection', () => {
    test('CRITICAL: Draft or Finalized evaluations MUST NEVER be exposed to the student', async () => {
      const mockAssessment = {
        _id: '607f1f77bcf86cd799439055',
        title: 'Antenna Array Synthesis',
        course: { _id: courseId },
        cohort: { _id: enrolledCohortId },
      };

      Assessment.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockAssessment),
          }),
        }),
      });

      Enrollment.findOne.mockResolvedValue({ _id: enrollmentId, status: 'Active' });
      StudentSubmission.findOne.mockResolvedValue({
        _id: 'sub-draft',
        status: 'Submitted',
        version: 1,
      });

      // Draft evaluation by Instructor with internal confidential feedback
      AssessmentResult.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'result-draft',
          status: 'Draft',
          score: 75,
          maxScore: 100,
          feedback: 'Student made several minor calculation errors in antenna gain.',
          instructorNote: 'CONFIDENTIAL: Candidate struggled on radiation pattern.',
        }),
      });

      const details = await assessmentService.getAssessmentById(mockAssessment._id, studentUser);

      // Result MUST be null and status MUST be 'Pending Evaluation'
      expect(details.result).toBeNull();
      expect(details.evaluationStatus).toBe('Pending');
      expect(details.submissionStatus).toBe('Submitted');
    });

    test('Published evaluation displays score, percentage, feedback, strengths, and areas for improvement', async () => {
      const mockAssessment = {
        _id: '607f1f77bcf86cd799439055',
        title: 'Antenna Array Synthesis',
        course: { _id: courseId },
        cohort: { _id: enrolledCohortId },
      };

      Assessment.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockAssessment),
          }),
        }),
      });

      Enrollment.findOne.mockResolvedValue({ _id: enrollmentId, status: 'Active' });
      StudentSubmission.findOne.mockResolvedValue({
        _id: 'sub-pub',
        status: 'Submitted',
        version: 1,
      });

      AssessmentResult.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'result-pub',
          status: 'Published',
          score: 94,
          maxScore: 100,
          percentage: 94,
          resultLabel: 'Passed',
          feedback: 'Superb impedance matching and phased array modeling.',
          strengths: 'Rigorous S-parameter analysis and clear radiation pattern plots.',
          improvementAreas: 'Consider adding thermal noise budget calculations.',
          evaluatedAt: new Date('2026-09-27'),
          instructor: { fullName: 'Dr. Tarek Space Systems' },
        }),
      });

      const details = await assessmentService.getAssessmentById(mockAssessment._id, studentUser);

      expect(details.result).not.toBeNull();
      expect(details.result.score).toBe(94);
      expect(details.result.maxScore).toBe(100);
      expect(details.result.percentage).toBe(94);
      expect(details.result.status).toBe('Evaluated');
      expect(details.result.feedback).toBe('Superb impedance matching and phased array modeling.');
      expect(details.result.strengths).toContain('S-parameter analysis');
      expect(details.result.improvementAreas).toContain('thermal noise');
      expect(details.evaluationStatus).toBe('Evaluated');
    });
  });
});
