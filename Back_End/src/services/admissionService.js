const mongoose = require('mongoose');
const Application = require('../models/Application');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const Invoice = require('../models/Invoice');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { issueInvoice } = require('./paymentService');
const { notify } = require('./notificationService');
const { sendApplicationAcceptedEmail } = require('../utils/email');
const { AppError } = require('../middleware/error');

/**
 * Automatically accepts an eligible application, assigns a cohort,
 * atomically reserves a seat up to cohort capacity (or places on FIFO waitlist if full),
 * and generates/reuses a payable invoice with 72h due date.
 *
 * For free courses (0 EGP / Not Required), confirms application and enrollment directly.
 */
async function autoAcceptAndReserveSeat({
  application,
  studentId,
  courseId,
  cohortId,
  packageType = 'WITHOUT_TRANSPORTATION',
  directEnroll = false,
}) {
  let appDoc = null;

  if (application && application._id) {
    appDoc = application;
  } else if (application && (mongoose.Types.ObjectId.isValid(application) || typeof application === 'string')) {
    appDoc = await Application.findById(application);
  }

  const effectiveStudentId = studentId || appDoc?.student?._id || appDoc?.student;
  const effectiveCourseId = courseId || appDoc?.course?._id || appDoc?.course;

  if (!appDoc && effectiveStudentId && effectiveCourseId) {
    appDoc = await Application.findOne({
      student: effectiveStudentId,
      course: effectiveCourseId,
      status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected'] },
    }).sort({ createdAt: -1 });
  }

  if (!appDoc && effectiveStudentId && effectiveCourseId) {
    appDoc = await Application.create({
      student: effectiveStudentId,
      course: effectiveCourseId,
      cohort: cohortId,
      status: 'Submitted',
      eligibilityStatus: 'Eligible',
      submittedAt: new Date(),
    });
  }

  if (!appDoc) {
    throw new AppError('Application not found or could not be initialized.', 404);
  }

  // Resolve Course
  let courseDoc = null;
  const targetCourseId = appDoc.course?._id || appDoc.course || effectiveCourseId;
  if (targetCourseId) {
    courseDoc = await Course.findById(targetCourseId);
  }
  if (!courseDoc) {
    throw new AppError('Course not found.', 404);
  }

  const isDirectPermitted = courseDoc.directEnrollmentPermitted !== false;

  // Preserve existing readiness and eligibility rules UNLESS direct enrollment applies
  if (appDoc.status === 'Foundation Recommended' || appDoc.eligibilityStatus === 'Not Eligible') {
    if (directEnroll && isDirectPermitted) {
      appDoc.status = 'Submitted';
      appDoc.eligibilityStatus = 'Eligible';
      appDoc.statusHistory = appDoc.statusHistory || [];
      appDoc.statusHistory.push({
        status: 'Submitted',
        note: 'Student opted for direct enrollment, proceeding with seat reservation.',
        changedAt: new Date(),
      });
      if (typeof appDoc.save === 'function') await appDoc.save();
    } else {
      return {
        success: false,
        reason: 'FOUNDATION_REQUIRED',
        application: appDoc,
        message: 'Foundational prerequisite requirements must be satisfied before acceptance.',
      };
    }
  }

  if (appDoc.status === 'Manual Review' || appDoc.eligibilityStatus === 'In Progress') {
    return {
      success: false,
      reason: 'MANUAL_REVIEW',
      application: appDoc,
      message: 'Application requires manual review by admissions committee.',
    };
  }

  if (appDoc.eligibilityStatus !== 'Eligible') {
    if (directEnroll && isDirectPermitted) {
      appDoc.eligibilityStatus = 'Eligible';
      if (typeof appDoc.save === 'function') await appDoc.save();
    } else {
      return {
        success: false,
        reason: 'NOT_ELIGIBLE',
        application: appDoc,
        message: 'Student eligibility has not been satisfied.',
      };
    }
  }

  // Resolve Cohort
  let cohortDoc = null;
  let targetCohortId = cohortId || appDoc.cohort?._id || appDoc.cohort;
  if (targetCohortId) {
    cohortDoc = await Cohort.findById(targetCohortId);
  }
  if (!cohortDoc) {
    cohortDoc = await Cohort.findOne({ course: courseDoc._id, status: 'Scheduled' }).sort({ startDate: 1 });
    if (cohortDoc) {
      appDoc.cohort = cohortDoc._id;
    }
  }

  // Determine if application already holds an accepted seat reservation
  const isAlreadyHoldingSeat = ['Accepted', 'Eligible - Payment Pending', 'Confirmed'].includes(appDoc.status);

  // If not already holding a seat, perform atomic seat reservation
  if (!isAlreadyHoldingSeat && cohortDoc) {
    // 1. Check if cohort is already at maximum capacity
    if (cohortDoc.capacity != null && cohortDoc.seatsTaken >= cohortDoc.capacity) {
      appDoc.status = 'Waitlisted';
      const waitlistCount = await Application.countDocuments({
        cohort: cohortDoc._id,
        status: 'Waitlisted',
      });
      appDoc.waitlistPosition = waitlistCount + 1;
      appDoc.statusHistory = appDoc.statusHistory || [];
      appDoc.statusHistory.push({
        status: 'Waitlisted',
        note: `Cohort ${cohortDoc.name} has reached maximum capacity (${cohortDoc.capacity}/${cohortDoc.capacity}). Automatically placed on waitlist at position #${appDoc.waitlistPosition}.`,
        changedAt: new Date(),
      });
      if (typeof appDoc.save === 'function') await appDoc.save();

      try {
        await notify({
          recipient: appDoc.student?._id || appDoc.student,
          title: 'Application Waitlisted',
          message: `Cohort ${cohortDoc.name} is full. You have been placed on the waitlist at position #${appDoc.waitlistPosition}.`,
          type: 'info',
          relatedCourse: courseDoc._id,
          relatedApplication: appDoc._id,
        });
      } catch (_) {}

      return {
        success: true,
        waitlisted: true,
        waitlistPosition: appDoc.waitlistPosition,
        application: appDoc,
        cohort: cohortDoc,
      };
    }

    // 2. Atomically increment seatsTaken if seatsTaken < capacity
    const reserved = await Cohort.findOneAndUpdate(
      { _id: cohortDoc._id, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
      { $inc: { seatsTaken: 1 } },
      { new: true }
    );

    if (!reserved && cohortDoc.capacity != null) {
      // Concurrent race condition: cohort filled between check and update
      appDoc.status = 'Waitlisted';
      const waitlistCount = await Application.countDocuments({
        cohort: cohortDoc._id,
        status: 'Waitlisted',
      });
      appDoc.waitlistPosition = waitlistCount + 1;
      appDoc.statusHistory = appDoc.statusHistory || [];
      appDoc.statusHistory.push({
        status: 'Waitlisted',
        note: `Cohort ${cohortDoc.name} filled concurrently. Automatically placed on waitlist at position #${appDoc.waitlistPosition}.`,
        changedAt: new Date(),
      });
      if (typeof appDoc.save === 'function') await appDoc.save();

      return {
        success: true,
        waitlisted: true,
        waitlistPosition: appDoc.waitlistPosition,
        application: appDoc,
        cohort: cohortDoc,
      };
    }

    // Reservation succeeded: update cohortDoc reference
    cohortDoc = reserved || cohortDoc;
  }

  // Transition Application to Accepted
  appDoc.status = 'Accepted';
  appDoc.eligibilityStatus = 'Eligible';
  appDoc.waitlistPosition = undefined;
  appDoc.statusHistory = appDoc.statusHistory || [];
  appDoc.statusHistory.push({
    status: 'Accepted',
    note: 'Application automatically accepted and seat reserved upon verified eligibility.',
    changedAt: new Date(),
  });
  if (typeof appDoc.save === 'function') await appDoc.save();

  // Create or reuse Invoice
  let invoice = null;
  try {
    invoice = await Invoice.findOne({ application: appDoc._id });
  } catch (_) {
    invoice = null;
  }
  const finalPackageType = packageType || appDoc.selectedPackage || 'WITHOUT_TRANSPORTATION';

  if (!invoice && courseDoc) {
    invoice = await issueInvoice({
      student: appDoc.student?._id || appDoc.student,
      application: appDoc._id,
      course: courseDoc,
      cohort: appDoc.cohort,
      packageType: finalPackageType,
    });
  }

  // Free course handling: 0 EGP tuition auto-enrolls
  const isFreeCourse = (courseDoc.price === 0 || invoice?.status === 'Not Required') && Number(invoice?.amount || 0) === 0;
  if (isFreeCourse) {
    let enrollment = null;
    try {
      enrollment = await Enrollment.findOne({ application: appDoc._id });
    } catch (_) {
      enrollment = null;
    }
    if (!enrollment) {
      enrollment = await Enrollment.create({
        student: appDoc.student?._id || appDoc.student,
        course: courseDoc._id,
        cohort: appDoc.cohort,
        application: appDoc._id,
        invoice: invoice?._id,
        status: 'Confirmed',
        packageType: finalPackageType,
        enrolledAt: new Date(),
      });
    }
    appDoc.status = 'Confirmed';
    appDoc.enrollment = enrollment?._id;
    if (typeof appDoc.save === 'function') await appDoc.save();
  }

  // Institutional email and in-app notification (non-blocking)
  const studentOwnerId = appDoc.student?._id || appDoc.student;
  try {
    let studentUser = null;
    try {
      studentUser = await User.findById(studentOwnerId);
    } catch (_) {
      studentUser = null;
    }
    if (studentUser && studentUser.email) {
      await sendApplicationAcceptedEmail({
        to: studentUser.email,
        fullName: studentUser.fullName,
        courseTitle: courseDoc.title,
        courseLevel: courseDoc.level,
        cohortName: cohortDoc ? cohortDoc.name : undefined,
        applicationNumber: appDoc.referenceNumber,
        basePrice: courseDoc.price || 0,
        transportationPrice: courseDoc.transportationPrice || 0,
        paymentDeadline: invoice?.dueDate,
        preferredLanguage: studentUser.preferredLanguage || 'en',
      });
    }
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to dispatch auto-acceptance email:', err.message);
  }

  try {
    await notify({
      recipient: studentOwnerId,
      title: 'Application Accepted — Seat Reserved',
      message: `Congratulations! Your application for ${courseDoc.title} has been accepted and a seat reserved. You can now complete your tuition payment.`,
      type: 'success',
      relatedCourse: courseDoc._id,
      relatedApplication: appDoc._id,
    });
  } catch (_) {}

  return {
    success: true,
    waitlisted: false,
    application: appDoc,
    cohort: cohortDoc,
    invoice,
  };
}

module.exports = {
  autoAcceptAndReserveSeat,
};
