const Application = require('../models/Application');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const StudentProfile = require('../models/StudentProfile');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const Invoice = require('../models/Invoice');
const Enrollment = require('../models/Enrollment');
const { checkCourseFit } = require('../services/eligibilityService');
const { issueInvoice, processExpiredInvoices, releaseSeatAndPromoteWaitlist } = require('../services/paymentService');
const { notify } = require('../services/notificationService');
const { sendApplicationSubmittedEmail } = require('../utils/email');
const { AppError } = require('../middleware/error');

async function createApplication(req, res, next) {
  try {
    const { courseId, readinessAttemptId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);
    if (course.price == null) {
      throw new AppError('This course does not have published pricing yet, so applications are not open.', 400);
    }

    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) throw new AppError('Complete your profile first.', 400);

    const fit = await checkCourseFit(profile, course);
    if (fit.result === 'Foundation Required') {
      const application = await Application.create({
        student: req.user._id,
        course: course._id,
        status: 'Foundation Recommended',
        eligibilityStatus: 'Not Eligible',
        statusHistory: [{ status: 'Foundation Recommended', note: fit.reasons[0]?.message }],
        fitResultSnapshot: fit,
        submittedAt: new Date(),
      });
      return res.status(201).json({ success: true, data: application, message: 'Foundation course required before applying.' });
    }

    let readinessAttempt = null;
    if (readinessAttemptId) {
      readinessAttempt = await ReadinessAttempt.findOne({
        _id: readinessAttemptId,
        student: req.user._id,
        course: course._id,
        status: 'Submitted',
      });
    }

    // Also look for any previous submitted readiness attempt for this student & course if not passed in body
    if (!readinessAttempt) {
      readinessAttempt = await ReadinessAttempt.findOne({
        student: req.user._id,
        course: course._id,
        status: 'Submitted',
      }).sort({ createdAt: -1 });
    }

    let cohort = await Cohort.findOne({ course: course._id, status: 'Scheduled' }).sort({ startDate: 1 });

    // Determine initial status and eligibilityStatus
    let eligibilityStatus = 'Not Started';
    let status = 'Submitted';

    if (readinessAttempt) {
      if (readinessAttempt.outcome === 'FOUNDATION_REQUIRED') {
        eligibilityStatus = 'Not Eligible';
        status = 'Foundation Recommended';
      } else if (['READY', 'CONDITIONALLY_READY'].includes(readinessAttempt.outcome)) {
        eligibilityStatus = 'Eligible';
        status = 'Submitted';
      } else {
        eligibilityStatus = 'In Progress';
        status = 'Submitted';
      }
    } else {
      const hasQuestions = await ReadinessQuestion.exists({ course: course._id });
      if (hasQuestions) {
        eligibilityStatus = 'Not Started';
        status = 'Submitted';
      } else {
        eligibilityStatus = 'Eligible';
        status = 'Submitted';
      }
    }

    const application = await Application.create({
      student: req.user._id,
      course: course._id,
      cohort: cohort ? cohort._id : undefined,
      readinessAttempt: readinessAttempt ? readinessAttempt._id : undefined,
      status,
      eligibilityStatus,
      statusHistory: [{ status, note: `Application registered with status ${status}.` }],
      fitResultSnapshot: fit,
      submittedAt: new Date(),
    });

    // Dispatch institutional application acknowledgement email
    try {
      await sendApplicationSubmittedEmail({
        to: req.user.email,
        fullName: req.user.fullName,
        courseTitle: course.title,
        applicationNumber: application.referenceNumber,
        preferredLanguage: req.user.preferredLanguage || 'en',
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send application submitted email:', emailErr.message);
    }

    await notify({
      recipient: req.user._id,
      title: 'Application Submitted',
      message: 'Your application has been received and is under processing.',
      type: 'info',
      relatedCourse: course._id,
      relatedApplication: application._id,
    });

    res.status(201).json({
      success: true,
      data: application,
      message: 'Application submitted successfully. Your application has been received and is under processing.',
    });
  } catch (err) {
    next(err);
  }
}

async function myApplications(req, res, next) {
  try {
    await processExpiredInvoices();
    const applications = await Application.find({ student: req.user._id })
      .populate('course', 'title level price transportationPrice currency startDate')
      .populate('cohort')
      .populate('readinessAttempt')
      .sort({ createdAt: -1 });

    const appIds = applications.map((a) => a._id);
    const [invoices, enrollments] = await Promise.all([
      Invoice.find({ application: { $in: appIds } }),
      Enrollment.find({ application: { $in: appIds } }),
    ]);

    const invMap = new Map(invoices.map((inv) => [inv.application?.toString(), inv]));
    const enrMap = new Map(enrollments.map((enr) => [enr.application?.toString(), enr]));

    const enriched = applications.map((app) => {
      const plain = app.toObject();
      plain.invoice = invMap.get(app._id.toString()) || null;
      plain.enrollment = enrMap.get(app._id.toString()) || null;
      return plain;
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

async function getApplication(req, res, next) {
  try {
    const application = await Application.findOne({ _id: req.params.id, student: req.user._id })
      .populate('course')
      .populate('cohort')
      .populate('readinessAttempt');
    if (!application) throw new AppError('Application not found.', 404);

    const [invoice, enrollment] = await Promise.all([
      Invoice.findOne({ application: application._id, student: req.user._id }),
      Enrollment.findOne({ application: application._id, student: req.user._id }),
    ]);

    res.json({
      success: true,
      data: {
        ...application.toObject(),
        invoice: invoice || null,
        enrollment: enrollment || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function cancelApplication(req, res, next) {
  try {
    const application = await Application.findOne({ _id: req.params.id, student: req.user._id });
    if (!application) throw new AppError('Application not found.', 404);

    if (['Cancelled', 'Withdrawn', 'Rejected'].includes(application.status)) {
      throw new AppError(`Application is already ${application.status}.`, 400);
    }

    const wasHoldingSeat = ['Accepted', 'Eligible - Payment Pending'].includes(application.status);
    const prevStatus = application.status;
    const cohortId = application.cohort;

    application.status = 'Cancelled';
    application.waitlistPosition = undefined;
    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({
      status: 'Cancelled',
      note: 'Application cancelled by student.',
      changedAt: new Date(),
    });
    await application.save();

    // Void or cancel any pending/issued invoice for this application
    await Invoice.updateMany(
      { application: application._id, status: { $in: ['Invoice Issued', 'Pending', 'Payment Initiated'] } },
      { $set: { status: 'Cancelled' } }
    );

    // If waitlisted, re-index remaining waitlist positions
    if (prevStatus === 'Waitlisted' && cohortId) {
      const remainingWaitlisted = await Application.find({
        cohort: cohortId,
        status: 'Waitlisted',
      }).sort({ waitlistPosition: 1, createdAt: 1 });

      for (let i = 0; i < remainingWaitlisted.length; i++) {
        remainingWaitlisted[i].waitlistPosition = i + 1;
        await remainingWaitlisted[i].save();
      }
    }

    // If holding a seat, release and promote waitlist
    let promotionResult = { promoted: null };
    if (wasHoldingSeat && cohortId) {
      promotionResult = await releaseSeatAndPromoteWaitlist(cohortId);
    }

    res.json({
      success: true,
      message: 'Application cancelled successfully.',
      data: application,
      promotedWaitlist: !!promotionResult.promoted,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createApplication, myApplications, getApplication, cancelApplication };
