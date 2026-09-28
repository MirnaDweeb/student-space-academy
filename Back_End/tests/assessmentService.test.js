const assessmentService = require('../src/services/assessmentService');
const Assessment = require('../src/models/Assessment');
const AssessmentResult = require('../src/models/AssessmentResult');
const StudentSubmission = require('../src/models/StudentSubmission');
const Enrollment = require('../src/models/Enrollment');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Notification = require('../src/models/Notification');

jest.mock('../src/models/Assessment');
jest.mock('../src/models/AssessmentResult');
jest.mock('../src/models/StudentSubmission');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Course');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Notification');

describe('Assessments & Instructor Evaluation Service Tests', () => {
  beforeEach(() => {
    StudentSubmission.find.mockResolvedValue([]);
    StudentSubmission.findOne.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockInstructor = {
    _id: 'instructor-123',
    fullName: 'Dr. Mohamed El-Sayed',
    role: 'instructor',
  };

  const mockStudent = {
    _id: 'student-456',
    fullName: 'Sara Ahmed',
    role: 'student',
  };

  const mockAdmin = {
    _id: 'admin-999',
    fullName: 'EGSA Admin',
    role: 'admin',
  };

  const mockCourseId = 'course-101';
  const mockCohortId = 'cohort-202';
  const mockAssessmentId = 'assessment-303';
  const mockEnrollmentId = 'enrollment-404';

  describe('1. Assessment Creation & Validation', () => {
    test('Students cannot define assessments (403 Forbidden)', async () => {
      await expect(
        assessmentService.createAssessment(mockStudent, {
          title: 'Unauthorized Lab',
          courseId: mockCourseId,
          cohortId: mockCohortId,
        })
      ).rejects.toThrow('Only faculty instructors and administrators can define course assessments.');
    });

    test('Rejects invalid maxScore and passingScore parameters', async () => {
      await expect(
        assessmentService.createAssessment(mockInstructor, {
          title: 'Antenna Practical',
          courseId: mockCourseId,
          cohortId: mockCohortId,
          maxScore: 0,
        })
      ).rejects.toThrow('Maximum score must be greater than zero.');

      await expect(
        assessmentService.createAssessment(mockInstructor, {
          title: 'Antenna Practical',
          courseId: mockCourseId,
          cohortId: mockCohortId,
          maxScore: 100,
          passingScore: 110,
        })
      ).rejects.toThrow('Passing score must be between 0 and maximum score.');
    });

    test('Instructor successfully creates an assessment definition', async () => {
      Course.findById.mockResolvedValue({ _id: mockCourseId, title: 'Satellite Engineering' });
      Cohort.findById.mockResolvedValue({ _id: mockCohortId, name: 'Cohort 2026-01' });

      const mockCreated = {
        _id: mockAssessmentId,
        title: 'Phase-Locked Loop Telemetry Lab',
        type: 'Practical Assessment',
        course: mockCourseId,
        cohort: mockCohortId,
        maxScore: 100,
        passingScore: 75,
        weight: 30,
        status: 'Scheduled',
      };
      Assessment.create.mockResolvedValue(mockCreated);

      const result = await assessmentService.createAssessment(mockInstructor, {
        title: 'Phase-Locked Loop Telemetry Lab',
        courseId: mockCourseId,
        cohortId: mockCohortId,
        type: 'Practical Assessment',
        maxScore: 100,
        passingScore: 75,
        weight: 30,
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('Phase-Locked Loop Telemetry Lab');
      expect(result.type).toBe('Practical Assessment');
      expect(result.maxScore).toBe(100);
      expect(Assessment.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Student Evaluation Workflow: Draft vs Finalized vs Published', () => {
    test('Rejects evaluation if student is not an active enrolled member of the cohort', async () => {
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        maxScore: 50,
        cohort: mockCohortId,
      });
      Enrollment.findOne.mockResolvedValue(null); // not enrolled

      await expect(
        assessmentService.recordEvaluation(mockAssessmentId, mockStudent._id, mockInstructor, {
          score: 45,
        })
      ).rejects.toThrow('Student is not an active enrolled member of this assessment cohort.');
    });

    test('Rejects score exceeding maxScore', async () => {
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        maxScore: 50,
        cohort: mockCohortId,
      });

      await expect(
        assessmentService.recordEvaluation(mockAssessmentId, mockStudent._id, mockInstructor, {
          score: 55, // > 50
        })
      ).rejects.toThrow('Score must be between 0 and maximum score (50).');
    });

    test('Instructor saves evaluation as Draft; stores score and percentage correctly', async () => {
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        course: mockCourseId,
        cohort: mockCohortId,
        maxScore: 50,
        passingScore: 35,
      });
      Enrollment.findOne.mockResolvedValue({ _id: mockEnrollmentId });
      AssessmentResult.findOne.mockResolvedValue(null);

      const createdResult = {
        _id: 'result-1',
        assessment: mockAssessmentId,
        student: mockStudent._id,
        score: 42,
        maxScore: 50,
        percentage: 84,
        status: 'Draft',
        resultLabel: 'Passed',
        feedback: 'Good work.',
        instructorNote: 'CONFIDENTIAL NOTE',
      };
      AssessmentResult.create.mockResolvedValue(createdResult);

      const res = await assessmentService.recordEvaluation(
        mockAssessmentId,
        mockStudent._id,
        mockInstructor,
        {
          score: 42,
          feedback: 'Good work.',
          instructorNote: 'CONFIDENTIAL NOTE',
          saveAsDraft: true,
        }
      );

      expect(res.status).toBe('Draft');
      expect(res.score).toBe(42);
      expect(res.percentage).toBe(84);
      expect(res.resultLabel).toBe('Passed');
    });

    test('Student viewing assessments cannot see unfinalized/draft scores or instructor notes', async () => {
      Enrollment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([
            {
              cohort: { _id: mockCohortId, name: 'Cohort 2026-01' },
              course: { _id: mockCourseId, title: 'Satellite Engineering' },
            },
          ]),
        }),
      });

      Assessment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockResolvedValue([
                {
                  _id: mockAssessmentId,
                  title: 'Draft Assessment',
                  course: { _id: mockCourseId, title: 'Satellite Engineering' },
                  cohort: { name: 'Cohort 2026-01' },
                  maxScore: 100,
                  passingScore: 70,
                },
              ]),
            }),
          }),
        }),
      });

      // Evaluation is Draft
      AssessmentResult.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            assessment: mockAssessmentId,
            status: 'Draft',
            score: 85,
            percentage: 85,
            feedback: 'Draft feedback.',
            instructorNote: 'TOP SECRET NOTE',
          },
        ]),
      });

      const studentView = await assessmentService.getStudentAssessments(mockStudent._id);
      expect(studentView.assessments).toHaveLength(1);
      const item = studentView.assessments[0];

      expect(item.status).toBe('Pending Evaluation');
      expect(item.score).toBeNull();
      expect(item.percentage).toBeNull();
      expect(item.feedback).toBeNull();
      expect(item.instructorNote).toBeUndefined(); // NEVER returned
    });

    test('Publishing evaluation dispatches notification to student', async () => {
      const mockResultObj = {
        _id: 'res-99',
        score: 92,
        percentage: 92,
        resultLabel: 'Passed',
        course: mockCourseId,
        assessment: { title: 'Telemetry Capstone' },
        student: { _id: mockStudent._id, fullName: 'Sara Ahmed' },
        status: 'Finalized',
        auditTrail: [],
        save: jest.fn().mockResolvedValue(true),
      };

      AssessmentResult.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockResultObj),
        }),
      });

      Notification.create = jest.fn().mockResolvedValue({});

      const published = await assessmentService.publishEvaluation('res-99', mockInstructor);

      expect(published.status).toBe('Published');
      expect(mockResultObj.save).toHaveBeenCalled();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: mockStudent._id,
          title: 'Official Assessment Evaluation Available',
          type: 'success',
        })
      );
    });

    test('Enforces audit trail when modifying a finalized evaluation', async () => {
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        maxScore: 100,
        cohort: mockCohortId,
      });
      Enrollment.findOne.mockResolvedValue({ _id: mockEnrollmentId });

      const lockedResult = {
        _id: 'res-locked',
        score: 75,
        status: 'Finalized',
        auditTrail: [],
        save: jest.fn().mockResolvedValue(true),
      };
      AssessmentResult.findOne.mockResolvedValue(lockedResult);

      // Fails without reason
      await expect(
        assessmentService.recordEvaluation(mockAssessmentId, mockStudent._id, mockInstructor, {
          score: 85,
          reason: '',
        })
      ).rejects.toThrow('An official explanation/reason is required to modify it.');

      // Succeeds with reason and appends to auditTrail
      const updated = await assessmentService.recordEvaluation(mockAssessmentId, mockStudent._id, mockInstructor, {
        score: 85,
        reason: 'Recalibrated after reviewing laboratory appendix.',
      });

      expect(updated.score).toBe(85);
      expect(lockedResult.auditTrail).toHaveLength(1);
      expect(lockedResult.auditTrail[0].previousScore).toBe(75);
      expect(lockedResult.auditTrail[0].newScore).toBe(85);
      expect(lockedResult.auditTrail[0].reason).toContain('Recalibrated after reviewing laboratory appendix');
    });
  });

  describe('3. Roster & Anti-IDOR Protections', () => {
    test('Students cannot inspect cohort rosters (403 Forbidden)', async () => {
      await expect(
        assessmentService.getCohortStudentsForAssessment(mockAssessmentId, mockStudent)
      ).rejects.toThrow('Only faculty instructors and administrators can inspect student assessment rosters.');
    });

    test('Faculty instructor can view cohort student roster with evaluation statuses', async () => {
      Assessment.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: mockAssessmentId,
            cohort: { _id: mockCohortId, name: 'Cohort 2026-01' },
          }),
        }),
      });

      Enrollment.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            _id: mockEnrollmentId,
            student: {
              _id: mockStudent._id,
              fullName: 'Sara Ahmed',
              email: 'sara@egsa-academy.example',
            },
          },
        ]),
      });

      AssessmentResult.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      });

      const rosterData = await assessmentService.getCohortStudentsForAssessment(
        mockAssessmentId,
        mockInstructor
      );

      expect(rosterData.roster).toHaveLength(1);
      expect(rosterData.roster[0].student.fullName).toBe('Sara Ahmed');
      expect(rosterData.roster[0].status).toBe('Not_Evaluated');
      expect(rosterData.summary.notEvaluatedCount).toBe(1);
    });
  });

  describe('3. Student Assessment Submission & Policies Workflow', () => {
    test('Non-enrolled student cannot submit to cohort assessment (403 Forbidden)', async () => {
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        cohort: mockCohortId,
        submissionType: 'file',
      });
      Enrollment.findOne.mockResolvedValue(null);

      await expect(
        assessmentService.submitAssessment(mockAssessmentId, mockStudent, {}, { filename: 'test.pdf' })
      ).rejects.toThrow('You are not an active enrolled member of this assessment cohort.');
    });

    test('Rejects submission missing file when submissionType is "file"', async () => {
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        cohort: mockCohortId,
        submissionType: 'file',
      });
      Enrollment.findOne.mockResolvedValue({ _id: mockEnrollmentId });

      await expect(
        assessmentService.submitAssessment(mockAssessmentId, mockStudent, { textAnswer: 'only text' }, null)
      ).rejects.toThrow('Please select a file to upload for this assessment.');
    });

    test('Rejects submission when deadline passed and allowLateSubmission is false', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // yesterday
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        cohort: mockCohortId,
        dueDate: pastDate,
        allowLateSubmission: false,
        submissionType: 'file',
      });
      Enrollment.findOne.mockResolvedValue({ _id: mockEnrollmentId });

      await expect(
        assessmentService.submitAssessment(mockAssessmentId, mockStudent, {}, { filename: 'test.pdf' })
      ).rejects.toThrow('Submission deadline has passed. Late submissions are not accepted for this assessment.');
    });

    test('Allows submission and flags isLate when deadline passed and allowLateSubmission is true', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24);
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        title: 'Late Lab Allowed',
        cohort: mockCohortId,
        dueDate: pastDate,
        allowLateSubmission: true,
        submissionType: 'file',
      });
      Enrollment.findOne.mockResolvedValue({ _id: mockEnrollmentId });
      StudentSubmission.findOne.mockResolvedValue(null);

      const mockCreated = {
        _id: 'sub-1',
        assessment: mockAssessmentId,
        student: mockStudent._id,
        isLate: true,
        version: 1,
        status: 'Submitted',
      };
      StudentSubmission.create.mockResolvedValue(mockCreated);

      const res = await assessmentService.submitAssessment(
        mockAssessmentId,
        mockStudent,
        {},
        { filename: 'egsa_submission_123.pdf', originalname: 'lab.pdf', mimetype: 'application/pdf', size: 1024 }
      );

      expect(res.isLate).toBe(true);
      expect(StudentSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isLate: true,
          version: 1,
          status: 'Submitted',
        })
      );
    });

    test('Rejects resubmission when allowResubmission is false', async () => {
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        cohort: mockCohortId,
        allowResubmission: false,
        submissionType: 'file',
      });
      Enrollment.findOne.mockResolvedValue({ _id: mockEnrollmentId });
      StudentSubmission.findOne.mockResolvedValue({ _id: 'sub-existing', version: 1 });

      await expect(
        assessmentService.submitAssessment(
          mockAssessmentId,
          mockStudent,
          {},
          { filename: 'test.pdf', originalname: 'test.pdf', mimetype: 'application/pdf', size: 1024 }
        )
      ).rejects.toThrow('Resubmission is not permitted for this assessment.');
    });

    test('Allows resubmission, archives previous version, and increments version when allowResubmission is true', async () => {
      Assessment.findById.mockResolvedValue({
        _id: mockAssessmentId,
        title: 'Antenna Lab',
        cohort: mockCohortId,
        allowResubmission: true,
        submissionType: 'file',
      });
      Enrollment.findOne.mockResolvedValue({ _id: mockEnrollmentId });
      AssessmentResult.findOne.mockResolvedValue(null);

      const mockExisting = {
        _id: 'sub-existing',
        version: 1,
        file: { fileName: 'v1.pdf', originalName: 'v1.pdf' },
        textAnswer: 'v1 answer',
        submittedAt: new Date(Date.now() - 3600000),
        isLate: false,
        history: [],
        save: jest.fn().mockResolvedValue(true),
      };
      StudentSubmission.findOne.mockResolvedValue(mockExisting);

      const res = await assessmentService.submitAssessment(
        mockAssessmentId,
        mockStudent,
        { textAnswer: 'v2 answer' },
        { filename: 'v2.pdf', originalname: 'v2.pdf', mimetype: 'application/pdf', size: 2048 }
      );

      expect(mockExisting.version).toBe(2);
      expect(mockExisting.history).toHaveLength(1);
      expect(mockExisting.history[0].version).toBe(1);
      expect(mockExisting.save).toHaveBeenCalled();
    });

    test('Student cannot view assessment details if not enrolled in cohort (403 Forbidden)', async () => {
      Assessment.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({
              _id: mockAssessmentId,
              cohort: { _id: mockCohortId },
            }),
          }),
        }),
      });
      Enrollment.findOne.mockResolvedValue(null); // not enrolled

      await expect(
        assessmentService.getAssessmentById(mockAssessmentId, mockStudent)
      ).rejects.toThrow('You are not authorized to view this assessment. Cohort enrollment required.');
    });
  });
});
