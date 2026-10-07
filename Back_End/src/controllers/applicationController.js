const Application = require('../models/Application');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const StudentProfile = require('../models/StudentProfile');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const Invoice = require('../models/Invoice');
const Enrollment = require('../models/Enrollment');
const { checkCourseFit } = require('../services/eligibilityService');
const { autoAcceptAndReserveSeat } = require('../services/admissionService');
const { issueInvoice, processExpiredInvoices, releaseSeatAndPromoteWaitlist } = require('../services/paymentService');
const { notify } = require('../services/notificationService');
const { sendApplicationSubmittedEmail } = require('../utils/email');
const { AppError } = require('../middleware/error');

async function createApplication(req, res, next) {
  try {
    const { courseId, readinessAttemptId, directEnroll } = req.body;
    const isDirectEnroll = directEnroll === true;
    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);
    if (course.price == null) {
      throw new AppError('This course does not have published pricing yet, so applications are not open.', 400);
    }

    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) throw new AppError('Complete your profile first.', 400);

    // Prevent duplicate active applications for the same student and course
    let existingQuery = Application.findOne({
      student: req.user._id,
      course: course._id,
      status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected'] },
    });
    if (existingQuery && typeof existingQuery.sort === 'function') {
      existingQuery = existingQuery.sort({ createdAt: -1 });
    }
    let existingActiveApp = await existingQuery;

    if (existingActiveApp) {
      if (readinessAttemptId && !existingActiveApp.readinessAttempt) {
        existingActiveApp.readinessAttempt = readinessAttemptId;
        await existingActiveApp.save();
      }

      // If student opts for direct enrollment, ensure eligibility is activated
      if (isDirectEnroll && (course.directEnrollmentPermitted !== false || existingActiveApp.status !== 'Foundation Recommended') && existingActiveApp.status !== 'Manual Review') {
        existingActiveApp.eligibilityStatus = 'Eligible';
        if (existingActiveApp.status === 'Foundation Recommended' && course.directEnrollmentPermitted !== false) {
          existingActiveApp.status = 'Submitted';
        }
        await existingActiveApp.save();
      }

      // Self-heal eligible application if pending review or opted for direct enrollment
      let admissionRes = null;
      if (existingActiveApp.eligibilityStatus === 'Eligible' && ['Under Review', 'Submitted', 'Draft'].includes(existingActiveApp.status)) {
        admissionRes = await autoAcceptAndReserveSeat({ application: existingActiveApp, directEnroll: isDirectEnroll });
        if (admissionRes?.application) {
          existingActiveApp = admissionRes.application;
        }
      }

      // Retrieve or attach active invoice
      let invoice = admissionRes?.invoice || null;
      if (!invoice && ['Accepted', 'Eligible - Payment Pending'].includes(existingActiveApp.status)) {
        invoice = await Invoice.findOne({ application: existingActiveApp._id, status: { $ne: 'Cancelled' } });
      }

      return res.status(200).json({
        success: true,
        data: existingActiveApp,
        invoice,
        message: 'Active application already exists for this course.',
      });
    }

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

    if (fit.result === 'Manual Review') {
      const application = await Application.create({
        student: req.user._id,
        course: course._id,
        status: 'Manual Review',
        eligibilityStatus: 'In Progress',
        statusHistory: [{ status: 'Manual Review', note: fit.reasons[0]?.message || 'Admissions committee manual review required.' }],
        fitResultSnapshot: fit,
        submittedAt: new Date(),
      });
      return res.status(201).json({ success: true, data: application, message: 'Application requires manual review by admissions committee.' });
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
      if (['FOUNDATION_REQUIRED', 'FOUNDATION_RECOMMENDED'].includes(readinessAttempt.outcome)) {
        if (isDirectEnroll || course.directEnrollmentPermitted === true) {
          eligibilityStatus = 'Eligible';
          status = isDirectEnroll ? 'Submitted' : 'Foundation Recommended';
        } else {
          eligibilityStatus = 'Not Eligible';
          status = 'Foundation Recommended';
        }
      } else if (['READY', 'CONDITIONALLY_READY', 'ELIGIBLE'].includes(readinessAttempt.outcome)) {
        eligibilityStatus = 'Eligible';
        status = 'Submitted';
      } else {
        eligibilityStatus = 'In Progress';
        status = 'Manual Review';
      }
    } else {
      const hasQuestions = await ReadinessQuestion.exists({ course: course._id });
      if (isDirectEnroll || !hasQuestions || course.directEnrollmentPermitted === true) {
        // Direct enrollment: assessment is optional!
        eligibilityStatus = 'Eligible';
        status = 'Submitted';
      } else {
        eligibilityStatus = 'Not Started';
        status = 'Submitted';
      }
    }

    let application = await Application.create({
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

    // Always dispatch institutional application acknowledgement email upon registration
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

    // Direct Automatic Acceptance, Atomic Seat Reservation & Invoice Generation
    let invoice = null;
    if (eligibilityStatus === 'Eligible') {
      const admissionRes = await autoAcceptAndReserveSeat({
        application,
        studentId: req.user._id,
        courseId: course._id,
        cohortId: cohort ? cohort._id : undefined,
      });
      if (admissionRes?.application) {
        application = admissionRes.application;
      }
      invoice = admissionRes?.invoice || null;
      if (!invoice && ['Accepted', 'Eligible - Payment Pending'].includes(application.status)) {
        invoice = await Invoice.findOne({ application: application._id, status: { $ne: 'Cancelled' } });
      }
    } else {
      await notify({
        recipient: req.user._id,
        title: 'Application Submitted',
        message: 'Your application has been received and is under processing.',
        type: 'info',
        relatedCourse: course._id,
        relatedApplication: application._id,
      });
    }

    res.status(201).json({
      success: true,
      data: application,
      invoice,
      waitlisted: application.status === 'Waitlisted',
      waitlistPosition: application.waitlistPosition,
      message: application.status === 'Accepted'
        ? 'Application automatically accepted and seat reserved. Payment is now available.'
        : 'Application submitted successfully. Your application has been received and is under processing.',
    });
  } catch (err) {
    next(err);
  }
}

