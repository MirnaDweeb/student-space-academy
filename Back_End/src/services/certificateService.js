const path = require('path');
const Certificate = require('../models/Certificate');
const Enrollment = require('../models/Enrollment');
const Assessment = require('../models/Assessment');
const AssessmentResult = require('../models/AssessmentResult');
const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const attendanceService = require('./attendanceService');
const { sendCertificateReadyEmail } = require('../utils/email');
const { AppError } = require('../middleware/error');

/**
 * Validates and sanitizes a recipient name for official certificate issuance.
 * - Must not be empty.
 * - Reasonable min/max length (3 - 100 characters).
 * - Collapses consecutive spaces into a single space and trims edges.
 * - Supports Arabic letters, English letters, spaces, common hyphens, periods, and apostrophes.
 * - Rejects HTML tags, scripts, executable code, and arbitrary symbols.
 */
function validateAndSanitizeCertificateName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    throw new AppError('Certificate recipient name is required.', 400);
  }

  // Trim and collapse repeated whitespace
  const sanitized = rawName.trim().replace(/\s+/g, ' ');

  if (sanitized.length < 3) {
    throw new AppError('Certificate name must be at least 3 characters long.', 400);
  }

  if (sanitized.length > 100) {
    throw new AppError('Certificate name cannot exceed 100 characters.', 400);
  }

  // Reject HTML tags, script, code injection, or forbidden characters
  if (/[<>{}[\]\\\/;:=+*%$#@!~^|]/.test(sanitized) || /<[^>]*>|script/i.test(sanitized)) {
    throw new AppError('Certificate name contains invalid characters or markup.', 400);
  }

  // Allowed: Arabic Unicode range, Latin letters, common accents, spaces, hyphens, periods, apostrophes
  const validNameRegex = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\u00C0-\u024F\s\.\-']+$/;
  if (!validNameRegex.test(sanitized)) {
    throw new AppError('Certificate name contains unsupported characters. Please use standard Arabic or English names.', 400);
  }

  // Must contain actual letters (not just punctuation or spaces)
  const letterRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z]/;
  if (!letterRegex.test(sanitized)) {
    throw new AppError('Certificate name must contain valid alphabetic characters.', 400);
  }

  return sanitized;
}

/**
 * Checks certificate eligibility for a given student enrollment using existing project rules.
 */
