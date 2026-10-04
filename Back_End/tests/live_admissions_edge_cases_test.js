/**
 * Live test for Ineligible, Rejected, and Payment Cancellation edge cases
 */
const http = require('http');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const StudentProfile = require('../src/models/StudentProfile');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Application = require('../src/models/Application');
const Invoice = require('../src/models/Invoice');
const paymentService = require('../src/services/paymentService');

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function createVerifiedStudent(prefix) {
  const email = `${prefix}.${Date.now()}@egsa.test.example`;
  await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({
      fullName: `${prefix} Student`,
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      phone: '01012345678',
      nationalId: String(Math.floor(10000000000000 + Math.random() * 90000000000000)).slice(0, 14),
      university: 'Cairo University',
      faculty: 'Aerospace Engineering',
      status: 'student',
      agreeToTerms: true,
    })
  );

  const studentUser = await User.findOne({ email });
  studentUser.isEmailVerified = true;
  studentUser.accountStatus = 'active';
  await studentUser.save();

  await StudentProfile.findOneAndUpdate(
    { user: studentUser._id },
    { $set: { user: studentUser._id, status: 'student', fieldOfStudy: 'Engineering' } },
    { upsert: true, new: true }
  );

  const loginRes = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email, password: 'Password123!' })
  );

  return { user: studentUser, token: loginRes.data?.data?.token };
}

async function runEdgeCases() {
  console.log('--- Testing Ineligible, Rejection, and Payment Cancel Flows ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/egsa_academy');

  let course = await Course.findOne({ isPublished: true });
  if (!course) course = await Course.findOne();
  let cohort = await Cohort.findOne({ course: course._id });
  if (!cohort) cohort = await Cohort.findOne();

  // Admin login
  const adminLogin = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: 'admin@egsa.gov.eg', password: 'Password123!' })
  );
  const adminToken = adminLogin.data?.data?.token;

  // 1. Ineligible Flow Test
  console.log('\n1. Testing Ineligible Flow...');
  const { user: ineligUser, token: ineligToken } = await createVerifiedStudent('ineligible');

  // Submit application
  const ineligAppRes = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/applications', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ineligToken}` } },
    JSON.stringify({ courseId: course._id })
  );
  const ineligAppId = ineligAppRes.data?.data?._id;

  // Submit failing readiness assessment (score = 0%)
  const startAttempt = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/readiness/start', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ineligToken}` } },
    JSON.stringify({ courseId: course._id })
  );
  const attemptId = startAttempt.data?.data?.attemptId;
  const questions = startAttempt.data?.data?.questions || [];

  // Answer all questions with wrong option (selectedIndex: 999) to get 0% score
  const wrongAnswers = questions.map((q) => ({ questionId: q.id || q._id, selectedIndex: 999 }));
  const failSubmit = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: `/api/readiness/${attemptId}/submit`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ineligToken}` } },
    JSON.stringify({ answers: wrongAnswers })
  );

  const ineligAppAfter = await Application.findById(ineligAppId);
  console.log(`  Readiness Score: ${failSubmit.data?.data?.score}%`);
  console.log(`  Application Status: ${ineligAppAfter.status}`);
  console.log(`  Application Eligibility: ${ineligAppAfter.eligibilityStatus}`);

  if (ineligAppAfter.eligibilityStatus !== 'Not Eligible') throw new Error('Application should be Not Eligible');
  if (ineligAppAfter.status !== 'Foundation Recommended') throw new Error('Status should be Foundation Recommended');

  // Verify Payment Attempt is BLOCKED
  const ineligPayRes = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments/initiate', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ineligToken}` } },
    JSON.stringify({ applicationId: ineligAppId })
  );
  console.log(`  Payment blocked with HTTP ${ineligPayRes.status}: "${ineligPayRes.data?.message}"`);
  if (ineligPayRes.status !== 400) throw new Error('Ineligible payment must be blocked with HTTP 400');
  console.log('✓ [PASS] Ineligible Flow: Readiness Failed -> Marked Not Eligible -> Payment Locked');

  // 2. Rejection Flow Test
  console.log('\n2. Testing Rejection Flow...');
  const rejectRes = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: `/api/admin/applications/${ineligAppId}/reject`, method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } },
    JSON.stringify({ reason: 'Prerequisites not met' })
  );
  console.log(`  Reject HTTP Status: ${rejectRes.status}`);
  const rejectedApp = await Application.findById(ineligAppId);
  console.log(`  Application Status after Reject: ${rejectedApp.status}`);
  if (rejectedApp.status !== 'Rejected') throw new Error('Application should be Rejected');

  // Verify Payment Attempt is BLOCKED on rejected
  const rejectPayRes = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments/initiate', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ineligToken}` } },
    JSON.stringify({ applicationId: ineligAppId })
  );
  console.log(`  Payment on Rejected blocked with HTTP ${rejectPayRes.status}: "${rejectPayRes.data?.message}"`);
  if (rejectPayRes.status !== 400) throw new Error('Rejected payment must be blocked with HTTP 400');
  console.log('✓ [PASS] Rejection Flow: Admin Rejects -> Marked Rejected -> Payment Locked');

  // 3. Payment Cancel Flow Test
  console.log('\n3. Testing Payment Cancel / Failure Flow...');
  const { user: cancelUser, token: cancelToken } = await createVerifiedStudent('cancel');

  const cancelAppRes = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/applications', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cancelToken}` } },
    JSON.stringify({ courseId: course._id })
  );
  const cancelAppId = cancelAppRes.data?.data?._id;

  // Make eligible & accept
  await Application.findByIdAndUpdate(cancelAppId, { eligibilityStatus: 'Eligible', status: 'Under Review' });
  await Cohort.findByIdAndUpdate(cohort._id, { $set: { seatsTaken: 0, capacity: 5 } }); // ensure open seat
  await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: `/api/admin/applications/${cancelAppId}/accept`, method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } }
  );

  // Initiate payment
  const cancelPayInit = await httpRequest(
    { hostname: '127.0.0.1', port: 5000, path: '/api/payments/initiate', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cancelToken}` } },
    JSON.stringify({ applicationId: cancelAppId })
  );
  const cancelTxnId = cancelPayInit.data?.data?.transaction?.transactionId;
  console.log(`  Initiated Payment Transaction: ${cancelTxnId}`);

  // Simulate payment cancellation
  const cancelFinalize = await paymentService.verifyAndFinalizePayment({
    transactionId: cancelTxnId,
    studentId: cancelUser._id,
    status: 'CANCELLED',
    failureReason: 'User cancelled checkout',
  });
  console.log(`  Finalize cancelled status: ${cancelFinalize.status}`);

  const appAfterCancel = await Application.findById(cancelAppId);
  const enrollmentAfterCancel = await mongoose.model('Enrollment').findOne({ application: cancelAppId });
  console.log(`  Application Status remains: ${appAfterCancel.status}`);
  console.log(`  Enrollment exists: ${!!enrollmentAfterCancel}`);

  if (appAfterCancel.status !== 'Accepted') throw new Error('Application should remain Accepted so student can retry');
  if (enrollmentAfterCancel) throw new Error('Enrollment must NOT be created on cancelled payment');
  console.log('✓ [PASS] Payment Cancel Flow: Application remains Accepted for retry, no enrollment created');

  console.log('\n======================================================');
  console.log('ALL EDGE CASES (INELIGIBLE, REJECTED, CANCEL) PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runEdgeCases().catch((err) => {
  console.error('Edge cases test failed:', err);
  process.exit(1);
});
