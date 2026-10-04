jest.mock('../src/models/Certificate');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Assessment');
jest.mock('../src/models/AssessmentResult');
jest.mock('../src/models/User');
jest.mock('../src/models/Notification');
jest.mock('../src/models/Evaluation');
jest.mock('../src/services/attendanceService');
jest.mock('../src/utils/email');

const certificateService = require('../src/services/certificateService');
const Certificate = require('../src/models/Certificate');
const Enrollment = require('../src/models/Enrollment');
const Assessment = require('../src/models/Assessment');
const AssessmentResult = require('../src/models/AssessmentResult');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const Evaluation = require('../src/models/Evaluation');
const attendanceService = require('../src/services/attendanceService');
const { sendCertificateReadyEmail } = require('../src/utils/email');

describe('Certificate Service — Name Validation & Sanitization', () => {
  test('rejects empty, null, or undefined name', () => {
    expect(() => certificateService.validateAndSanitizeCertificateName('')).toThrow(/required/i);
    expect(() => certificateService.validateAndSanitizeCertificateName(null)).toThrow(/required/i);
    expect(() => certificateService.validateAndSanitizeCertificateName('   ')).toThrow(/at least 3 characters/i);
  });

  test('rejects names with fewer than 3 characters', () => {
    expect(() => certificateService.validateAndSanitizeCertificateName('Al')).toThrow(/at least 3 characters/i);
  });

  test('rejects names exceeding 100 characters', () => {
    const longName = 'A'.repeat(101);
    expect(() => certificateService.validateAndSanitizeCertificateName(longName)).toThrow(/cannot exceed 100 characters/i);
  });

  test('trims and collapses accidental multiple spaces', () => {
    const sanitized = certificateService.validateAndSanitizeCertificateName('   Sara    Ahmed   Mohamed   Hassan   ');
    expect(sanitized).toBe('Sara Ahmed Mohamed Hassan');
  });

  test('accepts valid English names', () => {
    const name = certificateService.validateAndSanitizeCertificateName('Sara Ahmed Mohamed Hassan');
    expect(name).toBe('Sara Ahmed Mohamed Hassan');

    const hyphenated = certificateService.validateAndSanitizeCertificateName('Haidy Sobhy-Eldenshaly');
    expect(hyphenated).toBe('Haidy Sobhy-Eldenshaly');
  });

  test('accepts valid Arabic names with spaces and letters', () => {
    const arName = certificateService.validateAndSanitizeCertificateName('سارة أحمد محمد حسن');
    expect(arName).toBe('سارة أحمد محمد حسن');
  });

  test('rejects HTML tags, scripts, and markup injection', () => {
    expect(() => certificateService.validateAndSanitizeCertificateName('<script>alert("hacked")</script>')).toThrow(/invalid characters or markup/i);
    expect(() => certificateService.validateAndSanitizeCertificateName('Sara <b>Ahmed</b>')).toThrow(/invalid characters or markup/i);
    expect(() => certificateService.validateAndSanitizeCertificateName('Sara <script>')).toThrow(/invalid characters or markup/i);
  });

  test('rejects strings with only numbers or symbols', () => {
    expect(() => certificateService.validateAndSanitizeCertificateName('123456789')).toThrow(/unsupported characters/i);
    expect(() => certificateService.validateAndSanitizeCertificateName('---...')).toThrow(/valid alphabetic characters/i);
  });
});

