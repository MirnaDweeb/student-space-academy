const crypto = require('crypto');
const TrainingSession = require('../models/TrainingSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const AttendanceDispute = require('../models/AttendanceDispute');
const { notify } = require('./notificationService');
const { AppError } = require('../middleware/error');

/**
 * CENTRALIZED ATTENDANCE POLICY
 * Single source of truth across the Egyptian Space Agency platform.
 * Configurable thresholds - clearly separated from hardcoded front-end logic.
 */
const DEFAULT_ATTENDANCE_POLICY = {
  minimumAttendancePercentage: 85, // Official configured target
  attentionAbsenceThreshold: 10, // Early attention state
  warningAbsenceThreshold: 15, // Official warning state
  finalWarningAbsenceThreshold: 20, // Critical final warning
  lateWeight: 0.75, // Credit given for Late check-ins (1.0 = present, 0.75 = late)
  qrWindowMinutesBefore: 15, // QR check-in window opens 15m prior to start
  qrWindowMinutesAfter: 60, // QR check-in window stays open 60m after start
  qrGracePeriodMinutes: 15, // Arriving within 15m of start time is Present; after is Late
};

function getAttendancePolicy(cohort = null) {
  const policy = { ...DEFAULT_ATTENDANCE_POLICY, isConfigurable: true };
  if (cohort?.attendancePolicy) {
    Object.assign(policy, cohort.attendancePolicy);
  }
  // Standardized aliases for testing and frontend consumers
  policy.attentionThreshold = policy.attentionAbsenceThreshold;
  policy.warningThreshold = policy.warningAbsenceThreshold;
  policy.finalWarningThreshold = policy.finalWarningAbsenceThreshold;
  policy.lateArrivalWeight = policy.lateWeight;
  return policy;
}

/**
 * Calculates complete attendance summary, absence rates, warning state,
 * and mathematical recovery eligibility for an enrollment.
 */
async function getAttendanceSummary(studentId, enrollmentId) {
  const enrollment = await Enrollment.findOne({ _id: enrollmentId, student: studentId })
    .populate('course')
    .populate('cohort');

  if (!enrollment) {
    throw new AppError('Enrollment record not found.', 404);
  }

  const policy = getAttendancePolicy(enrollment.cohort);
  const cohortId = enrollment.cohort?._id;

  // Retrieve all scheduled sessions for this cohort
  const sessions = await TrainingSession.find({ cohort: cohortId })
    .sort({ sessionNumber: 1, date: 1 });

  // Retrieve all student attendance records for this cohort
  const records = await AttendanceRecord.find({ student: studentId, cohort: cohortId });
  const recordsMap = new Map();
  records.forEach((r) => recordsMap.set(String(r.session), r));

  const now = new Date();
  const totalSessions = sessions.length;

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let completedSessions = 0;
  let upcomingSessions = 0;

  const sessionDetails = sessions.map((sess) => {
    const record = recordsMap.get(String(sess._id));
    const sessDate = new Date(sess.date);
    const isPast = sessDate <= now || sess.status === 'Completed';

    let displayStatus = 'Upcoming';
    let checkInTime = null;
    let checkInMethod = null;

    if (record) {
      displayStatus = record.status;
      checkInTime = record.checkInTime;
      checkInMethod = record.checkInMethod;

      if (record.status === 'Present') presentCount += 1;
      else if (record.status === 'Late') lateCount += 1;
      else if (record.status === 'Excused') excusedCount += 1;
      else if (record.status === 'Absent') absentCount += 1;

      completedSessions += 1;
    } else if (isPast) {
      displayStatus = 'Absent';
      absentCount += 1;
      completedSessions += 1;
    } else {
      displayStatus = 'Upcoming';
      upcomingSessions += 1;
    }

    return {
      sessionId: sess._id,
      sessionNumber: sess.sessionNumber,
      title: sess.title,
      focus: sess.focus,
      activities: sess.activities || [],
      date: sess.date,
      startTime: sess.startTime,
      endTime: sess.endTime,
      instructor: sess.instructor,
      location: sess.location,
      deliveryMode: sess.deliveryMode,
      status: displayStatus,
      checkInTime,
      checkInMethod,
      attendanceWindow: sess.attendanceWindow,
      isWindowOpen: sess.attendanceWindow?.opensAt && sess.attendanceWindow?.closesAt
        ? now >= sess.attendanceWindow.opensAt && now <= sess.attendanceWindow.closesAt
        : false,
    };
  });

  // Accurate Attendance Rate: (Present + Late * weight + Excused) / completedSessions * 100
  const attendedCredit = presentCount + lateCount * policy.lateWeight + excusedCount;
  const attendanceRate = completedSessions > 0
    ? Math.round((attendedCredit / completedSessions) * 100)
    : 100;

  const absenceRate = completedSessions > 0
    ? Math.round((absentCount / completedSessions) * 100)
    : 0;

  // Recovery Logic (Section 23):
  // Check if student can mathematically recover by attending all future sessions
  const remainingSessions = Math.max(totalSessions - completedSessions, 0);
  const maxPossibleCredit = attendedCredit + remainingSessions * 1.0;
  const maxPossibleFinalRate = totalSessions > 0
    ? Math.round((maxPossibleCredit / totalSessions) * 100)
    : 100;

  const isMathematicallyIneligible = maxPossibleFinalRate < policy.minimumAttendancePercentage;

  // Determine Warning State
  let warningState = 'NORMAL';
  let warningMessage = 'Attendance is on track.';

  if (isMathematicallyIneligible) {
    warningState = 'CERTIFICATE_INELIGIBLE';
    warningMessage = 'Your current absence rate exceeds the permitted attendance limit. You are ineligible for the course certificate.';
  } else if (absenceRate >= policy.finalWarningAbsenceThreshold) {
    warningState = 'FINAL_WARNING';
    warningMessage = 'Your attendance has reached a critical level. Further absence will cause certificate ineligibility.';
  } else if (absenceRate >= policy.warningAbsenceThreshold) {
    warningState = 'WARNING';
    warningMessage = 'Your absence rate has exceeded the warning threshold. Continued absence will jeopardize certificate eligibility.';
  } else if (absenceRate >= policy.attentionAbsenceThreshold) {
    warningState = 'ATTENTION';
    warningMessage = 'Your attendance is approaching the permitted absence limit. Regular participation is required.';
  }

  // Certificate Eligibility:
  let certificateEligibility = 'ON_TRACK';
  if (isMathematicallyIneligible) {
    certificateEligibility = 'INELIGIBLE';
  } else if (completedSessions >= totalSessions && totalSessions > 0) {
    certificateEligibility = attendanceRate >= policy.minimumAttendancePercentage ? 'PASSED' : 'FAILED';
  } else if (warningState === 'WARNING' || warningState === 'FINAL_WARNING') {
    certificateEligibility = 'AT_RISK';
  }

  return {
    enrollmentId: enrollment._id,
    courseId: enrollment.course?._id,
    courseTitle: enrollment.course?.title,
    cohortId: enrollment.cohort?._id,
    cohortName: enrollment.cohort?.name,
    totalSessions,
    completedSessions,
    upcomingSessions,
    remainingSessions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    attendanceRate,
    absenceRate,
    policy: {
      minimumAttendancePercentage: policy.minimumAttendancePercentage,
      warningAbsenceThreshold: policy.warningAbsenceThreshold,
      finalWarningAbsenceThreshold: policy.finalWarningAbsenceThreshold,
      lateWeight: policy.lateWeight,
    },
    recovery: {
      maxPossibleFinalRate,
      canRecover: !isMathematicallyIneligible,
    },
    warningState,
    warningMessage,
    certificateEligibility,
    sessions: sessionDetails,
  };
}

/**
 * Validates a secure QR token and records check-in.
 */
async function recordQRCheckIn(studentId, token, checkInMethod = 'QR_Scan') {
  if (!token || typeof token !== 'string') {
    throw new AppError('Invalid attendance QR code.', 400);
  }

  const now = new Date();

  // Find session with this QR token
  const session = await TrainingSession.findOne({
    'qrCode.token': token.trim(),
    'qrCode.isActive': true,
  }).populate('course').populate('cohort');

  if (!session) {
    throw new AppError('Invalid or unrecognized attendance QR code.', 400);
  }

  if (session.status === 'Cancelled') {
    throw new AppError('This training session has been cancelled.', 400);
  }

  if (session.qrCode.expiresAt && now > session.qrCode.expiresAt) {
    throw new AppError('This attendance QR code has expired. Request a refreshed code from your instructor.', 400);
  }

  // Verify attendance window
  const windowOpens = session.attendanceWindow?.opensAt;
  const windowCloses = session.attendanceWindow?.closesAt;

  if (windowOpens && now < windowOpens) {
    const openTimeStr = windowOpens.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    throw new AppError(`Attendance window has not opened yet. Check-in opens at ${openTimeStr}.`, 400);
  }

  if (windowCloses && now > windowCloses) {
    throw new AppError('The attendance window for this session has closed.', 400);
  }

  // Verify student enrollment in this cohort
  const enrollment = await Enrollment.findOne({
    student: studentId,
    cohort: session.cohort._id,
    status: { $in: ['Active', 'Confirmed', 'Completed'] },
  });

  if (!enrollment) {
    throw new AppError('You are not enrolled in the cohort scheduled for this session.', 403);
  }

  // Check for duplicate check-in
  const existingRecord = await AttendanceRecord.findOne({
    student: studentId,
    session: session._id,
  });

  if (existingRecord) {
    const timeFormatted = existingRecord.checkInTime
      ? new Date(existingRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'earlier';
    throw new AppError(`Attendance already recorded for this session at ${timeFormatted} (${existingRecord.status}).`, 409);
  }

  // Determine Present vs Late based on session start time and grace period
  const policy = getAttendancePolicy();
  let status = 'Present';

  if (session.attendanceWindow?.opensAt) {
    const graceCutoff = new Date(session.attendanceWindow.opensAt.getTime() + (policy.qrWindowMinutesBefore + policy.qrGracePeriodMinutes) * 60000);
    if (now > graceCutoff) {
      status = 'Late';
    }
  }

  const record = await AttendanceRecord.create({
    session: session._id,
    student: studentId,
    enrollment: enrollment._id,
    course: session.course._id,
    cohort: session.cohort._id,
    status,
    checkInTime: now,
    checkInMethod,
    notes: status === 'Late' ? 'Late check-in via QR' : 'On-time check-in via QR',
  });

  // Calculate new summary and verify if warning notification should be triggered
  const summary = await getAttendanceSummary(studentId, enrollment._id);

  if (summary.warningState === 'WARNING' || summary.warningState === 'FINAL_WARNING' || summary.warningState === 'CERTIFICATE_INELIGIBLE') {
    await notify({
      recipient: studentId,
      title: `Attendance Status Update: ${summary.warningState.replace('_', ' ')}`,
      message: `${summary.warningMessage} Current Attendance Rate: ${summary.attendanceRate}%.`,
      type: summary.warningState === 'CERTIFICATE_INELIGIBLE' ? 'error' : 'warning',
      relatedCourse: session.course._id,
    }).catch(() => null);
  }

  return {
    record,
    summary,
    sessionTitle: session.title,
    sessionNumber: session.sessionNumber,
  };
}

/**
 * Admin / Instructor manual attendance correction with audit history.
 */
async function correctAttendance(recordId, newStatus, changedByUserId, reason) {
  if (!['Present', 'Late', 'Absent', 'Excused'].includes(newStatus)) {
    throw new AppError('Invalid attendance status.', 400);
  }
  if (!reason || !reason.trim()) {
    throw new AppError('A valid correction reason is required for administrative audit logs.', 400);
  }

  const record = await AttendanceRecord.findById(recordId);
  if (!record) {
    throw new AppError('Attendance record not found.', 404);
  }

  const prev = record.status;
  record.status = newStatus;
  record.correctionHistory.push({
    previousStatus: prev,
    newStatus,
    changedBy: changedByUserId,
    changedAt: new Date(),
    reason: reason.trim(),
  });

  await record.save();

  // Recalculate summary
  const summary = await getAttendanceSummary(record.student, record.enrollment);

  await notify({
    recipient: record.student,
    title: 'Attendance Record Updated by Academy Staff',
    message: `Session #${record.session} attendance corrected from ${prev} to ${newStatus}. Reason: ${reason}.`,
    type: 'info',
    relatedCourse: record.course,
  }).catch(() => null);

  return { record, summary };
}

/**
 * Generate a fresh secure QR token for a session.
 */
async function generateSessionQR(sessionId, validMinutes = 60) {
  const session = await TrainingSession.findById(sessionId);
  if (!session) throw new AppError('Session not found.', 404);

  const token = `EGSA-ATT-${session.cohort}-${session.sessionNumber}-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validMinutes * 60000);

  session.qrCode = {
    token,
    generatedAt: now,
    expiresAt,
    isActive: true,
  };

  // Auto-set attendance window if not set
  if (!session.attendanceWindow?.opensAt) {
    session.attendanceWindow = {
      opensAt: new Date(now.getTime() - 15 * 60000),
      closesAt: expiresAt,
    };
  } else if (!session.attendanceWindow?.closesAt || session.attendanceWindow.closesAt < expiresAt) {
    session.attendanceWindow.closesAt = expiresAt;
  }

  await session.save();
  return { session, token, expiresAt };
}

/**
 * Student submits an attendance dispute or excuse request.
 */
async function submitDispute({ studentId, sessionId, enrollmentId, reason, type = 'Dispute', documentation }) {
  if (!reason || !reason.trim()) throw new AppError('Please provide a reason for your request.', 400);

  const session = await TrainingSession.findById(sessionId);
  if (!session) throw new AppError('Session not found.', 404);

  const dispute = await AttendanceDispute.create({
    student: studentId,
    session: sessionId,
    enrollment: enrollmentId,
    type,
    reason: reason.trim(),
    documentation,
    status: 'Pending',
  });

  return dispute;
}

/**
 * Admin reviews an attendance dispute or excuse request.
 */
async function reviewDispute({ disputeId, approved, adminUserId, reviewNotes }) {
  const dispute = await AttendanceDispute.findById(disputeId);
  if (!dispute) throw new AppError('Dispute request not found.', 404);

  dispute.status = approved ? 'Approved' : 'Rejected';
  dispute.reviewedBy = adminUserId;
  dispute.reviewedAt = new Date();
  dispute.reviewNotes = reviewNotes;
  await dispute.save();

  if (approved) {
    // If approved, create or update attendance record
    const targetStatus = dispute.type === 'Excuse' ? 'Excused' : 'Present';
    let record = await AttendanceRecord.findOne({ student: dispute.student, session: dispute.session });

    if (record) {
      const prevStatus = record.status;
      record.status = targetStatus;
      record.correctionHistory.push({
        previousStatus: prevStatus,
        newStatus: targetStatus,
        changedBy: adminUserId,
        changedAt: new Date(),
        reason: `Approved ${dispute.type} request: ${reviewNotes || dispute.reason}`,
      });
      await record.save();
    } else {
      const session = await TrainingSession.findById(dispute.session);
      record = await AttendanceRecord.create({
        session: dispute.session,
        student: dispute.student,
        enrollment: dispute.enrollment,
        course: session.course,
        cohort: session.cohort,
        status: targetStatus,
        checkInTime: new Date(),
        checkInMethod: 'Dispute_Approval',
        notes: `Approved ${dispute.type}: ${dispute.reason}`,
      });
    }
  }

  await notify({
    recipient: dispute.student,
    title: `Attendance ${dispute.type} Request ${approved ? 'Approved' : 'Rejected'}`,
    message: `Your ${dispute.type.toLowerCase()} request has been ${approved ? 'approved' : 'rejected'} by Space Academy administration.`,
    type: approved ? 'success' : 'warning',
  }).catch(() => null);

  return dispute;
}

module.exports = {
  getAttendancePolicy,
  getAttendanceSummary,
  recordQRCheckIn,
  correctAttendance,
  generateSessionQR,
  submitDispute,
  reviewDispute,
};