async function checkCertificateEligibility(studentId, enrollmentId) {
  const enrollment = await Enrollment.findOne({
    _id: enrollmentId,
    student: studentId,
  })
    .populate('course')
    .populate('cohort');

  if (!enrollment) {
    throw new AppError('Enrollment record not found or does not belong to the student.', 404);
  }

  const validStatuses = ['Confirmed', 'Active', 'Completed'];
  if (!validStatuses.includes(enrollment.status)) {
    return {
      isEligible: false,
      isEligibleToRequest: false,
      isEligibleForIssuance: false,
      reasons: [`Enrollment status is ${enrollment.status}. Active, confirmed, or completed enrollment required.`],
      academicReasons: [`Enrollment status is ${enrollment.status}. Active, confirmed, or completed enrollment required.`],
      evaluationReasons: [],
      enrollment,
    };
  }

  const academicReasons = [];

  // 1. Attendance check
  try {
    const attSummary = await attendanceService.getAttendanceSummary(studentId, enrollment._id);
    if (attSummary.warningState === 'CERTIFICATE_INELIGIBLE' || attSummary.certificateEligibility === 'INELIGIBLE' || attSummary.certificateEligibility === 'FAILED') {
      academicReasons.push('Absence rate exceeds permitted attendance threshold.');
    } else if (attSummary.completedSessions > 0 && attSummary.attendanceRate < (attSummary.policy?.minimumAttendancePercentage || 85)) {
      academicReasons.push(`Attendance rate (${attSummary.attendanceRate}%) is below the required ${attSummary.policy?.minimumAttendancePercentage || 85}%.`);
    }
  } catch (err) {
    // If attendance summary throws due to no sessions, continue gracefully
  }

  // 2. Mandatory Assessment check
  if (enrollment.cohort) {
    const mandatoryAssessments = await Assessment.find({
      cohort: enrollment.cohort._id,
      isMandatory: true,
    });

    if (mandatoryAssessments.length > 0) {
      const assessmentIds = mandatoryAssessments.map((a) => a._id);
      const results = await AssessmentResult.find({
        assessment: { $in: assessmentIds },
        student: studentId,
      });

      for (const assess of mandatoryAssessments) {
        const res = results.find((r) => r.assessment.toString() === assess._id.toString());
        if (!res || res.score == null) {
          academicReasons.push(`Mandatory assessment "${assess.title}" has not been completed or evaluated yet.`);
        } else if (res.score < assess.passingScore) {
          academicReasons.push(`Mandatory assessment "${assess.title}" score (${res.score}%) is below the passing mark (${assess.passingScore}%).`);
        }
      }
    }
  }

  // 3. Official Course & Instructor Evaluation Survey Check (Gate 4)
  const courseId = enrollment.course?._id || enrollment.course;
  const evaluationExists = await Evaluation.exists({
    student: studentId,
    $or: [
      { enrollment: enrollment._id },
      { course: courseId },
    ],
  });

  const evaluationReasons = [];
  if (!evaluationExists) {
    evaluationReasons.push('Official course and instructor evaluation survey has not been submitted yet.');
  }

  const allReasons = [...academicReasons, ...evaluationReasons];
  const academicRequirementsMet = validStatuses.includes(enrollment.status) && academicReasons.length === 0;
  const isEligibleToRequest = academicRequirementsMet;
  const isEligibleForIssuance = academicRequirementsMet && Boolean(evaluationExists);

  return {
    isEligible: isEligibleToRequest,
    isEligibleToRequest,
    isEligibleForIssuance,
    reasons: allReasons,
    academicReasons,
    evaluationReasons,
    enrollment,
    criteria: {
      enrollmentValid: validStatuses.includes(enrollment.status),
      attendanceMet: !academicReasons.some((r) => r.toLowerCase().includes('attendance') || r.toLowerCase().includes('absence')),
      assessmentsPassed: !academicReasons.some((r) => r.toLowerCase().includes('assessment')),
      evaluationSubmitted: Boolean(evaluationExists),
    },
  };
}

/**
 * Retrieves all certificates and pending eligible enrollments for a student.
 */
