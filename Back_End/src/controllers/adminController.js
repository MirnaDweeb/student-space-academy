const User = require('../models/User');
const Course = require('../models/Course');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const Invoice = require('../models/Invoice');
const { issueInvoice } = require('../services/paymentService');
const { notify } = require('../services/notificationService');
const {
  sendApplicationAcceptedEmail,
  sendApplicationRejectedEmail,
} = require('../utils/email');
const { AppError } = require('../middleware/error');

async function overview(req, res, next) {
  try {
    const [studentCount, courseCount, applicationCount, enrollmentCount] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Course.countDocuments({}),
      Application.countDocuments({}),
      Enrollment.countDocuments({}),
    ]);

    res.json({
      success: true,
      data: { studentCount, courseCount, applicationCount, enrollmentCount },
    });
  } catch (err) {
    next(err);
  }
}

async function listApplications(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const applications = await Application.find(filter)
      .populate('student', 'fullName email phone registrationNumber')
      .populate('course', 'title level price transportationPrice currency')
      .populate('cohort', 'name startDate endDate')
      .sort({ createdAt: -1 });

    const appIds = applications.map((a) => a._id);
    const [invoices, enrollments] = await Promise.all([
      Invoice.find({ application: { $in: appIds } }),
      Enrollment.find({ application: { $in: appIds } }).populate('paymentReference'),
    ]);

    const invoiceMap = new Map(invoices.map((inv) => [inv.application.toString(), inv]));
    const enrollmentMap = new Map(enrollments.map((enr) => [enr.application.toString(), enr]));

    const enriched = applications.map((app) => {
      const plain = app.toObject();
      plain.invoice = invoiceMap.get(app._id.toString()) || null;
      plain.enrollment = enrollmentMap.get(app._id.toString()) || null;
      return plain;
    });

    res.json({
      success: true,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
}

async function listApplicationsForReview(req, res, next) {
  try {
    const applications = await Application.find({
      status: { $in: ['Manual Review', 'Under Review', 'Submitted'] },
    })
      .populate('student', 'fullName email phone registrationNumber')
      .populate('course', 'title level price transportationPrice currency')
      .populate('cohort', 'name startDate')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: applications });
  } catch (err) {
    next(err);
  }
}

async function acceptApplication(req, res, next) {
  try {
    const { id } = req.params;
    const application = await Application.findById(id)
      .populate('student')
      .populate('course')
      .populate('cohort');

    if (!application) {
      throw new AppError('Application not found.', 404);
    }

    application.status = 'Accepted';
    const note = req.body.note || 'Application accepted by EGSA Academic Committee.';
    application.statusHistory.push({ status: 'Accepted', note, changedAt: new Date() });
    await application.save();

    // Ensure invoice exists for this application
    let invoice = await Invoice.findOne({ application: application._id });
    if (!invoice && application.course) {
      invoice = await issueInvoice({
        student: application.student._id,
        application: application._id,
        course: application.course,
        transportationAmount: 0,
      });
    }

    const basePrice = application.course?.price || 0;
    const transportationPrice = application.course?.transportationPrice != null ? application.course.transportationPrice : 500;
    const paymentDeadline = invoice ? invoice.dueDate : undefined;

    // Send institutional acceptance email (non-blocking)
    try {
      await sendApplicationAcceptedEmail({
        to: application.student.email,
        fullName: application.student.fullName,
        courseTitle: application.course.title,
        courseLevel: application.course.level,
        cohortName: application.cohort ? application.cohort.name : undefined,
        applicationNumber: application.referenceNumber,
        basePrice,
        transportationPrice,
        paymentDeadline,
        preferredLanguage: application.student.preferredLanguage || 'en',
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send acceptance email:', emailErr.message);
    }

    // In-app notification
    try {
      await notify({
        recipient: application.student._id,
        title: 'Application Accepted — Space Academy',
        message: `Congratulations! Your application for ${application.course.title} has been accepted. Please select your training package and proceed to payment.`,
        type: 'success',
        relatedCourse: application.course._id,
        relatedApplication: application._id,
      });
    } catch (notifErr) {
      console.error('[NOTIF ERROR] Failed to create acceptance notification:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Application accepted successfully. Acceptance notification and email dispatched.',
      data: {
        application,
        invoice,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function rejectApplication(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;
    const rejectionReason = reason || note || 'Your application did not meet the enrollment requirements for this cycle.';

    const application = await Application.findById(id)
      .populate('student')
      .populate('course');

    if (!application) {
      throw new AppError('Application not found.', 404);
    }

    application.status = 'Rejected';
    application.rejectionReason = rejectionReason;
    application.statusHistory.push({ status: 'Rejected', note: rejectionReason, changedAt: new Date() });
    await application.save();

    // Mark any pending invoices as Waived
    await Invoice.updateMany(
      { application: application._id, status: { $in: ['Invoice Issued', 'Pending'] } },
      { status: 'Waived' }
    );

    // Send institutional rejection email (non-blocking)
    try {
      await sendApplicationRejectedEmail({
        to: application.student.email,
        fullName: application.student.fullName,
        courseTitle: application.course.title,
        applicationNumber: application.referenceNumber,
        reason: rejectionReason,
        preferredLanguage: application.student.preferredLanguage || 'en',
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send rejection email:', emailErr.message);
    }

    // In-app notification
    try {
      await notify({
        recipient: application.student._id,
        title: 'Application Status Update',
        message: `Update regarding your application for ${application.course.title}: ${rejectionReason}`,
        type: 'warning',
        relatedCourse: application.course._id,
        relatedApplication: application._id,
      });
    } catch (notifErr) {
      console.error('[NOTIF ERROR] Failed to create rejection notification:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Application rejected and notification dispatched.',
      data: application,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  overview,
  listApplications,
  listApplicationsForReview,
  acceptApplication,
  rejectApplication,
};
