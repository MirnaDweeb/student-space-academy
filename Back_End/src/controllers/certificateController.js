const path = require('path');
const fs = require('fs');
const certificateService = require('../services/certificateService');
const Certificate = require('../models/Certificate');
const Enrollment = require('../models/Enrollment');
const { AppError } = require('../middleware/error');

/**
 * Returns all certificates and pending eligible enrollments for the student.
 * GET /api/certificates/my
 */
async function myCertificates(req, res, next) {
  try {
    const result = await certificateService.getMyCertificates(req.user._id);
    res.json({
      success: true,
      data: result.certificates,
      eligibleEnrollments: result.eligibleEnrollments,
      defaultStudentName: result.defaultStudentName,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student: Submits the exact name to appear on the official certificate.
 * Sets status to 'NAME_SUBMITTED'.
 * POST /api/certificates/submit-name
 * POST /api/certificates/confirm-name (alias)
 */
async function submitName(req, res, next) {
  try {
    const { enrollmentId, recipientName, certificateName, certificateId } = req.body;
    const nameToSubmit = certificateName || recipientName;
    if (!nameToSubmit) {
      throw new AppError('Certificate name is required.', 400);
    }

    let targetEnrollmentId = null;
    const potentialId = req.params?.id || certificateId || enrollmentId;

    if (potentialId && String(potentialId).match(/^[0-9a-fA-F]{24}$/)) {
      const cert = await Certificate.findById(potentialId);
      if (cert) {
        if (cert.enrollment) {
          targetEnrollmentId = cert.enrollment;
        } else if (cert.course) {
          const enr = await Enrollment.findOne({ student: req.user._id, course: cert.course });
          if (enr) targetEnrollmentId = enr._id;
        }
      } else {
        const enr = await Enrollment.findOne({ _id: potentialId, student: req.user._id });
        if (enr) {
          targetEnrollmentId = enr._id;
        }
      }
    }

    if (!targetEnrollmentId) {
      // Find the student's first eligible enrollment
      const { eligibleEnrollments } = await certificateService.getMyCertificates(req.user._id);
      if (eligibleEnrollments.length === 0) {
        throw new AppError('No eligible enrollment found for certificate request.', 400);
      }
      targetEnrollmentId = eligibleEnrollments[0].enrollmentId;
    }

    const cert = await certificateService.submitCertificateName(
      req.user._id,
      targetEnrollmentId,
      nameToSubmit
    );

    const feedbackRequired = !cert.feedbackCompleted;
    const message = feedbackRequired
      ? 'Your certificate request has been submitted successfully. Your request has been sent to the Academy Administration for review. Please complete the required course feedback to continue the certificate process. You will be notified when your certificate is ready.'
      : 'Your certificate request has been submitted successfully. Your request has been sent to the Academy Administration for review. You will be notified when your certificate is ready.';

    res.status(201).json({
      success: true,
      message,
      data: cert,
      feedbackRequired,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student & Admin: Get certificate details by ID.
 * GET /api/certificates/:id
 */
async function getCertificateById(req, res, next) {
  try {
    const cert = await Certificate.findById(req.params.id)
      .populate('course', 'title code level certificateType certificationDetails')
      .populate('cohort', 'name startDate endDate')
      .populate('student', 'fullName email registrationNumber')
      .populate('uploadedBy', 'fullName')
      .populate('issuedBy', 'fullName');

    if (!cert) {
      throw new AppError('Certificate not found.', 404);
    }

    const isOwner = req.user && req.user._id.toString() === cert.student._id.toString();
    const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you do not have permission to view this certificate.', 403);
    }

    res.json({
      success: true,
      data: cert,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: List all certificate requests and completion records.
 * GET /api/admin/certificates
 */
async function adminList(req, res, next) {
  try {
    const data = await certificateService.adminListCertificateRequests(req.query);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Get certificate request details.
 * GET /api/admin/certificates/:id
 */
async function adminGet(req, res, next) {
  try {
    const data = await certificateService.adminGetCertificateDetails(req.params.id);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Upload official certificate file.
 * POST /api/admin/certificates/:id/upload
 */
async function adminUpload(req, res, next) {
  try {
    const issueNow = req.body.issueNow === 'true' || req.body.issueNow === true;
    const cert = await certificateService.adminUploadCertificateFile(
      req.params.id,
      req.user,
      req.file,
      issueNow,
      req.body.adminNotes
    );

    res.json({
      success: true,
      message: issueNow
        ? 'Official certificate uploaded and issued successfully.'
        : 'Official certificate uploaded successfully. Marked as under preparation.',
      data: cert,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Mark certificate as ISSUED.
 * POST /api/admin/certificates/:id/issue
 */
async function adminIssue(req, res, next) {
  try {
    const cert = await certificateService.adminIssueCertificate(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Official certificate issued successfully. Notification and email dispatched to student.',
      data: cert,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Update status.
 * PATCH /api/admin/certificates/:id/status
 */
async function adminStatus(req, res, next) {
  try {
    const { status } = req.body;
    const cert = await certificateService.adminUpdateStatus(req.params.id, req.user, status);
    res.json({
      success: true,
      message: `Certificate status updated to ${status}.`,
      data: cert,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Correct certificate recipient name.
 * PATCH /api/admin/certificates/:id/correct-name
 * PATCH /api/certificates/:id/correct-name
 */
async function correctName(req, res, next) {
  try {
    const { recipientName, reason } = req.body;
    const cert = await certificateService.correctCertificateName(
      req.params.id,
      req.user,
      recipientName,
      reason
    );
    res.json({
      success: true,
      message: 'Certificate name corrected successfully.',
      data: cert,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Public: Verification of official certificate credential.
 * GET /api/certificates/verify/:tokenOrId
 */
async function verifyCertificate(req, res, next) {
  try {
    const data = await certificateService.verifyCertificate(req.params.tokenOrId);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Download certificate file safely.
/**
 * Admin: Create certificate record for student.
 * POST /api/admin/certificates/:id/create
 */
async function adminCreate(req, res, next) {
  try {
    const cert = await certificateService.adminCreateCertificate(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Certificate created successfully by administration.',
      data: cert,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Download certificate file safely.
 * GET /api/certificates/:id/download
 */
async function downloadCertificate(req, res, next) {
  try {
    const Evaluation = require('../models/Evaluation');
    const cert = await Certificate.findById(req.params.id).populate('student course');
    if (!cert) {
      throw new AppError('Certificate not found.', 404);
    }

    // Must be student owner or admin
    const isOwner = req.user && req.user._id.toString() === cert.student._id.toString();
    const isAdmin = req.user && ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: you do not have permission to download this certificate.', 403);
    }

    // If student is downloading, enforce mandatory feedback and deadline checks
    if (!isAdmin) {
      const evalDoc = await Evaluation.findOne({
        student: cert.student._id,
        $or: [
          { enrollment: cert.enrollment?._id || cert.enrollment },
          { course: cert.course?._id || cert.course },
        ],
      });

      const isCourseDone = Boolean(evalDoc?.courseFeedbackCompleted || evalDoc?.ratings?.content);
      const isAgencyDone = Boolean(evalDoc?.agencyFeedbackCompleted);
      const isFeedbackDone = isCourseDone && isAgencyDone;

      if (cert.feedbackDeadline && new Date() > new Date(cert.feedbackDeadline) && !isFeedbackDone) {
        throw new AppError(
          'Feedback deadline has passed without required completion. Your certificate cannot be issued or delivered at this time. Please contact Academic Affairs.',
          403
        );
      }

      if (!isCourseDone || !isAgencyDone) {
        throw new AppError(
          'Cannot download certificate: You must complete both Course Feedback and Egyptian Space Agency Feedback before your certificate can be released.',
          403
        );
      }

      if (String(cert.status).toUpperCase() !== 'ISSUED') {
        throw new AppError('Official certificate has not been released by administration yet.', 403);
      }
    }

    if (!cert.fileUrl) {
      throw new AppError('Official certificate file has not been uploaded yet.', 404);
    }

    const relativePath = cert.fileUrl.startsWith('/') ? cert.fileUrl.slice(1) : cert.fileUrl;
    const fullPath = path.join(__dirname, '../../', relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new AppError('Certificate file not found on server.', 404);
    }

    const downloadName = `EGSA_Certificate_${cert.recipientName.replace(/\s+/g, '_')}_${cert.certificateId || 'Official'}${path.extname(fullPath)}`;
    res.download(fullPath, downloadName);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  myCertificates,
  submitName,
  getCertificateById,
  adminList,
  adminGet,
  adminCreate,
  adminUpload,
  adminIssue,
  adminStatus,
  correctName,
  verifyCertificate,
  downloadCertificate,
};