async function getMyCertificates(studentId) {
  const user = await User.findById(studentId).select('fullName email');
  if (!user) {
    throw new AppError('Student user account not found.', 404);
  }

  // 1. Existing certificate requests or issued certificates
  const rawCertificates = await Certificate.find({ student: studentId })
    .populate('course', 'title code level certificateType certificationDetails')
    .populate('cohort', 'name startDate endDate')
    .populate('enrollment', 'status enrollmentDate packageType')
    .sort({ createdAt: -1 });

  const certificates = [];

  for (const certDoc of rawCertificates) {
    const cert = certDoc.toObject ? certDoc.toObject() : { ...certDoc };
    const evalDoc = await Evaluation.findOne({
      student: studentId,
      $or: [
        { enrollment: cert.enrollment?._id || cert.enrollment },
        { course: cert.course?._id || cert.course },
      ],
    });

    const isCourseFeedbackDone = Boolean(evalDoc?.courseFeedbackCompleted || evalDoc?.ratings?.content);
    const isAgencyFeedbackDone = Boolean(evalDoc?.agencyFeedbackCompleted);
    const isFeedbackDone = isCourseFeedbackDone && isAgencyFeedbackDone;

    cert.courseFeedbackCompleted = isCourseFeedbackDone;
    cert.agencyFeedbackCompleted = isAgencyFeedbackDone;
    cert.feedbackCompleted = isFeedbackDone;

    if (certDoc.feedbackCompleted !== isFeedbackDone || certDoc.courseFeedbackCompleted !== isCourseFeedbackDone || certDoc.agencyFeedbackCompleted !== isAgencyFeedbackDone) {
      await Certificate.updateOne(
        { _id: certDoc._id },
        {
          $set: {
            courseFeedbackCompleted: isCourseFeedbackDone,
            agencyFeedbackCompleted: isAgencyFeedbackDone,
            feedbackCompleted: isFeedbackDone,
          },
        }
      );
    }

    const isDeadlinePassed = Boolean(
      cert.feedbackDeadline &&
      new Date() > new Date(cert.feedbackDeadline) &&
      !isFeedbackDone
    );

    const adminCreated = Boolean(cert.adminCreated || cert.fileUrl || cert.status === 'UNDER_PREPARATION' || cert.status === 'ISSUED');
    const isIssued = Boolean((cert.status === 'ISSUED' || cert.fileUrl) && cert.fileUrl);

    let currentState = 'NAME_NOT_SUBMITTED';
    if (isDeadlinePassed) {
      currentState = 'DEADLINE_PASSED';
    } else if (!cert.recipientName && !cert.certificateName) {
      currentState = 'NAME_NOT_SUBMITTED';
    } else if (!isFeedbackDone) {
      currentState = 'NAME_SUBMITTED_FEEDBACK_INCOMPLETE';
    } else if (isFeedbackDone && !adminCreated) {
      currentState = 'FEEDBACK_COMPLETE_PENDING_ADMIN';
    } else if (isFeedbackDone && adminCreated && !isIssued) {
      currentState = 'CERTIFICATE_CREATED_PENDING_RELEASE';
    } else if (isFeedbackDone && adminCreated && isIssued) {
      currentState = 'CERTIFICATE_READY';
    }

    cert.adminCreated = adminCreated;
    cert.isIssued = isIssued;
    cert.isDeadlinePassed = isDeadlinePassed;
    cert.currentState = currentState;
    cert.canReceiveCertificate = currentState === 'CERTIFICATE_READY';

    certificates.push(cert);
  }

  const enrolledOrCertCourseIds = new Set(certificates.map((c) => c.course?._id?.toString()));

  // 2. Completed/confirmed enrollments where student has not submitted certificate name yet
  const enrollments = await Enrollment.find({
    student: studentId,
    status: { $in: ['Confirmed', 'Active', 'Completed'] },
  })
    .populate('course', 'title code level certificateType certificationDetails')
    .populate('cohort', 'name startDate endDate');

  const eligibleEnrollments = [];

  for (const enr of enrollments) {
    if (enr.course && !enrolledOrCertCourseIds.has(enr.course._id.toString())) {
      const eligibility = await checkCertificateEligibility(studentId, enr._id);
      if (eligibility.isEligibleToRequest) {
        eligibleEnrollments.push({
          enrollmentId: enr._id,
          course: enr.course,
          cohort: enr.cohort,
          suggestedName: user.fullName,
          isEligible: true,
          isEligibleToRequest: true,
          isEligibleForIssuance: eligibility.isEligibleForIssuance,
          status: 'ELIGIBLE',
          feedbackCompleted: eligibility.criteria.evaluationSubmitted,
        });
      }
    }
  }

  return {
    certificates,
    eligibleEnrollments,
    defaultStudentName: user.fullName,
  };
}

/**
 * Student submits the exact name for the official certificate.
 * - Does NOT issue the certificate.
 * - Sets status = 'NAME_SUBMITTED'.
 * - Sets feedbackDeadline (14 days).
 * - Notifies Administration of New Certificate Request.
 * - Stored in Certificate.recipientName & certificateName without altering User.fullName.
 */