async function myApplications(req, res, next) {
  try {
    await processExpiredInvoices();
    const rawApplications = await Application.find({ student: req.user._id })
      .populate('course', 'title level price transportationPrice currency startDate')
      .populate('cohort')
      .populate('readinessAttempt')
      .sort({ createdAt: -1 });

    // Self-heal eligible applications previously stuck in Under Review / Submitted
    const applications = [];
    for (const app of rawApplications) {
      if (app.eligibilityStatus === 'Eligible' && ['Under Review', 'Submitted'].includes(app.status)) {
        const healed = await autoAcceptAndReserveSeat({ application: app });
        applications.push(healed?.application || app);
      } else {
        applications.push(app);
      }
    }

    const appIds = applications.map((a) => a._id);
    const [invoices, enrollments] = await Promise.all([
      Invoice.find({ application: { $in: appIds } }),
      Enrollment.find({ application: { $in: appIds } }),
    ]);

    const invMap = new Map(invoices.map((inv) => [inv.application?.toString(), inv]));
    const enrMap = new Map(enrollments.map((enr) => [enr.application?.toString(), enr]));

    const enriched = applications.map((app) => {
      const plain = typeof app.toObject === 'function' ? app.toObject() : app;
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
    let application = await Application.findOne({ _id: req.params.id, student: req.user._id })
      .populate('course')
      .populate('cohort')
      .populate('readinessAttempt');
    if (!application) throw new AppError('Application not found.', 404);

    // Self-heal eligible application stuck in Under Review / Submitted
    if (application.eligibilityStatus === 'Eligible' && ['Under Review', 'Submitted'].includes(application.status)) {
      const healed = await autoAcceptAndReserveSeat({ application });
      if (healed?.application) {
        application = healed.application;
      }
    }

    // Attach or heal fitResultSnapshot if missing
    if (!application.fitResultSnapshot) {
      try {
        const profile = await StudentProfile.findOne({ user: req.user._id });
        if (profile && application.course) {
          const fit = await checkCourseFit(profile, application.course);
          application.fitResultSnapshot = fit;
          if (application.course?.directEnrollmentPermitted !== false && fit?.result === 'Eligible' && application.eligibilityStatus === 'Not Eligible') {
            application.eligibilityStatus = 'Eligible';
          }
          await application.save();
        }
      } catch (_) {}
    }

    const [invoice, enrollment] = await Promise.all([
      Invoice.findOne({ application: application._id, student: req.user._id }),
      Enrollment.findOne({ application: application._id, student: req.user._id }),
    ]);

    res.json({
      success: true,
      data: {
        ...(typeof application.toObject === 'function' ? application.toObject() : application),
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

async function directEnrollApplication(req, res, next) {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      student: req.user._id,
    }).populate('course');

    if (!application) throw new AppError('Application not found.', 404);

    const course = application.course;
    if (!course) throw new AppError('Course not found.', 404);

    if (course.directEnrollmentPermitted === false) {
      throw new AppError('Direct enrollment is not permitted for this program. Mandatory readiness completion required.', 400);
    }

    application.eligibilityStatus = 'Eligible';
    if (['Foundation Recommended', 'Draft', 'Submitted', 'Under Review'].includes(application.status)) {
      application.status = 'Submitted';
    }
    await application.save();

    const admissionRes = await autoAcceptAndReserveSeat({
      application,
      studentId: req.user._id,
      courseId: course._id,
      directEnroll: true,
      packageType: req.body?.packageType || application.selectedPackage || 'WITHOUT_TRANSPORTATION',
    });

    res.json({
      success: true,
      data: admissionRes?.application || application,
      invoice: admissionRes?.invoice || null,
      message: 'Direct enrollment processed successfully. Seat reserved.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createApplication,
  myApplications,
  getApplication,
  cancelApplication,
  directEnrollApplication,
};
