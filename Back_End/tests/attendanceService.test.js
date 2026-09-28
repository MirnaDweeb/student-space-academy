const attendanceService = require('../src/services/attendanceService');
const TrainingSession = require('../src/models/TrainingSession');
const AttendanceRecord = require('../src/models/AttendanceRecord');
const Enrollment = require('../src/models/Enrollment');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Notification = require('../src/models/Notification');

jest.mock('../src/models/TrainingSession');
jest.mock('../src/models/AttendanceRecord');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Course');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Notification');

describe('Attendance Service & Business Logic Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Attendance Policy Configuration', () => {
    test('returns centralized configurable policy with EGSA defaults', () => {
      const policy = attendanceService.getAttendancePolicy();
      expect(policy).toBeDefined();
      expect(policy.minimumAttendancePercentage).toBe(85);
      expect(policy.attentionThreshold).toBe(10);
      expect(policy.warningThreshold).toBe(15);
      expect(policy.finalWarningThreshold).toBe(20);
      expect(policy.lateArrivalWeight).toBe(0.75);
      expect(policy.isConfigurable).toBe(true);
    });

    test('allows cohort-specific policy overrides', () => {
      const cohortOverride = {
        attendancePolicy: {
          minimumAttendancePercentage: 90,
          warningAbsenceThreshold: 10,
        },
      };
      const policy = attendanceService.getAttendancePolicy(cohortOverride);
      expect(policy.minimumAttendancePercentage).toBe(90);
      expect(policy.warningThreshold).toBe(10);
    });
  });

  describe('Attendance Summary & Graduated Warning Engine', () => {
    const mockStudentId = 'student-123';
    const mockEnrollmentId = 'enrollment-456';
    const mockCohortId = 'cohort-789';
    const mockCourseId = 'course-101';

    const baseEnrollment = {
      _id: mockEnrollmentId,
      student: mockStudentId,
      cohort: { _id: mockCohortId, name: 'Cohort 2026-01' },
      course: { _id: mockCourseId, title: 'Satellite Engineering', level: 'Advanced' },
      status: 'Active',
    };

    beforeEach(() => {
      Enrollment.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(baseEnrollment),
        }),
      });
      Enrollment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([baseEnrollment]),
        }),
      });
      Notification.create = jest.fn().mockResolvedValue({});
      Notification.findOne = jest.fn().mockResolvedValue(null);
    });

    test('Scenario A - Normal Attendance (100%): Warning state is NORMAL, Eligibility is ON_TRACK', async () => {
      const sessions = [
        { _id: 's1', sessionNumber: 1, title: 'S1', date: new Date(Date.now() - 2 * 86400000), status: 'Completed' },
        { _id: 's2', sessionNumber: 2, title: 'S2', date: new Date(Date.now() - 1 * 86400000), status: 'Completed' },
        { _id: 's3', sessionNumber: 3, title: 'S3', date: new Date(Date.now() + 5 * 86400000), status: 'Scheduled' },
      ];
      TrainingSession.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(sessions),
      });

      const records = [
        { session: 's1', status: 'Present', checkInTime: new Date() },
        { session: 's2', status: 'Present', checkInTime: new Date() },
      ];
      AttendanceRecord.find.mockResolvedValue(records);

      const summary = await attendanceService.getAttendanceSummary(mockStudentId, mockEnrollmentId);

      expect(summary.attendanceRate).toBe(100);
      expect(summary.presentCount).toBe(2);
      expect(summary.absentCount).toBe(0);
      expect(summary.completedSessions).toBe(2);
      expect(summary.upcomingSessions).toBe(1);
      expect(summary.warningState).toBe('NORMAL');
      expect(summary.certificateEligibility).toBe('ON_TRACK');
      expect(summary.warningMessage).toContain('on track');
    });

    test('Scenario B - Attention State: Absence approaches threshold (10% - 14%)', async () => {
      // 10 sessions total: 10 completed, 9 present, 1 absent (10% absence rate)
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        _id: `s${i + 1}`,
        sessionNumber: i + 1,
        title: `S${i + 1}`,
        date: new Date(Date.now() - (10 - i) * 86400000),
        status: 'Completed',
      }));
      TrainingSession.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(sessions),
      });

      const records = sessions.map((s, idx) => ({
        session: s._id,
        status: idx === 0 ? 'Absent' : 'Present',
      }));
      AttendanceRecord.find.mockResolvedValue(records);

      const summary = await attendanceService.getAttendanceSummary(mockStudentId, mockEnrollmentId);

      expect(summary.attendanceRate).toBe(90);
      expect(summary.absenceRate).toBe(10);
      expect(summary.warningState).toBe('ATTENTION');
      expect(summary.warningMessage).toContain('approaching the permitted absence limit');
    });

    test('Scenario C - Warning State: Ongoing training, absence exceeds warning threshold (15%) but recovery possible', async () => {
      // 10 sessions total: 6 completed in past, 4 scheduled in future
      // 5 present, 1 absent out of 6 completed = 17% absence rate (>= 15% warning threshold)
      // Max possible final = (5 + 4) / 10 = 90% >= 85% -> can recover!
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        _id: `s${i + 1}`,
        sessionNumber: i + 1,
        title: `S${i + 1}`,
        date: i < 6 ? new Date(Date.now() - (6 - i) * 86400000) : new Date(Date.now() + (i + 1) * 86400000),
        status: i < 6 ? 'Completed' : 'Scheduled',
      }));
      TrainingSession.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(sessions),
      });

      const records = [
        { session: 's1', status: 'Absent' },
        { session: 's2', status: 'Present' },
        { session: 's3', status: 'Present' },
        { session: 's4', status: 'Present' },
        { session: 's5', status: 'Present' },
        { session: 's6', status: 'Present' },
      ];
      AttendanceRecord.find.mockResolvedValue(records);

      const summary = await attendanceService.getAttendanceSummary(mockStudentId, mockEnrollmentId);

      expect(summary.attendanceRate).toBe(83);
      expect(summary.absenceRate).toBe(17);
      expect(summary.warningState).toBe('WARNING');
      expect(summary.warningMessage).toContain('exceeded the warning threshold');
      expect(summary.certificateEligibility).toBe('AT_RISK');
      expect(summary.recovery.canRecover).toBe(true);
      expect(summary.recovery.maxPossibleFinalRate).toBe(90);
    });

    test('Scenario D & E - Mathematical Ineligibility: Cannot recover required threshold', async () => {
      // 5 sessions total. 3 completed in past, all 3 absent. 2 sessions remaining.
      // Max possible final rate = (0 + 2) / 5 = 40% < 85% -> Mathematically impossible to recover!
      const sessions = Array.from({ length: 5 }, (_, i) => ({
        _id: `s${i + 1}`,
        sessionNumber: i + 1,
        title: `S${i + 1}`,
        date: i < 3 ? new Date(Date.now() - (3 - i) * 86400000) : new Date(Date.now() + (i + 1) * 86400000),
        status: i < 3 ? 'Completed' : 'Scheduled',
      }));
      TrainingSession.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(sessions),
      });

      const records = [
        { session: 's1', status: 'Absent' },
        { session: 's2', status: 'Absent' },
        { session: 's3', status: 'Absent' },
      ];
      AttendanceRecord.find.mockResolvedValue(records);

      const summary = await attendanceService.getAttendanceSummary(mockStudentId, mockEnrollmentId);

      expect(summary.recovery.canRecover).toBe(false);
      expect(summary.recovery.maxPossibleFinalRate).toBe(40);
      expect(summary.warningState).toBe('CERTIFICATE_INELIGIBLE');
      expect(summary.certificateEligibility).toBe('INELIGIBLE');
      expect(summary.warningMessage).toMatch(/permitted attendance limit/i);
    });

    test('Recovery Logic: AT_RISK when current attendance is low but future sessions allow recovery', async () => {
      // 10 sessions total: 3 completed in past: 2 present, 1 absent. Current rate: 67% < 85%.
      // 7 sessions remaining in future. Max possible final rate = (2 + 7) / 10 = 90% >= 85%!
      // The student CAN recover! Status should be AT_RISK rather than permanently failing.
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        _id: `s${i + 1}`,
        sessionNumber: i + 1,
        title: `S${i + 1}`,
        date: i < 3 ? new Date(Date.now() - (3 - i) * 86400000) : new Date(Date.now() + (i + 1) * 86400000),
        status: i < 3 ? 'Completed' : 'Scheduled',
      }));
      TrainingSession.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(sessions),
      });

      const records = [
        { session: 's1', status: 'Present' },
        { session: 's2', status: 'Present' },
        { session: 's3', status: 'Absent' },
      ];
      AttendanceRecord.find.mockResolvedValue(records);

      const summary = await attendanceService.getAttendanceSummary(mockStudentId, mockEnrollmentId);

      expect(summary.recovery.canRecover).toBe(true);
      expect(summary.recovery.maxPossibleFinalRate).toBe(90);
      expect(summary.certificateEligibility).toBe('AT_RISK');
    });
  });

  describe('Scenario G - QR Validation & Security Rules', () => {
    const mockStudentId = 'student-999';
    const mockToken = 'SECURE-LIVE-TOKEN-ABC';

    test('Rejects check-in if QR token does not exist', async () => {
      TrainingSession.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        attendanceService.recordQRCheckIn(mockStudentId, 'INVALID-TOKEN')
      ).rejects.toThrow(/invalid/i);
    });

    test('Rejects check-in if QR code token has expired', async () => {
      const expiredSession = {
        _id: 'session-exp',
        qrCode: {
          token: mockToken,
          expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
          isActive: true,
        },
        attendanceWindow: {
          opensAt: new Date(Date.now() - 7200000),
          closesAt: new Date(Date.now() - 3600000),
        },
      };
      TrainingSession.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(expiredSession),
        }),
      });

      await expect(
        attendanceService.recordQRCheckIn(mockStudentId, mockToken)
      ).rejects.toThrow(/expired/i);
    });

    test('Rejects check-in if student is not enrolled in cohort', async () => {
      const validSession = {
        _id: 'session-live',
        cohort: { _id: 'cohort-123' },
        course: { _id: 'course-123' },
        qrCode: {
          token: mockToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
        },
        attendanceWindow: {
          opensAt: new Date(Date.now() - 600000),
          closesAt: new Date(Date.now() + 3600000),
        },
      };
      TrainingSession.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(validSession),
        }),
      });
      Enrollment.findOne.mockResolvedValue(null); // NOT enrolled

      await expect(
        attendanceService.recordQRCheckIn(mockStudentId, mockToken)
      ).rejects.toThrow(/not enrolled/i);
    });

    test('Prevents duplicate check-in if attendance already recorded', async () => {
      const validSession = {
        _id: 'session-live',
        cohort: { _id: 'cohort-123' },
        course: { _id: 'course-123' },
        qrCode: {
          token: mockToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
        },
        attendanceWindow: {
          opensAt: new Date(Date.now() - 600000),
          closesAt: new Date(Date.now() + 3600000),
        },
      };
      TrainingSession.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(validSession),
        }),
      });
      Enrollment.findOne.mockResolvedValue({ _id: 'enrollment-123', status: 'Active' });
      AttendanceRecord.findOne.mockResolvedValue({ _id: 'existing-record', status: 'Present', checkInTime: new Date() });

      await expect(
        attendanceService.recordQRCheckIn(mockStudentId, mockToken)
      ).rejects.toThrow(/already recorded/i);
    });
  });

  describe('Scenario F - Attendance Correction & Audit History', () => {
    test('Logs correction audit trail with changedBy, previousStatus, newStatus, and reason', async () => {
      const mockRecord = {
        _id: 'rec-1',
        session: 's-1',
        student: 'stud-1',
        enrollment: 'enr-1',
        status: 'Absent',
        notes: '',
        correctionHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      AttendanceRecord.findById.mockResolvedValue(mockRecord);
      Enrollment.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: 'enr-1',
            student: 'stud-1',
            cohort: { _id: 'c-1' },
            course: { _id: 'co-1' },
          }),
        }),
      });
      TrainingSession.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });
      AttendanceRecord.find.mockResolvedValue([]);

      await attendanceService.correctAttendance(
        'rec-1',
        'Present',
        'admin-user-id',
        'Medical excuse verified by board proctor'
      );

      expect(mockRecord.status).toBe('Present');
      expect(mockRecord.correctionHistory.length).toBe(1);
      expect(mockRecord.correctionHistory[0].previousStatus).toBe('Absent');
      expect(mockRecord.correctionHistory[0].newStatus).toBe('Present');
      expect(mockRecord.correctionHistory[0].changedBy).toBe('admin-user-id');
      expect(mockRecord.correctionHistory[0].reason).toContain('Medical excuse verified');
      expect(mockRecord.save).toHaveBeenCalled();
    });
  });
});