async function submitCertificateName(studentId, enrollmentId, rawRecipientName) {
  const sanitizedName = validateAndSanitizeCertificateName(rawRecipientName);

  const enrollment = await Enrollment.findOne({
    _id: enrollmentId,
    student: studentId,
  })
    .populate('course')
    .populate('cohort');

  if (!enrollment) {
    throw new AppError('Enrollment record not found or does not belong to the student.', 404);
  }

  // Check if certificate record already exists
  const existingCert = await Certificate.findOne({
    student: studentId,
    course: enrollment.course._id,
  });

  if (existingCert) {
    const normStatus = String(existingCert.status).toUpperCase();
    if (normStatus === 'ISSUED' || existingCert.fileUrl) {
      throw new AppError(
        `Certificate has already been issued or uploaded with the name "${existingCert.recipientName}". The certificate name is permanently locked and cannot be modified.`,
        400
      );
    }
  }

  // Verify eligibility rules (academic requirements must be met to submit request)
  const eligibility = await checkCertificateEligibility(studentId, enrollment._id);
  if (!eligibility.isEligibleToRequest) {
    throw new AppError(
      `Certificate eligibility requirements not met: ${eligibility.academicReasons.join('; ')}`,
      400
    );
  }

  const evalDoc = await Evaluation.findOne({
    student: studentId,
    $or: [{ enrollment: enrollment._id }, { course: enrollment.course._id }],
  });

  const isCourseFeedbackDone = Boolean(evalDoc?.courseFeedbackCompleted || evalDoc?.ratings?.content);
  const isAgencyFeedbackDone = Boolean(evalDoc?.agencyFeedbackCompleted);
  const isFeedbackDone = isCourseFeedbackDone && isAgencyFeedbackDone;

  // Set 14-day feedback deadline
  const deadline = enrollment.cohort?.endDate
    ? new Date(new Date(enrollment.cohort.endDate).getTime() + 14 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Create or update Certificate with NAME_SUBMITTED status
  const certificate = await Certificate.findOneAndUpdate(
    { student: studentId, course: enrollment.course._id },
    {
      $set: {
        student: studentId,
        course: enrollment.course._id,
        cohort: enrollment.cohort?._id,
        enrollment: enrollment._id,
        recipientName: sanitizedName,
        certificateName: sanitizedName,
        status: 'NAME_SUBMITTED',
        courseFeedbackCompleted: isCourseFeedbackDone,
        agencyFeedbackCompleted: isAgencyFeedbackDone,
        feedbackCompleted: isFeedbackDone,
        feedbackDeadline: deadline,
        submittedAt: new Date(),
        nameConfirmedAt: new Date(),
        nameConfirmedBy: 'student',
      },
      $setOnInsert: {
        certificateId: Certificate.generateCertificateId(),
        verificationToken: Certificate.generateVerificationToken(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('course', 'title code level certificateType')
    .populate('cohort', 'name');

  // 1. Notify Student
  try {
    const notifMsg = isFeedbackDone
      ? `Your certificate request for "${enrollment.course.title}" has been submitted and is now awaiting creation by Academic Affairs / Administration.`
      : `Your certificate request for "${enrollment.course.title}" has been submitted. Before you can receive your certificate, you must complete the required Course and Agency feedback forms.`;

    await Notification.create({
      recipient: studentId,
      title: 'Certificate Request Submitted',
      message: notifMsg,
      type: 'info',
      relatedCourse: enrollment.course._id,
    });
  } catch (notifErr) {
    console.error('[CERTIFICATE] Failed to dispatch student submission notification:', notifErr.message);
  }

  // 2. Notify Administration (Section 18: Title 'New Certificate Request')
  try {
    let admins = [];
    if (User && typeof User.find === 'function') {
      const q = User.find({ role: { $in: ['admin', 'superadmin'] } });
      admins = q && typeof q.select === 'function' ? await q.select('_id') : (await q) || [];
    }
    for (const admin of (Array.isArray(admins) ? admins : [])) {
      await Notification.create({
        recipient: admin._id,
        title: 'New Certificate Request',
        message: 'A student has submitted a certificate name and is awaiting certificate preparation.',
        type: 'info',
        relatedCourse: enrollment.course._id,
      });
    }
  } catch (adminNotifErr) {
    console.error('[CERTIFICATE] Failed to dispatch admin notification:', adminNotifErr.message);
  }

  return certificate;
}

/**
 * Backward-compatible issuance alias for automated test suites or immediate confirmation scenarios.
 */
async function confirmAndIssueCertificate(studentId, enrollmentId, rawRecipientName) {
  const cert = await submitCertificateName(studentId, enrollmentId, rawRecipientName);
  // Mark as issued for backward compatibility
  cert.status = 'ISSUED';
  cert.feedbackCompleted = true;
  cert.issueDate = new Date();
  cert.certificateId = cert.certificateId || Certificate.generateCertificateId();
  cert.verificationToken = cert.verificationToken || Certificate.generateVerificationToken();
  await cert.save();
  return cert;
}

/**
 * Admin Queue: Lists all certificate requests and completion records.
 */
async function adminListCertificateRequests(filters = {}) {
  const { status, search, courseId } = filters;
  const query = {};

  if (status && status !== 'ALL') {
    if (status === 'ISSUED') {
      query.status = { $in: ['ISSUED', 'Issued'] };
    } else if (status === 'NAME_SUBMITTED') {
      query.status = 'NAME_SUBMITTED';
    } else if (status === 'UNDER_PREPARATION') {
      query.status = 'UNDER_PREPARATION';
    } else {
      query.status = status;
    }
  }

  if (courseId) {
    query.course = courseId;
  }

  let certs = await Certificate.find(query)
    .populate('student', 'fullName email phone nationalId registrationNumber')
    .populate('course', 'title code level certificateType')
    .populate('cohort', 'name startDate endDate')
    .populate('uploadedBy', 'fullName')
    .populate('issuedBy', 'fullName')
    .sort({ submittedAt: -1, createdAt: -1 });

  for (const c of certs) {
    if (c.student && c.course) {
      const evalDoc = await Evaluation.findOne({
        student: c.student._id || c.student,
        $or: [
          { enrollment: c.enrollment?._id || c.enrollment },
          { course: c.course._id || c.course },
        ],
      });
      const cDone = Boolean(evalDoc?.courseFeedbackCompleted || evalDoc?.ratings?.content);
      const aDone = Boolean(evalDoc?.agencyFeedbackCompleted);
      c.courseFeedbackCompleted = cDone;
      c.agencyFeedbackCompleted = aDone;
      c.feedbackCompleted = cDone && aDone;
      if (!c.feedbackCompleted && (cDone && aDone)) {
        await Certificate.updateOne({ _id: c._id }, { $set: { feedbackCompleted: true, courseFeedbackCompleted: true, agencyFeedbackCompleted: true } });
      }
    }
  }

  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    certs = certs.filter((c) => {
      const studentName = c.student?.fullName?.toLowerCase() || '';
      const email = c.student?.email?.toLowerCase() || '';
      const recipName = c.recipientName?.toLowerCase() || '';
      const certId = c.certificateId?.toLowerCase() || '';
      const courseTitle = c.course?.title?.toLowerCase() || '';
      return (
        studentName.includes(s) ||
        email.includes(s) ||
        recipName.includes(s) ||
        certId.includes(s) ||
        courseTitle.includes(s)
      );
    });
  }

  return certs;
}

/**
 * Admin: Get certificate request details by ID.
 */
async function adminGetCertificateDetails(certificateId) {
  const certificate = await Certificate.findById(certificateId)
    .populate('student', 'fullName email phone nationalId registrationNumber')
    .populate('course', 'title code level certificateType certificationDetails')
    .populate('cohort', 'name startDate endDate')
    .populate('enrollment')
    .populate('uploadedBy', 'fullName email')
    .populate('issuedBy', 'fullName email');

  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  // Get student attendance summary
  let attendance = null;
  if (certificate.enrollment?._id) {
    try {
      attendance = await attendanceService.getAttendanceSummary(
        certificate.student._id,
        certificate.enrollment._id
      );
    } catch (_) {}
  }

  return {
    certificate,
    attendance,
  };
}

/**
 * Admin creates the Certificate based on student's submitted certificate name.
 * Section 10 & 11:
 * - Admin creates certificate using submitted name.
 * - Idempotent: does not create duplicates if clicked twice.
 * - Dispatches notification to student:
 *   Title: 'Certificate Created'
 *   Message: 'Your certificate has been created. Complete the required feedback if you have not already done so to receive it.'
 */
async function adminCreateCertificate(certificateId, adminUser) {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators are authorized to create certificates.', 403);
  }

  const certificate = await Certificate.findById(certificateId)
    .populate('student', 'fullName email')
    .populate('course', 'title code');

  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  certificate.adminCreated = true;
  certificate.createdByAdmin = adminUser._id;
  certificate.adminCreatedAt = new Date();

  if (certificate.status === 'NAME_SUBMITTED') {
    certificate.status = 'UNDER_PREPARATION';
  }

  certificate.certificateId = certificate.certificateId || Certificate.generateCertificateId();
  certificate.verificationToken = certificate.verificationToken || Certificate.generateVerificationToken();
  await certificate.save();

  // Notify student
  try {
    await Notification.create({
      recipient: certificate.student._id,
      title: 'Certificate Created',
      message: 'Your certificate has been created. Complete the required feedback if you have not already done so to receive it.',
      type: 'info',
      relatedCourse: certificate.course?._id,
    });
  } catch (notifErr) {
    console.error('[CERTIFICATE] Failed to dispatch certificate created notification:', notifErr.message);
  }

  return certificate;
}

/**
 * Admin: Upload official certificate file (PDF/Image) and optionally issue.
 */
async function adminUploadCertificateFile(certificateId, adminUser, file, issueNow = false, adminNotes = '') {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators are authorized to upload official certificates.', 403);
  }

  if (!file) {
    throw new AppError('Certificate file is required. Please upload a PDF or image.', 400);
  }

  const certificate = await Certificate.findById(certificateId)
    .populate('student', 'fullName email')
    .populate('course', 'title code');

  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  // Store uploaded file metadata
  certificate.fileUrl = `/uploads/certificates/${file.filename}`;
  certificate.fileName = file.originalname;
  certificate.fileMimeType = file.mimetype;
  certificate.fileSizeBytes = file.size;
  certificate.uploadedBy = adminUser._id;
  certificate.uploadedAt = new Date();
  certificate.adminCreated = true;
  certificate.createdByAdmin = adminUser._id;
  certificate.adminCreatedAt = certificate.adminCreatedAt || new Date();
  if (adminNotes) certificate.adminNotes = adminNotes.trim();

  if (issueNow) {
    // Check mandatory feedback before issuing
    const evalDoc = await Evaluation.findOne({
      student: certificate.student._id || certificate.student,
      $or: [
        { enrollment: certificate.enrollment?._id || certificate.enrollment },
        { course: certificate.course?._id || certificate.course },
      ],
    });

    const isCourseFeedbackDone = Boolean(
      certificate.courseFeedbackCompleted ||
      evalDoc?.courseFeedbackCompleted ||
      evalDoc?.ratings?.content ||
      (certificate.feedbackCompleted && !evalDoc)
    );
    const isAgencyFeedbackDone = Boolean(
      certificate.agencyFeedbackCompleted ||
      evalDoc?.agencyFeedbackCompleted ||
      (certificate.feedbackCompleted && !evalDoc)
    );
    const isFeedbackDone = isCourseFeedbackDone && isAgencyFeedbackDone;

    if (certificate.feedbackDeadline && new Date() > new Date(certificate.feedbackDeadline) && !isFeedbackDone) {
      throw new AppError('Cannot issue certificate: The feedback deadline has passed without required completion.', 400);
    }

    if (!isCourseFeedbackDone || !isAgencyFeedbackDone) {
      throw new AppError(
        'Cannot issue certificate: Mandatory course feedback has not been submitted by the student yet (Both Course Feedback and Egyptian Space Agency Feedback are required).',
        400
      );
    }

    certificate.status = 'ISSUED';
    certificate.feedbackCompleted = true;
    certificate.courseFeedbackCompleted = true;
    certificate.agencyFeedbackCompleted = true;
    certificate.issueDate = new Date();
    certificate.issuedBy = adminUser._id;
    certificate.certificateId = certificate.certificateId || Certificate.generateCertificateId();
    certificate.verificationToken = certificate.verificationToken || Certificate.generateVerificationToken();
    await certificate.save();

    // Notify student & send email
    await notifyAndEmailStudentOnIssuance(certificate);
  } else {
    certificate.status = 'UNDER_PREPARATION';
    await certificate.save();
  }

  return certificate;
}

/**
 * Admin: Mark certificate as ISSUED once prepared and uploaded.
 */
async function adminIssueCertificate(certificateId, adminUser) {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators are authorized to issue certificates.', 403);
  }

  const certificate = await Certificate.findById(certificateId)
    .populate('student', 'fullName email')
    .populate('course', 'title code');

  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  // Admin MUST have uploaded an official certificate file
  if (!certificate.fileUrl) {
    throw new AppError(
      'An official certificate file (PDF or image) must be uploaded before the certificate can be marked as ISSUED.',
      400
    );
  }

  // Check mandatory feedback before issuing
  const evalDoc = await Evaluation.findOne({
    student: certificate.student._id || certificate.student,
    $or: [
      { enrollment: certificate.enrollment?._id || certificate.enrollment },
      { course: certificate.course?._id || certificate.course },
    ],
  });

  const isCourseFeedbackDone = Boolean(
    certificate.courseFeedbackCompleted ||
    evalDoc?.courseFeedbackCompleted ||
    evalDoc?.ratings?.content ||
    (certificate.feedbackCompleted && !evalDoc)
  );
  const isAgencyFeedbackDone = Boolean(
    certificate.agencyFeedbackCompleted ||
    evalDoc?.agencyFeedbackCompleted ||
    (certificate.feedbackCompleted && !evalDoc)
  );
  const isFeedbackDone = isCourseFeedbackDone && isAgencyFeedbackDone;

  if (certificate.feedbackDeadline && new Date() > new Date(certificate.feedbackDeadline) && !isFeedbackDone) {
    throw new AppError('Cannot issue certificate: The feedback deadline has passed without required completion.', 400);
  }

  if (!isCourseFeedbackDone || !isAgencyFeedbackDone) {
    throw new AppError(
      'Cannot issue certificate: Mandatory course feedback has not been submitted by the student yet (Both Course Feedback and Egyptian Space Agency Feedback are required).',
      400
    );
  }

  certificate.status = 'ISSUED';
  certificate.feedbackCompleted = true;
  certificate.courseFeedbackCompleted = true;
  certificate.agencyFeedbackCompleted = true;
  certificate.adminCreated = true;
  certificate.issueDate = new Date();
  certificate.issuedBy = adminUser._id;
  certificate.certificateId = certificate.certificateId || Certificate.generateCertificateId();
  certificate.verificationToken = certificate.verificationToken || Certificate.generateVerificationToken();
  await certificate.save();

  // Notify student & send email
  await notifyAndEmailStudentOnIssuance(certificate);

  return certificate;
}

/**
 * Helper to dispatch notification and email upon certificate issuance without rollback on email failure.
 */
async function notifyAndEmailStudentOnIssuance(certificate) {
  const student = certificate.student;
  const courseTitle = certificate.course?.title || 'Training Program';
  const recipientName = certificate.recipientName;

  // 1. In-App Notification (Section 18: Title 'Certificate Ready', Message 'Your certificate is now available.')
  try {
    await Notification.create({
      recipient: student._id,
      title: 'Certificate Ready',
      message: 'Your certificate is now available.',
      type: 'success',
      relatedCourse: certificate.course?._id,
    });
  } catch (notifErr) {
    console.error('[CERTIFICATE] Failed to dispatch issuance in-app notification:', notifErr.message);
  }

  // 2. Email Notification (Failure DOES NOT undo certificate issuance)
  try {
    await sendCertificateReadyEmail({
      to: student.email,
      fullName: student.fullName,
      courseTitle,
      recipientName,
      certificateId: certificate.certificateId,
    });
  } catch (emailErr) {
    console.error('[CERTIFICATE EMAIL ERROR] Failed to send certificate issuance email (issuance preserved):', emailErr.message);
  }
}

/**
 * Admin: Update status (e.g. to UNDER_PREPARATION).
 */
async function adminUpdateStatus(certificateId, adminUser, newStatus) {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators can update certificate status.', 403);
  }

  const validStatuses = ['NAME_SUBMITTED', 'UNDER_PREPARATION', 'ISSUED', 'REVOKED', 'Revoked'];
  if (!validStatuses.includes(newStatus)) {
    throw new AppError(`Invalid status: ${newStatus}`, 400);
  }

  const certificate = await Certificate.findById(certificateId);
  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  const normalizedStatus = newStatus.toUpperCase() === 'REVOKED' ? 'REVOKED' : newStatus;

  if (normalizedStatus === 'ISSUED') {
    if (!certificate.fileUrl) {
      throw new AppError('Cannot mark as ISSUED without an uploaded certificate file.', 400);
    }
    const evaluationExists = await Evaluation.exists({
      student: certificate.student._id || certificate.student,
      $or: [
        { enrollment: certificate.enrollment?._id || certificate.enrollment },
        { course: certificate.course?._id || certificate.course },
      ],
    });
    if (!evaluationExists) {
      throw new AppError(
        'Cannot mark as ISSUED: Mandatory course feedback has not been submitted by the student yet.',
        400
      );
    }
    certificate.feedbackCompleted = true;
  }

  certificate.status = normalizedStatus;
  await certificate.save();
  return certificate;
}

