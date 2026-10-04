jest.mock('../src/models/Certificate');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Evaluation');
jest.mock('../src/models/Assessment');
jest.mock('../src/models/AssessmentResult');
jest.mock('../src/models/User');
jest.mock('../src/models/Notification');
jest.mock('../src/services/attendanceService');
jest.mock('../src/utils/email');

const Certificate = require('../src/models/Certificate');
const Enrollment = require('../src/models/Enrollment');
const Evaluation = require('../src/models/Evaluation');
const Assessment = require('../src/models/Assessment');
const AssessmentResult = require('../src/models/AssessmentResult');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const attendanceService = require('../src/services/attendanceService');
const certificateService = require('../src/services/certificateService');
const { submitEvaluation } = require('../src/controllers/evaluationController');
const { submitName } = require('../src/controllers/certificateController');
const { sendCertificateReadyEmail } = require('../src/utils/email');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Certificate Request & Mandatory Course Feedback Flow', () => {
  const studentId = '507f191e810c19729de86001';
  const otherStudentId = '507f191e810c19729de86002';
  const courseId = '507f191e810c19729de86003';
  const cohortId = '507f191e810c19729de86004';
  const enrollmentId = '507f191e810c19729de86005';
  const adminId = '507f191e810c19729de86006';

  const mockCourse = {
    _id: courseId,
    title: 'Orbital Mechanics & Satellite Dynamics',
    code: 'SAT-301',
    level: 'Advanced',
    certificateType: 'Certificate of Completion',
  };

  const mockCohort = {
    _id: cohortId,
    name: 'Cohort Beta 2026',
  };

  const mockEnrollment = {
    _id: enrollmentId,
    student: studentId,
    course: mockCourse,
    cohort: mockCohort,
    status: 'Confirmed',
  };

  const adminUser = {
    _id: adminId,
    role: 'admin',
    fullName: 'Academy Dean of Certification',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Certificate.generateCertificateId = jest.fn(() => 'EGSA-CERT-112233');
    Certificate.generateVerificationToken = jest.fn(() => 'verif-tok-789xyz');
    Notification.create = jest.fn().mockResolvedValue({});
    sendCertificateReadyEmail.mockResolvedValue({ success: true });
  });

  describe('1. Certificate Request Submission & Flow Ordering (Section 1 & 7)', () => {
    test('Student can submit Certificate Request first before feedback is completed', async () => {
      // Setup: Enrollment exists and academic requirements are satisfied
      Enrollment.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockEnrollment),
        }),
      });

      attendanceService.getAttendanceSummary.mockResolvedValue({
        warningState: 'NORMAL',
        certificateEligibility: 'ON_TRACK',
        completedSessions: 10,
        attendanceRate: 92,
        policy: { minimumAttendancePercentage: 85 },
      });
      Assessment.find.mockResolvedValue([]);
      Certificate.findOne.mockResolvedValue(null);

      // Evaluation is NOT yet submitted
      Evaluation.exists.mockResolvedValue(null);

      const createdCert = {
        _id: 'cert-flow-1',
        certificateId: 'EGSA-CERT-112233',
        student: studentId,
        course: mockCourse,
        enrollment: enrollmentId,
        recipientName: 'Omar Khaled Mahmoud',
        status: 'NAME_SUBMITTED',
        feedbackCompleted: false,
        nameConfirmedBy: 'student',
      };

      Certificate.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(createdCert),
        }),
      });

      const certResult = await certificateService.submitCertificateName(
        studentId,
        enrollmentId,
        'Omar Khaled Mahmoud'
      );

      expect(certResult.status).toBe('NAME_SUBMITTED');
      expect(certResult.recipientName).toBe('Omar Khaled Mahmoud');
      expect(certResult.feedbackCompleted).toBe(false);
      expect(Notification.create).toHaveBeenCalled();
    });

    test('submitName controller returns clear success message and feedbackRequired flag', async () => {
      Enrollment.findOne.mockImplementation(() => {
        const query = Promise.resolve(mockEnrollment);
        query.populate = jest.fn().mockImplementation(() => {
          const innerQuery = Promise.resolve(mockEnrollment);
          innerQuery.populate = jest.fn().mockResolvedValue(mockEnrollment);
          return innerQuery;
        });
        return query;
      });

      Certificate.findById.mockResolvedValue(null);
      Certificate.findOne.mockResolvedValue(null);

      attendanceService.getAttendanceSummary.mockResolvedValue({
        warningState: 'NORMAL',
        certificateEligibility: 'ON_TRACK',
        completedSessions: 10,
        attendanceRate: 92,
        policy: { minimumAttendancePercentage: 85 },
      });
      Assessment.find.mockResolvedValue([]);
      Evaluation.exists.mockResolvedValue(null);

      const createdCert = {
        _id: 'cert-flow-1',
        student: studentId,
        course: mockCourse,
        enrollment: enrollmentId,
        recipientName: 'Omar Khaled Mahmoud',
        status: 'NAME_SUBMITTED',
        feedbackCompleted: false,
      };

      Certificate.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(createdCert),
        }),
      });

      const req = {
        user: { _id: studentId },
        body: {
          enrollmentId,
          certificateName: 'Omar Khaled Mahmoud',
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await submitName(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      const jsonResponse = res.json.mock.calls[0][0];
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.feedbackRequired).toBe(true);
      expect(jsonResponse.message).toContain('Your certificate request has been submitted successfully.');
      expect(jsonResponse.message).toContain('Please complete the required course feedback to continue the certificate process.');
    });
  });

  describe('2. Mandatory Feedback Gate on Admin Actions (Section 7 & 10)', () => {
    test('Admin cannot issue certificate directly if feedback is not completed', async () => {
      // Evaluation.exists returns null (no feedback)
      Evaluation.exists.mockResolvedValue(null);

      const certWithoutFeedback = {
        _id: 'cert-flow-1',
        student: { _id: studentId, fullName: 'Omar Khaled', email: 'omar@example.com' },
        course: mockCourse,
        recipientName: 'Omar Khaled Mahmoud',
        fileUrl: '/uploads/certificates/cert-1.pdf',
        status: 'UNDER_PREPARATION',
        feedbackCompleted: false,
      };

      Certificate.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(certWithoutFeedback),
        }),
      });

      await expect(
        certificateService.adminIssueCertificate('cert-flow-1', adminUser)
      ).rejects.toThrow(/Mandatory course feedback has not been submitted by the student yet/i);
    });

    test('Admin cannot upload and issue simultaneously if feedback is not completed', async () => {
      Evaluation.exists.mockResolvedValue(null);

      const certDoc = {
        _id: 'cert-flow-1',
        student: { _id: studentId, fullName: 'Omar Khaled', email: 'omar@example.com' },
        course: mockCourse,
        recipientName: 'Omar Khaled Mahmoud',
        status: 'NAME_SUBMITTED',
        feedbackCompleted: false,
        save: jest.fn(),
      };

      Certificate.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(certDoc),
        }),
      });

      const mockFile = {
        filename: 'cert_file_1.pdf',
        originalname: 'Official_Certificate.pdf',
        mimetype: 'application/pdf',
        size: 204800,
      };

      await expect(
        certificateService.adminUploadCertificateFile(
          'cert-flow-1',
          adminUser,
          mockFile,
          true // issueNow = true
        )
      ).rejects.toThrow(/Mandatory course feedback has not been submitted/i);
    });

    test('Admin CAN upload certificate and save as UNDER_PREPARATION while awaiting feedback', async () => {
      Evaluation.exists.mockResolvedValue(null);

      const certDoc = {
        _id: 'cert-flow-1',
        student: { _id: studentId, fullName: 'Omar Khaled', email: 'omar@example.com' },
        course: mockCourse,
        recipientName: 'Omar Khaled Mahmoud',
        status: 'NAME_SUBMITTED',
        feedbackCompleted: false,
        save: jest.fn().mockResolvedValue(true),
      };

      Certificate.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(certDoc),
        }),
      });

      const mockFile = {
        filename: 'cert_file_1.pdf',
        originalname: 'Official_Certificate.pdf',
        mimetype: 'application/pdf',
        size: 204800,
      };

      const result = await certificateService.adminUploadCertificateFile(
        'cert-flow-1',
        adminUser,
        mockFile,
        false // issueNow = false
      );

      expect(result.status).toBe('UNDER_PREPARATION');
      expect(result.fileUrl).toBe('/uploads/certificates/cert_file_1.pdf');
      expect(certDoc.save).toHaveBeenCalled();
    });
  });

  describe('3. Mandatory Course Feedback Submission (Section 5 & 6)', () => {
    test('Student submits evaluation, saves to MongoDB, and automatically syncs Certificate.feedbackCompleted = true', async () => {
      Enrollment.findOne.mockResolvedValue(mockEnrollment);

      const savedEval = {
        _id: 'eval-doc-1',
        student: studentId,
        course: courseId,
        cohort: cohortId,
        enrollment: enrollmentId,
        ratings: { content: 5, instructor: 5, labs: 4, organization: 5 },
        submittedAt: new Date(),
      };

      Evaluation.findOneAndUpdate.mockResolvedValue(savedEval);
      Certificate.findOneAndUpdate.mockResolvedValue({ _id: 'cert-flow-1', feedbackCompleted: true });

      const req = {
        user: { _id: studentId },
        body: {
          courseId,
          ratings: { content: 5, instructor: 5, labs: 4, organization: 5 },
          comments: {
            highlights: 'Excellent deep dive into orbital mechanics',
            improvements: 'More simulation hours',
          },
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await submitEvaluation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const jsonResponse = res.json.mock.calls[0][0];
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toContain('Course feedback submitted successfully.');
      expect(jsonResponse.message).toContain("Your certificate request can now continue through the Academy's review process.");

      // Verify certificate courseFeedbackCompleted synchronization in MongoDB
      expect(Certificate.findOneAndUpdate).toHaveBeenCalledWith(
        { student: studentId, course: courseId },
        expect.objectContaining({
          $set: expect.objectContaining({ courseFeedbackCompleted: true }),
        }),
        expect.anything()
      );
      expect(Notification.create).toHaveBeenCalled();
    });
  });

  describe('4. Admin Issuance after Feedback Completed', () => {
    test('Admin successfully issues certificate once feedback is completed', async () => {
      // Evaluation exists!
      Evaluation.exists.mockResolvedValue({ _id: 'eval-doc-1' });

      const certReady = {
        _id: 'cert-flow-1',
        student: { _id: studentId, fullName: 'Omar Khaled', email: 'omar@example.com' },
        course: mockCourse,
        recipientName: 'Omar Khaled Mahmoud',
        fileUrl: '/uploads/certificates/cert_file_1.pdf',
        status: 'UNDER_PREPARATION',
        feedbackCompleted: true,
        save: jest.fn().mockResolvedValue(true),
      };

      Certificate.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(certReady),
        }),
      });

      const issuedCert = await certificateService.adminIssueCertificate('cert-flow-1', adminUser);

      expect(issuedCert.status).toBe('ISSUED');
      expect(issuedCert.issuedBy).toBe(adminId);
      expect(certReady.save).toHaveBeenCalled();
      expect(Notification.create).toHaveBeenCalled();
      expect(sendCertificateReadyEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'omar@example.com',
          recipientName: 'Omar Khaled Mahmoud',
        })
      );
    });
  });

  describe('5. Security & Ownership Validation (Section 16)', () => {
    test('Student cannot submit certificate request for another student enrollment', async () => {
      Enrollment.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        certificateService.submitCertificateName(studentId, 'other-enrollment-id', 'Attacker Name')
      ).rejects.toThrow(/not found or does not belong/i);
    });

    test('Student cannot submit evaluation for a course they are not enrolled in', async () => {
      Enrollment.findOne.mockResolvedValue(null);

      const req = {
        user: { _id: studentId },
        body: {
          courseId: 'unauthorized-course-id',
          ratings: { content: 5, instructor: 5, labs: 5, organization: 5 },
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await submitEvaluation(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('You must have an active or completed enrollment in this course');
    });
  });

  describe('6. Database-Level Unique Indexes & Race Condition Prevention (Section 15 & 17)', () => {
    test('Certificate schema has unique compound index on { student: 1, course: 1 }', () => {
      const realCertificateModel = jest.requireActual('../src/models/Certificate');
      const indexes = realCertificateModel.schema.indexes();

      const studentCourseIndex = indexes.find(
        (idx) => idx[0] && idx[0].student === 1 && idx[0].course === 1
      );

      expect(studentCourseIndex).toBeDefined();
      expect(studentCourseIndex[1].unique).toBe(true);
    });

    test('Evaluation schema has unique compound index on { student: 1, course: 1 }', () => {
      const realEvaluationModel = jest.requireActual('../src/models/Evaluation');
      const indexes = realEvaluationModel.schema.indexes();

      const studentCourseIndex = indexes.find(
        (idx) => idx[0] && idx[0].student === 1 && idx[0].course === 1
      );

      expect(studentCourseIndex).toBeDefined();
      expect(studentCourseIndex[1].unique).toBe(true);
    });
  });
});