describe('Certificate Service — Student Request & Admin Workflow', () => {
  const studentId = '507f191e810c19729de860ea';
  const otherStudentId = '507f191e810c19729de860eb';
  const enrollmentId = '507f191e810c19729de860ec';
  const courseId = '507f191e810c19729de860ed';
  const cohortId = '507f191e810c19729de860ee';

  const mockCourse = {
    _id: courseId,
    title: 'Satellite Systems Engineering',
    level: 'Advanced',
    certificateType: 'Certificate of Completion',
  };

  const mockCohort = {
    _id: cohortId,
    name: 'Cohort Alpha',
  };

  const mockEnrollment = {
    _id: enrollmentId,
    student: studentId,
    course: mockCourse,
    cohort: mockCohort,
    status: 'Confirmed',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Certificate.generateCertificateId = jest.fn(() => 'EGSA-CERT-789012');
    Certificate.generateVerificationToken = jest.fn(() => 'abc123tokenhex456');
    Notification.create = jest.fn().mockResolvedValue({});
    Evaluation.exists = jest.fn().mockResolvedValue({ _id: 'eval-1' });
    sendCertificateReadyEmail.mockResolvedValue({ success: true });
  });

  test('checkCertificateEligibility: throws 404 if enrollment not found or belongs to another student', async () => {
    Enrollment.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      certificateService.checkCertificateEligibility(otherStudentId, enrollmentId)
    ).rejects.toThrow(/not found or does not belong/i);
  });

  test('submitCertificateName: student submits name, status becomes NAME_SUBMITTED (not ISSUED)', async () => {
    Enrollment.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockEnrollment),
      }),
    });

    Certificate.findOne.mockResolvedValue(null);

    attendanceService.getAttendanceSummary.mockResolvedValue({
      warningState: 'NORMAL',
      certificateEligibility: 'ON_TRACK',
      completedSessions: 8,
      attendanceRate: 95,
      policy: { minimumAttendancePercentage: 85 },
    });
    Assessment.find.mockResolvedValue([]);

    const submittedCert = {
      _id: 'cert-123',
      certificateId: 'EGSA-CERT-789012',
      student: studentId,
      course: mockCourse,
      enrollment: enrollmentId,
      recipientName: 'Sara Ahmed Mohamed Hassan',
      status: 'NAME_SUBMITTED',
      nameConfirmedBy: 'student',
    };

    Certificate.findOneAndUpdate.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(submittedCert),
      }),
    });

    const result = await certificateService.submitCertificateName(
      studentId,
      enrollmentId,
      'Sara Ahmed Mohamed Hassan'
    );

    expect(result.status).toBe('NAME_SUBMITTED');
    expect(result.recipientName).toBe('Sara Ahmed Mohamed Hassan');
    expect(Notification.create).toHaveBeenCalled();
  });

  test('adminUploadCertificateFile: student is rejected with 403; admin can upload file and status becomes UNDER_PREPARATION', async () => {
    const studentUser = { _id: studentId, role: 'student', fullName: 'Student User' };
    const adminUser = { _id: 'admin-1', role: 'admin', fullName: 'Academy Admin' };

    const mockFile = {
      filename: 'egsa_cert_123.pdf',
      originalname: 'Official_Certificate.pdf',
      mimetype: 'application/pdf',
      size: 102400,
    };

    // Student attempt throws 403
    await expect(
      certificateService.adminUploadCertificateFile('cert-123', studentUser, mockFile)
    ).rejects.toThrow(/Only administrators are authorized/i);

    // Admin attempt succeeds
    const certDoc = {
      _id: 'cert-123',
      recipientName: 'Sara Ahmed Mohamed Hassan',
      status: 'NAME_SUBMITTED',
      student: { _id: studentId, fullName: 'Sara Ahmed', email: 'sara@example.com' },
      course: mockCourse,
      save: jest.fn().mockResolvedValue(true),
    };

    Certificate.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(certDoc),
      }),
    });

    const res = await certificateService.adminUploadCertificateFile(
      'cert-123',
      adminUser,
      mockFile,
      false,
      'Verified with student ID'
    );

    expect(res.status).toBe('UNDER_PREPARATION');
    expect(res.fileUrl).toBe('/uploads/certificates/egsa_cert_123.pdf');
    expect(res.fileName).toBe('Official_Certificate.pdf');
    expect(certDoc.save).toHaveBeenCalled();
  });

  test('adminIssueCertificate: fails if no certificate file is uploaded; succeeds with file, dispatches notif & email', async () => {
    const adminUser = { _id: 'admin-1', role: 'admin', fullName: 'Academy Admin' };

    // 1. Without file -> throws 400
    const certWithoutFile = {
      _id: 'cert-123',
      recipientName: 'Sara Ahmed Mohamed Hassan',
      fileUrl: null,
      student: { _id: studentId, fullName: 'Sara Ahmed', email: 'sara@example.com' },
      course: mockCourse,
    };

    Certificate.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(certWithoutFile),
      }),
    });

    await expect(
      certificateService.adminIssueCertificate('cert-123', adminUser)
    ).rejects.toThrow(/official certificate file.*must be uploaded/i);

    // 2. With file -> marks ISSUED
    const certWithFile = {
      _id: 'cert-123',
      recipientName: 'Sara Ahmed Mohamed Hassan',
      fileUrl: '/uploads/certificates/egsa_cert_123.pdf',
      status: 'UNDER_PREPARATION',
      feedbackCompleted: true,
      courseFeedbackCompleted: true,
      agencyFeedbackCompleted: true,
      student: { _id: studentId, fullName: 'Sara Ahmed', email: 'sara@example.com' },
      course: mockCourse,
      save: jest.fn().mockResolvedValue(true),
    };

    Certificate.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(certWithFile),
      }),
    });

    const issued = await certificateService.adminIssueCertificate('cert-123', adminUser);
    expect(issued.status).toBe('ISSUED');
    expect(issued.issuedBy).toBe('admin-1');
    expect(Notification.create).toHaveBeenCalled();
    expect(sendCertificateReadyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sara@example.com',
        recipientName: 'Sara Ahmed Mohamed Hassan',
      })
    );
  });

  test('confirmAndIssueCertificate: locked once ISSUED', async () => {
    Enrollment.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockEnrollment),
      }),
    });

    Certificate.findOne.mockResolvedValue({
      _id: 'existing-cert',
      status: 'ISSUED',
      recipientName: 'Sara Ahmed Mohamed Hassan',
    });

    await expect(
      certificateService.submitCertificateName(
        studentId,
        enrollmentId,
        'Sara New Name Attempt'
      )
    ).rejects.toThrow(/permanently locked and cannot be modified/i);
  });

  test('correctCertificateName: admin can correct name and records audit trail', async () => {
    const adminUser = { _id: 'admin-1', role: 'admin', fullName: 'EGSA Registrar Admin' };
    const certDoc = {
      _id: 'cert-123',
      recipientName: 'Sara Ahmed Mohamed',
      correctionHistory: [],
      nameConfirmedBy: 'student',
      nameConfirmedAt: new Date('2026-01-01'),
      course: mockCourse,
      student: { _id: studentId, fullName: 'Sara Account Name' },
      save: jest.fn().mockResolvedValue(true),
    };

    Certificate.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(certDoc),
      }),
    });

    const result = await certificateService.correctCertificateName(
      'cert-123',
      adminUser,
      'Sara Ahmed Mohamed Hassan',
      'Official spelling correction per national ID verification'
    );

    expect(result.recipientName).toBe('Sara Ahmed Mohamed Hassan');
    expect(result.nameConfirmedBy).toBe('admin');
    expect(result.correctionHistory).toHaveLength(1);
    expect(result.correctionHistory[0].oldName).toBe('Sara Ahmed Mohamed');
    expect(result.correctionHistory[0].newName).toBe('Sara Ahmed Mohamed Hassan');
    expect(certDoc.save).toHaveBeenCalled();
  });

  test('verifyCertificate: retrieves public verifiable details by certificate ID or token', async () => {
    const mockCert = {
      certificateId: 'EGSA-CERT-789012',
      recipientName: 'سارة أحمد محمد حسن',
      course: mockCourse,
      issueDate: new Date('2026-03-01'),
      status: 'ISSUED',
      fileUrl: '/uploads/certificates/egsa_cert_123.pdf',
      student: { registrationNumber: 'EGSA-123456' },
    };

    Certificate.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCert),
      }),
    });

    const verification = await certificateService.verifyCertificate('EGSA-CERT-789012');
    expect(verification.isValid).toBe(true);
    expect(verification.recipientName).toBe('سارة أحمد محمد حسن');
    expect(verification.fileUrl).toBe('/uploads/certificates/egsa_cert_123.pdf');
  });
});