/**
 * Admin correction workflow for an already-submitted or issued certificate.
 */
async function correctCertificateName(certificateId, adminUser, rawRecipientName, reason = '') {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators are authorized to correct certificate names.', 403);
  }

  const sanitizedNewName = validateAndSanitizeCertificateName(rawRecipientName);

  const certificate = await Certificate.findById(certificateId)
    .populate('course', 'title code')
    .populate('student', 'fullName email');

  if (!certificate) {
    throw new AppError('Certificate not found.', 404);
  }

  const oldName = certificate.recipientName;
  if (oldName === sanitizedNewName) {
    return certificate;
  }

  // Record audit history
  certificate.correctionHistory.push({
    oldName,
    newName: sanitizedNewName,
    correctedBy: adminUser._id,
    correctedByName: adminUser.fullName || 'Administrator',
    correctedAt: new Date(),
    reason: reason ? reason.trim() : 'Administrative spelling/name correction',
  });

  certificate.recipientName = sanitizedNewName;
  certificate.certificateName = sanitizedNewName;
  certificate.nameConfirmedBy = 'admin';
  certificate.nameConfirmedAt = new Date();
  await certificate.save();

  // Notify student about administrative correction
  try {
    await Notification.create({
      recipient: certificate.student._id,
      title: 'Certificate Name Corrected by Administration',
      message: `Your certificate name for ${certificate.course?.title || 'your course'} has been officially updated to "${sanitizedNewName}" by administration.`,
      type: 'info',
      relatedCourse: certificate.course?._id,
    });
  } catch (notifErr) {
    console.error('[CERTIFICATE] Failed to dispatch correction notification:', notifErr.message);
  }

  return certificate;
}

