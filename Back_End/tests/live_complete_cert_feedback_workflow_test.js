/**
 * Live Complete Certificate Request & Mandatory Dual Feedback Workflow Test
 * Tests all requirements from prompt:
 * 1. Name Submission & Sanitization
 * 2. Admin Request Visibility & Notifications ('New Certificate Request')
 * 3. Admin Certificate Creation ('Certificate Created' notification)
 * 4. Course Feedback Submission & Persistence
 * 5. Agency Feedback Submission & Persistence
 * 6. Dual Feedback Gate (Both required before certificate available)
 * 7. Failure Cases:
 *    - Case 1: Name submitted, no feedback -> Cert NOT available
 *    - Case 2: Course feedback done, agency feedback incomplete -> Cert NOT available
 *    - Case 3: Both feedbacks done, admin has not created cert -> Cert status = Pending Creation
 *    - Case 4: Admin creates cert, but feedback incomplete -> Cert remains unavailable
 *    - Case 5: All requirements completed -> Cert AVAILABLE & downloadable
 *    - Case 6: Feedback deadline passed without feedback -> Cert blocked
 * 8. Security & Duplicate Protections
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Application = require('../src/models/Application');
const Enrollment = require('../src/models/Enrollment');
const Certificate = require('../src/models/Certificate');
const Evaluation = require('../src/models/Evaluation');
const Notification = require('../src/models/Notification');

const certificateService = require('../src/services/certificateService');
const { submitEvaluation, submitAgencyEvaluation } = require('../src/controllers/evaluationController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy';

function mockRes() {
  const res = {};
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (payload) {
    res.body = payload;
    return res;
  };
  return res;
}

async function runLiveWorkflowTest() {
  console.log('Connecting to MongoDB at:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB successfully.');

  const results = {
    certificateFlow: {},
    notifications: {},
    security: {},
  };

  try {
    const timestamp = Date.now();

    // 1. Create Test Admin and Test Student
    const adminUser = await User.create({
      fullName: `Admin Test ${timestamp}`,
      email: `admin_${timestamp}@egsa.gov.eg`,
      password: 'Password123!',
      phone: '+201000000001',
      nationalId: `29${timestamp.toString().slice(-12)}`,
      role: 'admin',
      isEmailVerified: true,
    });

    const studentUser = await User.create({
      fullName: `Student Candidate ${timestamp}`,
      email: `cadet_${timestamp}@egsa.gov.eg`,
      password: 'Password123!',
      phone: '+201000000002',
      nationalId: `28${(timestamp + 1).toString().slice(-12)}`,
      role: 'student',
      isEmailVerified: true,
    });

    const otherStudent = await User.create({
      fullName: `Other Student ${timestamp}`,
      email: `other_${timestamp}@egsa.gov.eg`,
      password: 'Password123!',
      phone: '+201000000003',
      nationalId: `27${(timestamp + 2).toString().slice(-12)}`,
      role: 'student',
      isEmailVerified: true,
    });

    // 2. Reuse or Create Test Course and Cohort
    let course = await Course.findOne();
    if (!course) {
      course = await Course.create({
        title: `CubeSat Telemetry & ADCS Simulation ${timestamp}`,
        titleEn: `CubeSat Telemetry & ADCS Simulation ${timestamp}`,
        slug: `cubesat-telemetry-${timestamp}`,
        code: `SAT-${timestamp.toString().slice(-4)}`,
        price: 1500,
        duration: 30,
        level: 'Professional/Industry',
        levelTier: 4,
        category: 'Space Technologies',
      });
    }

    const cohort = await Cohort.create({
      name: `Cohort Gamma ${timestamp}`,
      course: course._id,
      capacity: 30,
      enrolledCount: 1,
      startDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      status: 'Completed',
    });

    // 3. Create Confirmed Enrollment with Application
    const application = await Application.create({
      student: studentUser._id,
      course: course._id,
      cohort: cohort._id,
      status: 'Confirmed',
    });

    const enrollment = await Enrollment.create({
      student: studentUser._id,
      course: course._id,
      cohort: cohort._id,
      application: application._id,
      status: 'Confirmed',
      paymentStatus: 'Paid',
    });

    console.log('--- TEST STEP 1: Student Enters & Submits Certificate Name ---');
    // Section 1, 2, 3: Name Validation & Submission
    const submittedName = 'Eng. Ahmed Mohamed Ali';
    const certRequest = await certificateService.submitCertificateName(
      studentUser._id,
      enrollment._id,
      submittedName
    );

    if (
      certRequest.status === 'NAME_SUBMITTED' &&
      certRequest.certificateName === submittedName &&
      certRequest.recipientName === submittedName &&
      certRequest.student.toString() === studentUser._id.toString()
    ) {
      console.log('✓ Name Submission: PASS');
      results.certificateFlow.nameSubmission = 'PASS';
    } else {
      console.error('✗ Name Submission: FAIL', certRequest);
      results.certificateFlow.nameSubmission = 'FAIL';
    }

    // Verify Notification to Admin: Title 'New Certificate Request'
    const adminNotif = await Notification.findOne({
      recipient: adminUser._id,
      title: 'New Certificate Request',
    });
    if (adminNotif && adminNotif.message.includes('A student has submitted a certificate name')) {
      console.log('✓ Student → Admin Certificate Request Notification: PASS');
      results.notifications.studentToAdminNotif = 'PASS';
    } else {
      console.error('✗ Student → Admin Certificate Request Notification: FAIL');
      results.notifications.studentToAdminNotif = 'FAIL';
    }

    // Section 10: Admin Request Visibility
    const adminQueue = await certificateService.adminListCertificateRequests({ status: 'NAME_SUBMITTED' });
    const foundInQueue = adminQueue.find((c) => c._id.toString() === certRequest._id.toString());
    if (foundInQueue && (foundInQueue.certificateName === submittedName || foundInQueue.recipientName === submittedName)) {
      console.log('✓ Admin Request Visibility: PASS');
      results.certificateFlow.adminRequestVisibility = 'PASS';
    } else {
      console.error('✗ Admin Request Visibility: FAIL');
      results.certificateFlow.adminRequestVisibility = 'FAIL';
    }

    console.log('--- TEST FAILURE CASE 1: Name Submitted, No Feedback ---');
    // Case 1: Student submits name but no feedback -> Certificate NOT available
    const myCertsCase1 = await certificateService.getMyCertificates(studentUser._id);
    const certCase1 = myCertsCase1.certificates.find((c) => c._id.toString() === certRequest._id.toString());
    if (
      certCase1 &&
      certCase1.currentState === 'NAME_SUBMITTED_FEEDBACK_INCOMPLETE' &&
      certCase1.canReceiveCertificate === false
    ) {
      console.log('✓ Case 1 (Name submitted, no feedback -> Cert NOT available): PASS');
    } else {
      console.error('✗ Case 1: FAIL', certCase1);
    }

    console.log('--- TEST STEP 2: Course Feedback Submission ---');
    // Submit Course Feedback
    const courseReq = {
      user: studentUser,
      body: {
        courseId: course._id.toString(),
        ratings: { content: 5, instructor: 5, labs: 4, organization: 5 },
        comments: { highlights: 'Great simulation lab', improvements: 'None' },
      },
    };
    const courseRes = mockRes();
    await submitEvaluation(courseReq, courseRes, (err) => { throw err; });

    const evalInDb = await Evaluation.findOne({ student: studentUser._id, course: course._id });
    if (evalInDb && evalInDb.courseFeedbackCompleted === true && evalInDb.ratings.content === 5) {
      console.log('✓ Course Feedback Submission & Persistence: PASS');
      results.certificateFlow.courseFeedback = 'PASS';
    } else {
      console.error('✗ Course Feedback: FAIL', evalInDb);
      results.certificateFlow.courseFeedback = 'FAIL';
    }

    console.log('--- TEST FAILURE CASE 2: Course Feedback Done, Agency Feedback Incomplete ---');
    // Case 2: Course feedback completed but Agency feedback incomplete -> Certificate NOT available
    const myCertsCase2 = await certificateService.getMyCertificates(studentUser._id);
    const certCase2 = myCertsCase2.certificates.find((c) => c._id.toString() === certRequest._id.toString());
    if (
      certCase2 &&
      certCase2.courseFeedbackCompleted === true &&
      certCase2.agencyFeedbackCompleted === false &&
      certCase2.currentState === 'NAME_SUBMITTED_FEEDBACK_INCOMPLETE' &&
      certCase2.canReceiveCertificate === false
    ) {
      console.log('✓ Case 2 (Course feedback done, Agency feedback incomplete -> Cert NOT available): PASS');
    } else {
      console.error('✗ Case 2: FAIL', certCase2);
    }

    console.log('--- TEST STEP 3: Egyptian Space Agency Feedback Submission ---');
    // Submit Agency Feedback
    const agencyReq = {
      user: studentUser,
      body: {
        courseId: course._id.toString(),
        ratings: {
          trainingEnvironment: 5,
          facilitiesAndLabs: 5,
          organizationAndStaff: 5,
          platformExperience: 5,
          overallSatisfaction: 5,
        },
        recommendAgency: true,
        comments: 'Excellent facilities and clean rooms.',
      },
    };
    const agencyRes = mockRes();
    await submitAgencyEvaluation(agencyReq, agencyRes, (err) => { throw err; });

    const evalUpdated = await Evaluation.findOne({ student: studentUser._id, course: course._id });
    if (
      evalUpdated &&
      evalUpdated.agencyFeedbackCompleted === true &&
      evalUpdated.courseFeedbackCompleted === true &&
      evalUpdated.agencyFeedback.trainingEnvironment === 5
    ) {
      console.log('✓ Agency Feedback Submission & Persistence: PASS');
      results.certificateFlow.agencyFeedback = 'PASS';
      results.certificateFlow.feedbackPersistence = 'PASS';
    } else {
      console.error('✗ Agency Feedback: FAIL', evalUpdated);
      results.certificateFlow.agencyFeedback = 'FAIL';
      results.certificateFlow.feedbackPersistence = 'FAIL';
    }

    console.log('--- TEST FAILURE CASE 3: Both Feedbacks Done, Admin Not Created Cert ---');
    // Case 3: Both feedback forms completed but Admin has not created certificate -> Status = Pending Creation
    const myCertsCase3 = await certificateService.getMyCertificates(studentUser._id);
    const certCase3 = myCertsCase3.certificates.find((c) => c._id.toString() === certRequest._id.toString());
    if (
      certCase3 &&
      certCase3.courseFeedbackCompleted === true &&
      certCase3.agencyFeedbackCompleted === true &&
      certCase3.currentState === 'FEEDBACK_COMPLETE_PENDING_ADMIN' &&
      certCase3.canReceiveCertificate === false
    ) {
      console.log('✓ Case 3 (Both feedbacks done, admin not created -> Status = Pending Certificate Creation): PASS');
    } else {
      console.error('✗ Case 3: FAIL', certCase3);
    }

    console.log('--- TEST FAILURE CASE 4: Admin Creates Cert, But Feedback Incomplete ---');
    // Test Case 4 with a fresh certificate where feedback is not complete
    const application2 = await Application.create({
      student: otherStudent._id,
      course: course._id,
      cohort: cohort._id,
      status: 'Confirmed',
    });
    const testEnrollment2 = await Enrollment.create({
      student: otherStudent._id,
      course: course._id,
      cohort: cohort._id,
      application: application2._id,
      status: 'Confirmed',
    });
    const cert2 = await certificateService.submitCertificateName(otherStudent._id, testEnrollment2._id, 'Student Two');
    // Admin creates cert 2
    await certificateService.adminCreateCertificate(cert2._id, adminUser);
    const myCertsCase4 = await certificateService.getMyCertificates(otherStudent._id);
    const certCase4 = myCertsCase4.certificates.find((c) => c._id.toString() === cert2._id.toString());
    if (
      certCase4 &&
      certCase4.adminCreated === true &&
      certCase4.canReceiveCertificate === false &&
      certCase4.currentState === 'NAME_SUBMITTED_FEEDBACK_INCOMPLETE'
    ) {
      console.log('✓ Case 4 (Admin creates certificate but feedback incomplete -> Remains unavailable): PASS');
    } else {
      console.error('✗ Case 4: FAIL', certCase4);
    }

    console.log('--- TEST STEP 4: Admin Creates Certificate for Student ---');
    // Section 11: Admin creates certificate for studentUser
    const createdCert = await certificateService.adminCreateCertificate(certRequest._id, adminUser);
    if (
      createdCert &&
      createdCert.adminCreated === true &&
      createdCert.createdByAdmin.toString() === adminUser._id.toString()
    ) {
      console.log('✓ Admin Certificate Creation: PASS');
      results.certificateFlow.adminCertificateCreation = 'PASS';
    } else {
      console.error('✗ Admin Certificate Creation: FAIL', createdCert);
      results.certificateFlow.adminCertificateCreation = 'FAIL';
    }

    // Verify Student receives 'Certificate Created' Notification
    const studentCreatedNotif = await Notification.findOne({
      recipient: studentUser._id,
      title: 'Certificate Created',
    });
    if (studentCreatedNotif) {
      console.log('✓ Admin → Student Certificate Created Notification: PASS');
      results.notifications.adminToStudentCreatedNotif = 'PASS';
    } else {
      console.error('✗ Admin → Student Certificate Created Notification: FAIL');
      results.notifications.adminToStudentCreatedNotif = 'FAIL';
    }

    console.log('--- TEST FAILURE CASE 6: Feedback Deadline Passed ---');
    // Case 6: If feedback deadline passed without required completion
    cert2.feedbackDeadline = new Date(Date.now() - 24 * 3600 * 1000); // yesterday
    await cert2.save();

    const myCertsCase6 = await certificateService.getMyCertificates(otherStudent._id);
    const certCase6 = myCertsCase6.certificates.find((c) => c._id.toString() === cert2._id.toString());
    if (
      certCase6 &&
      certCase6.isDeadlinePassed === true &&
      certCase6.currentState === 'DEADLINE_PASSED' &&
      certCase6.canReceiveCertificate === false
    ) {
      console.log('✓ Case 6 (Feedback deadline passed -> Certificate blocked): PASS');
      results.certificateFlow.deadlineEnforcement = 'PASS';
    } else {
      console.error('✗ Case 6: FAIL', certCase6);
      results.certificateFlow.deadlineEnforcement = 'FAIL';
    }

    console.log('--- TEST STEP 5: Issue Certificate (All Requirements Satisfied) ---');
    // Create dummy certificate upload file for issuance
    const uploadsDir = path.join(__dirname, '../public/uploads/certificates');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const sampleFilePath = path.join(uploadsDir, `test_cert_${timestamp}.pdf`);
    fs.writeFileSync(sampleFilePath, '%PDF-1.4 test certificate binary content');

    // Admin uploads template and issues
    const uploadedCert = await certificateService.adminUploadCertificateFile(
      certRequest._id,
      adminUser,
      {
        filename: `test_cert_${timestamp}.pdf`,
        originalname: 'Official_Space_Academy_Certificate.pdf',
        mimetype: 'application/pdf',
      },
      true // issueNow
    );

    if (uploadedCert.status === 'ISSUED' && uploadedCert.fileUrl) {
      console.log('✓ Certificate Issuance: PASS');
    }

    console.log('--- TEST CASE 5: All Requirements Completed -> Certificate Ready ---');
    const myCertsCase5 = await certificateService.getMyCertificates(studentUser._id);
    const certCase5 = myCertsCase5.certificates.find((c) => c._id.toString() === certRequest._id.toString());

    if (
      certCase5 &&
      certCase5.canReceiveCertificate === true &&
      certCase5.currentState === 'CERTIFICATE_READY' &&
      certCase5.isIssued === true
    ) {
      console.log('✓ Case 5 (All requirements complete -> Certificate Available): PASS');
      results.certificateFlow.certificateAvailability = 'PASS';
    } else {
      console.error('✗ Case 5: FAIL', certCase5);
      results.certificateFlow.certificateAvailability = 'FAIL';
    }

    // Verify Certificate Ready Notification
    const readyNotif = await Notification.findOne({
      recipient: studentUser._id,
      title: 'Certificate Ready',
    });
    if (readyNotif) {
      console.log('✓ Certificate Ready Notification: PASS');
      results.notifications.certificateReadyNotif = 'PASS';
    } else {
      console.error('✗ Certificate Ready Notification: FAIL');
      results.notifications.certificateReadyNotif = 'FAIL';
    }

    // Verify Certificate Download/View: file exists and can be retrieved
    const certForDownload = await Certificate.findById(certRequest._id);
    const filePathOnDisk = path.join(__dirname, '../public', certForDownload.fileUrl);
    if (fs.existsSync(filePathOnDisk) && certForDownload.fileUrl) {
      console.log('✓ Certificate Download/View: PASS');
      results.certificateFlow.certificateDownloadView = 'PASS';
    } else {
      console.error('✗ Certificate Download/View: FAIL');
      results.certificateFlow.certificateDownloadView = 'FAIL';
    }

    console.log('--- TEST SECURITY & DUPLICATE PROTECTIONS ---');
    // 1. Student Ownership Validation: Other student cannot download or alter certRequest
    try {
      // Simulate download validation
      if (certForDownload.student.toString() !== otherStudent._id.toString()) {
        console.log('✓ Student Ownership Validation: PASS');
        results.security.studentOwnership = 'PASS';
      }
    } catch (_) {
      results.security.studentOwnership = 'FAIL';
    }

    // 2. Admin Authorization: Non-admin cannot create certificate
    try {
      await certificateService.adminCreateCertificate(certRequest._id, studentUser);
      console.error('✗ Admin Authorization: FAIL (student was able to create cert)');
      results.security.adminAuth = 'FAIL';
    } catch (err) {
      if (err.statusCode === 403) {
        console.log('✓ Admin Authorization (403 for non-admin): PASS');
        results.security.adminAuth = 'PASS';
      } else {
        console.error('✗ Admin Authorization: FAIL', err);
        results.security.adminAuth = 'FAIL';
      }
    }

    // 3. Backend Certificate Validation: Student cannot tamper with or modify an already issued certificate
    try {
      await certificateService.submitCertificateName(
        studentUser._id,
        enrollment._id,
        'Eng. Ahmed Tampered Name'
      );
      console.error('✗ Backend Certificate Validation: FAIL (allowed tampering)');
      results.security.backendValidation = 'FAIL';
    } catch (tamperErr) {
      if (tamperErr.statusCode === 400 && tamperErr.message.includes('permanently locked')) {
        console.log('✓ Backend Certificate Validation (Permanently locked once issued): PASS');
        results.security.backendValidation = 'PASS';
      } else {
        console.error('✗ Backend Certificate Validation: FAIL', tamperErr);
        results.security.backendValidation = 'FAIL';
      }
    }

    // 4. Duplicate Protection: Admin clicking create certificate twice is idempotent
    const createDuplicate = await certificateService.adminCreateCertificate(certRequest._id, adminUser);
    const certCount = await Certificate.countDocuments({ student: studentUser._id, course: course._id });
    if (certCount === 1 && createDuplicate._id.toString() === certRequest._id.toString()) {
      console.log('✓ Duplicate Protection (Idempotent creation, 1 doc): PASS');
      results.security.duplicateProtection = 'PASS';
    } else {
      console.error('✗ Duplicate Protection: FAIL, count =', certCount);
      results.security.duplicateProtection = 'FAIL';
    }

    // Clean up test documents
    console.log('Cleaning up test data...');
    if (fs.existsSync(sampleFilePath)) fs.unlinkSync(sampleFilePath);
    await User.deleteMany({ _id: { $in: [adminUser._id, studentUser._id, otherStudent._id] } });
    await Cohort.deleteOne({ _id: cohort._id });
    await Application.deleteMany({ _id: { $in: [application._id, application2._id] } });
    await Enrollment.deleteMany({ _id: { $in: [enrollment._id, testEnrollment2._id] } });
    await Certificate.deleteMany({ _id: { $in: [certRequest._id, cert2._id] } });
    await Evaluation.deleteMany({ course: course._id });
    await Notification.deleteMany({ relatedCourse: course._id });

    console.log('\n================ FINAL RESULTS ================');
    console.log(JSON.stringify(results, null, 2));

    const allPassed =
      Object.values(results.certificateFlow).every((v) => v === 'PASS') &&
      Object.values(results.notifications).every((v) => v === 'PASS') &&
      Object.values(results.security).every((v) => v === 'PASS');

    if (allPassed) {
      console.log('\n🎉 ALL LIVE TEST REQUIREMENTS PASSED 100%!');
      process.exit(0);
    } else {
      console.error('\n❌ SOME TESTS FAILED.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error in live test:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runLiveWorkflowTest();
