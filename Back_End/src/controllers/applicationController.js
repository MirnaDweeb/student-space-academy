const Application = require('../models/Application');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const StudentProfile = require('../models/StudentProfile');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const Invoice = require('../models/Invoice');
const { checkCourseFit } = require('../services/eligibilityService');
const { issueInvoice } = require('../services/paymentService');
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
        statusHistory: [{ status: 'Foundation Recommended', note: fit.reasons[0]?.message }],
        fitResultSnapshot: fit,
      });
      return res.status(201).json({ success: true, data: application, message: 'Foundation course required before applying.' });
    }

    let readinessAttempt = null;
    if (readinessAttemptId) {
      readinessAttempt = await ReadinessAttempt.findOne({ _id: readinessAttemptId, student: req.user._id, course: course._id, status: 'Submitted' });
    }

    let cohort = await Cohort.findOne({ course: course._id, status: 'Scheduled' }).sort({ startDate: 1 });
    let status = readinessAttempt ? undefined : 'Readiness Required'; // placeholder, set below
    let seatReserved = false;

    if (!readinessAttempt) {
      const hasQuestions = await ReadinessQuestion.exists({ course: course._id });
      status = hasQuestions ? 'Readiness Required' : 'Under Review';
    } else if (readinessAttempt.outcome === 'FOUNDATION_REQUIRED') {
      status = 'Foundation Recommended';
    } else if (readinessAttempt.outcome === 'MANUAL_REVIEW') {
      status = 'Under Review';
    } else if (cohort) {
      // Atomic, race-safe seat reservation: only succeeds if a seat is still
      // available at the moment of the DB write. Two concurrent requests for
      // the last seat cannot both succeed - the second one gets seatReserved=false.
      const reserved = await Cohort.findOneAndUpdate(
        { _id: cohort._id, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
        { $inc: { seatsTaken: 1 } },
        { new: true }
      );
      if (reserved) {
        cohort = reserved;
        seatReserved = true;
        status = 'Eligible - Payment Pending';
      } else {
        status = 'Waitlisted';
      }
    } else {
      // No cohort/capacity data defined for this course yet (MISSING BUSINESS DATA);
      // proceed without seat enforcement until real cohort/capacity info is provided.
      status = 'Eligible - Payment Pending';
    }

    const application = await Application.create({
      student: req.user._id,
      course: course._id,
      cohort: cohort ? cohort._id : undefined,
      readinessAttempt: readinessAttempt ? readinessAttempt._id : undefined,
      status,
      statusHistory: [{ status, note: `Application registered with status ${status}.` }],
      fitResultSnapshot: fit,
      submittedAt: new Date(),
    });

    if (status === 'Eligible - Payment Pending') {
      await issueInvoice({ student: req.user._id, application: application._id, course });
    } else if (seatReserved && cohort) {
      // Defensive rollback: application ended up in a non-payable status
      // (shouldn't normally happen given the branching above) - release the
      // seat we just atomically reserved rather than leaking it.
      await Cohort.findByIdAndUpdate(cohort._id, { $inc: { seatsTaken: -1 } });
    }

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
      message: `Your application for ${course.title} is now: ${status}.`,
      type: 'info',
      relatedCourse: course._id,
      relatedApplication: application._id,
    });

    res.status(201).json({
      success: true,
      data: application,
      message: status === 'Under Review'
        ? 'Application submitted successfully. Your application is currently under review.'
        : `Application created with status: ${status}`,
    });
  } catch (err) {
    next(err);
  }
}

async function myApplications(req, res, next) {
  try {
    const applications = await Application.find({ student: req.user._id })
      .populate('course', 'title level price transportationPrice currency startDate')
      .populate('cohort')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: applications });
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

    const invoice = await Invoice.findOne({ application: application._id, student: req.user._id });

    res.json({
      success: true,
      data: {
        ...application.toObject(),
        invoice: invoice || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createApplication, myApplications, getApplication };
