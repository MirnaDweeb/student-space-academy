const QRCode = require('qrcode');
const attendanceService = require('../services/attendanceService');
const Enrollment = require('../models/Enrollment');
const TrainingSession = require('../models/TrainingSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceDispute = require('../models/AttendanceDispute');
const { AppError } = require('../middleware/error');

async function getSummary(req, res, next) {
  try {
    const { enrollmentId } = req.query;

    let enrollmentsQuery = {
      student: req.user._id,
      status: { $in: ['Active', 'Confirmed', 'Completed'] },
    };

    if (enrollmentId) {
      enrollmentsQuery._id = enrollmentId;
    }

    const enrollments = await Enrollment.find(enrollmentsQuery).sort({ createdAt: -1 });

    if (!enrollments || enrollments.length === 0) {
      const defaultPolicy = attendanceService.getAttendancePolicy();
      return res.json({
        success: true,
        data: {
          overallPercentage: 100,
          totalSessions: 0,
          completedSessions: 0,
          upcomingSessions: 0,
          remainingSessions: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          excusedCount: 0,
          presentSessions: 0,
          lateSessions: 0,
          absentSessions: 0,
          excusedSessions: 0,
          attendanceRate: 100,
          absenceRate: 0,
          warningState: 'NORMAL',
          warningMessage: 'No active enrollments found.',
          certificateEligibility: 'ON_TRACK',
          isEligibleForCertification: true,
          sessions: [],
          courses: [],
          policy: defaultPolicy,
        },
      });
    }

    const courseSummaries = [];
    for (const enr of enrollments) {
      const sum = await attendanceService.getAttendanceSummary(req.user._id, enr._id);
      courseSummaries.push(sum);
    }

    const primary = courseSummaries[0];
    const totalAllSessions = courseSummaries.reduce((a, c) => a + c.totalSessions, 0);
    const completedAll = courseSummaries.reduce((a, c) => a + c.completedSessions, 0);
    const presentAll = courseSummaries.reduce((a, c) => a + c.presentCount, 0);
    const lateAll = courseSummaries.reduce((a, c) => a + c.lateCount, 0);
    const absentAll = courseSummaries.reduce((a, c) => a + c.absentCount, 0);
    const excusedAll = courseSummaries.reduce((a, c) => a + c.excusedCount, 0);
    const upcomingAll = courseSummaries.reduce((a, c) => a + c.upcomingSessions, 0);

    const overallPercentage = primary.attendanceRate;

    res.json({
      success: true,
      data: {
        overallPercentage,
        totalSessions: totalAllSessions,
        completedSessions: completedAll,
        upcomingSessions: upcomingAll,
        presentSessions: presentAll,
        lateSessions: lateAll,
        absentSessions: absentAll,
        excusedSessions: excusedAll,
        warningState: primary.warningState,
        warningMessage: primary.warningMessage,
        certificateEligibility: primary.certificateEligibility,
        isEligibleForCertification: primary.certificateEligibility !== 'INELIGIBLE',
        policy: primary.policy,
        recovery: primary.recovery,
        courses: courseSummaries.map((c) => ({
          ...c,
          percentage: c.attendanceRate,
          presentSessions: c.presentCount,
          lateSessions: c.lateCount,
          absentSessions: c.absentCount,
          excusedSessions: c.excusedCount,
          isThresholdMet: c.attendanceRate >= (c.policy?.minimumAttendancePercentage || 85),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getSessions(req, res, next) {
  try {
    const { cohortId } = req.query;
    if (!cohortId) throw new AppError('cohortId query parameter required.', 400);

    const sessions = await TrainingSession.find({ cohort: cohortId }).sort({ sessionNumber: 1 });
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

async function checkInWithQR(req, res, next) {
  try {
    const { token, checkInMethod } = req.body;
    const result = await attendanceService.recordQRCheckIn(
      req.user._id,
      token,
      checkInMethod || 'QR_Scan'
    );
    res.status(201).json({
      success: true,
      message: `Attendance marked successfully for ${result.sessionTitle} (${result.record.status}).`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function submitDispute(req, res, next) {
  try {
    const { sessionId, enrollmentId, reason, type, documentation } = req.body;
    const dispute = await attendanceService.submitDispute({
      studentId: req.user._id,
      sessionId,
      enrollmentId,
      reason,
      type,
      documentation,
    });
    res.status(201).json({ success: true, data: dispute });
  } catch (err) {
    next(err);
  }
}

async function getMyDisputes(req, res, next) {
  try {
    const disputes = await AttendanceDispute.find({ student: req.user._id })
      .populate('session', 'title sessionNumber date')
      .populate('enrollment')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: disputes });
  } catch (err) {
    next(err);
  }
}

function getPolicy(req, res, next) {
  try {
    const policy = attendanceService.getAttendancePolicy();
    res.json({ success: true, data: policy });
  } catch (err) {
    next(err);
  }
}

// ---------------- Admin & Instructor Endpoints ----------------

async function generateQR(req, res, next) {
  try {
    const validMinutes = req.body.validMinutes ? Number(req.body.validMinutes) : 60;
    const { session, token, expiresAt } = await attendanceService.generateSessionQR(
      req.params.id,
      validMinutes
    );

    // Generate base64 data URL representation for projector / display
    const qrDataUrl = await QRCode.toDataURL(token, {
      margin: 2,
      width: 320,
      color: {
        dark: '#0f3d64',
        light: '#ffffff',
      },
    });

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        sessionTitle: session.title,
        token,
        qrDataUrl,
        expiresAt,
        attendanceWindow: session.attendanceWindow,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getSessionRoster(req, res, next) {
  try {
    const session = await TrainingSession.findById(req.params.id).populate('cohort');
    if (!session) throw new AppError('Session not found.', 404);

    const enrollments = await Enrollment.find({ cohort: session.cohort._id })
      .populate('student', 'fullName email phone nationalId');

    const records = await AttendanceRecord.find({ session: session._id });
    const recordMap = new Map();
    records.forEach((r) => recordMap.set(String(r.student), r));

    const roster = enrollments.map((enr) => {
      const rec = recordMap.get(String(enr.student?._id));
      return {
        enrollmentId: enr._id,
        student: enr.student,
        status: rec ? rec.status : 'Absent',
        checkInTime: rec ? rec.checkInTime : null,
        checkInMethod: rec ? rec.checkInMethod : null,
        recordId: rec ? rec._id : null,
      };
    });

    res.json({ success: true, data: { session, roster } });
  } catch (err) {
    next(err);
  }
}

async function correctRecord(req, res, next) {
  try {
    const { status, reason } = req.body;
    const result = await attendanceService.correctAttendance(
      req.params.id,
      status,
      req.user._id,
      reason
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listDisputes(req, res, next) {
  try {
    const disputes = await AttendanceDispute.find()
      .populate('student', 'fullName email')
      .populate('session', 'title sessionNumber date')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: disputes });
  } catch (err) {
    next(err);
  }
}

async function reviewDispute(req, res, next) {
  try {
    const { approved, reviewNotes } = req.body;
    const dispute = await attendanceService.reviewDispute({
      disputeId: req.params.id,
      approved: Boolean(approved),
      adminUserId: req.user._id,
      reviewNotes,
    });
    res.json({ success: true, data: dispute });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummary,
  getSessions,
  checkInWithQR,
  submitDispute,
  getMyDisputes,
  getPolicy,
  generateQR,
  getSessionRoster,
  correctRecord,
  listDisputes,
  reviewDispute,
};