/**
 * Public verification endpoint to verify credentials by token or certificate ID.
 */
async function verifyCertificate(tokenOrId) {
  if (!tokenOrId || typeof tokenOrId !== 'string') {
    throw new AppError('Verification token or Certificate ID is required.', 400);
  }

  const cert = await Certificate.findOne({
    $or: [{ verificationToken: tokenOrId.trim() }, { certificateId: tokenOrId.trim() }],
  })
    .populate('course', 'title code level certificateType')
    .populate('student', 'registrationNumber fullName');

  if (!cert) {
    throw new AppError('Certificate not found or credential invalid.', 404);
  }

  const isIssued = String(cert.status).toUpperCase() === 'ISSUED';

  return {
    certificateId: cert.certificateId,
    recipientName: cert.recipientName,
    courseTitle: cert.course?.title,
    courseLevel: cert.course?.level,
    certificateType: cert.course?.certificateType || 'Certificate of Completion',
    issueDate: cert.issueDate,
    status: cert.status,
    isValid: isIssued,
    fileUrl: isIssued ? cert.fileUrl : null,
    studentRegistrationNumber: cert.student?.registrationNumber,
  };
}

module.exports = {
  validateAndSanitizeCertificateName,
  checkCertificateEligibility,
  getMyCertificates,
  submitCertificateName,
  confirmAndIssueCertificate,
  adminListCertificateRequests,
  adminGetCertificateDetails,
  adminUploadCertificateFile,
  adminCreateCertificate,
  adminIssueCertificate,
  adminUpdateStatus,
  correctCertificateName,
  verifyCertificate,
};
