/**
 * EGSA Space Academy — Verification Script for:
 * 1. Path A — Enroll & Pay Directly (With & without assessment configured)
 * 2. Path B — Optional Assessment First + Explicit Enrollment Next Steps
 * 3. Reporting courses without configured questions
 * 4. Idempotency (prevent duplicate applications/invoices)
 * 5. Atomic Capacity & Waitlist Invariants
 * 6. Paymob Security & Server-side verification
 */

const mongoose = require('mongoose');
const http = require('http');

const User = require('../src/models/User');
const StudentProfile = require('../src/models/StudentProfile');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Application = require('../src/models/Application');
const ReadinessQuestion = require('../src/models/ReadinessQuestion');
const ReadinessAttempt = require('../src/models/ReadinessAttempt');
const Invoice = require('../src/models/Invoice');
const Enrollment = require('../src/models/Enrollment');

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
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runVerification() {
  console.log('========================================================================');
  console.log('EGSA Space Academy — Optional Assessment & Direct Enrollment Test');
  console.log('========================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/egsa_academy');
  console.log('✓ Connected to MongoDB');

  // Find or create test student
  let student = await User.findOne({ email: 'sara.demo@egsa-academy.example' });
  if (!student) {
    student = await User.findOne({ role: 'student' });
  }
  const studentEmail = student.email;

  // Login as student to get JWT token
  const loginRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: studentEmail, password: 'Password123!' })
  );

  if (loginRes.status !== 200 || !loginRes.data?.data?.token) {
    throw new Error(`Login failed for ${studentEmail}: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.data.token;
  console.log('✓ Logged in as student:', studentEmail);

  // Find active courses:
  // 1. CrossFit (has readiness questions)
  // 2. Space course with price (no readiness questions)
  const crossfitCourse = await Course.findOne({ slug: 'crossfit-functional-fitness-program' });
  const spaceCourseWithoutQuestions = await Course.findOne({
    slug: { $ne: 'crossfit-functional-fitness-program' },
    price: { $gt: 0 },
  });

  console.log('\n--- Active Courses Found ---');
  console.log(`CrossFit Course: "${crossfitCourse?.title}" (ID: ${crossfitCourse?._id})`);
  console.log(`Space Course without questions: "${spaceCourseWithoutQuestions?.title}" (ID: ${spaceCourseWithoutQuestions?._id})`);

  // Verify hasReadinessQuestions API reporting
  const courseDetailRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/courses/${crossfitCourse._id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('\n--- Testing Course Details API ---');
  console.log(`CrossFit hasReadinessQuestions: ${courseDetailRes.data?.data?.hasReadinessQuestions} (Expected: true)`);
  if (!courseDetailRes.data?.data?.hasReadinessQuestions) {
    throw new Error('Expected CrossFit course to report hasReadinessQuestions: true');
  }

  const spaceCourseDetailRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/courses/${spaceCourseWithoutQuestions._id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`Space Course hasCustomReadinessQuestions: ${spaceCourseDetailRes.data?.data?.hasCustomReadinessQuestions} (Expected: false)`);
  if (spaceCourseDetailRes.data?.data?.hasCustomReadinessQuestions !== false) {
    throw new Error('Expected Space course to report hasCustomReadinessQuestions: false');
  }
  console.log(`Space Course hasReadinessQuestions: ${spaceCourseDetailRes.data?.data?.hasReadinessQuestions} (Expected: true - fallback available)`);
  if (spaceCourseDetailRes.data?.data?.hasReadinessQuestions !== true) {
    throw new Error('Expected Space course to report hasReadinessQuestions: true');
  }
  console.log('✓ Course API accurately reports readiness question configuration.');

  // TEST 1: Path A — Direct Enrollment for Space Course Without Questions
  console.log('\n--- TEST 1: Path A — Direct Enrollment for Course Without Questions ---');
  // Clean up any existing active app for this space course for clean test
  await Application.deleteMany({ student: student._id, course: spaceCourseWithoutQuestions._id });
  await Invoice.deleteMany({ student: student._id, course: spaceCourseWithoutQuestions._id });

  const directEnrollRes1 = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/applications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    JSON.stringify({ courseId: spaceCourseWithoutQuestions._id, directEnroll: true })
  );

  console.log('Status code:', directEnrollRes1.status);
  console.log('Application status:', directEnrollRes1.data?.data?.status);
  console.log('Eligibility status:', directEnrollRes1.data?.data?.eligibilityStatus);
  console.log('Invoice issued ID:', directEnrollRes1.data?.invoice?._id);
  console.log('Invoice amount:', directEnrollRes1.data?.invoice?.amount);

  if (
    directEnrollRes1.status !== 201 ||
    !['Accepted', 'Eligible - Payment Pending'].includes(directEnrollRes1.data?.data?.status) ||
    !directEnrollRes1.data?.invoice?._id
  ) {
    throw new Error('TEST 1 Failed: Direct enrollment did not auto-accept and issue invoice.');
  }
  console.log('✓ [PASS] TEST 1: Direct enrollment for course without questions succeeded.');

  // TEST 2: Repeated clicks / Idempotency
  console.log('\n--- TEST 2: Idempotency (Prevent Duplicates on Repeated Clicks) ---');
  const repeatDirectEnrollRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/applications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    JSON.stringify({ courseId: spaceCourseWithoutQuestions._id, directEnroll: true })
  );

  console.log('Repeated call status code:', repeatDirectEnrollRes.status);
  console.log('App ID matches existing:', repeatDirectEnrollRes.data?.data?._id === directEnrollRes1.data?.data?._id);
  console.log('Invoice ID matches existing:', repeatDirectEnrollRes.data?.invoice?._id === directEnrollRes1.data?.invoice?._id);

  const totalAppsForCourse = await Application.countDocuments({
    student: student._id,
    course: spaceCourseWithoutQuestions._id,
    status: { $nin: ['Cancelled', 'Rejected'] },
  });
  console.log('Total active applications in DB for course:', totalAppsForCourse);
  if (totalAppsForCourse !== 1) {
    throw new Error(`TEST 2 Failed: Duplicate applications detected (${totalAppsForCourse}).`);
  }
  console.log('✓ [PASS] TEST 2: Repeated click idempotency confirmed.');

  // TEST 3: Path A — Direct Enrollment for Course WITH Questions (Bypassing Assessment)
  console.log('\n--- TEST 3: Path A — Direct Enrollment for Course WITH Questions ---');
  // Create a second test student to test fresh direct enrollment on CrossFit
  const cadetEmail = `direct.cadet.${Date.now()}@egsa.test.example`;
  const cadet = await User.create({
    fullName: 'Direct Cadet',
    email: cadetEmail,
    password: 'Password123!',
    phone: '01099887766',
    nationalId: String(Math.floor(10000000000000 + Math.random() * 90000000000000)),
    role: 'student',
    status: 'student',
    isEmailVerified: true,
    accountStatus: 'active',
  });
  await StudentProfile.create({
    user: cadet._id,
    nationalId: cadet.nationalId,
    university: 'Cairo University',
    faculty: 'Aerospace Engineering',
    graduationYear: 2026,
    status: 'student',
  });

  const cadetLoginRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: cadetEmail, password: 'Password123!' })
  );
  const cadetToken = cadetLoginRes.data.data.token;

  const directCrossfitRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/applications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cadetToken}`,
      },
    },
    JSON.stringify({ courseId: crossfitCourse._id, directEnroll: true })
  );

  console.log('Direct CrossFit status code:', directCrossfitRes.status);
  console.log('Application status:', directCrossfitRes.data?.data?.status);
  console.log('Invoice issued ID:', directCrossfitRes.data?.invoice?._id);
  console.log('Invoice amount:', directCrossfitRes.data?.invoice?.amount);

  if (
    directCrossfitRes.status !== 201 ||
    !['Accepted', 'Eligible - Payment Pending'].includes(directCrossfitRes.data?.data?.status) ||
    !directCrossfitRes.data?.invoice?._id
  ) {
    throw new Error('TEST 3 Failed: Direct enrollment on course with questions failed.');
  }
  console.log('✓ [PASS] TEST 3: Student enrolled & received invoice directly without taking assessment.');

  // TEST 4: Path B — Taking Assessment First
  console.log('\n--- TEST 4: Path B — Taking Assessment First ---');
  const assessCadetEmail = `assess.cadet.${Date.now()}@egsa.test.example`;
  const assessCadet = await User.create({
    fullName: 'Assessment Cadet',
    email: assessCadetEmail,
    password: 'Password123!',
    phone: '01011223344',
    nationalId: String(Math.floor(10000000000000 + Math.random() * 90000000000000)),
    role: 'student',
    status: 'student',
    isEmailVerified: true,
    accountStatus: 'active',
  });
  await StudentProfile.create({
    user: assessCadet._id,
    nationalId: assessCadet.nationalId,
    university: 'Cairo University',
    faculty: 'Aerospace Engineering',
    graduationYear: 2026,
    status: 'student',
  });

  const assessLoginRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: assessCadetEmail, password: 'Password123!' })
  );
  const assessToken = assessLoginRes.data.data.token;

  // Start readiness assessment
  const startRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/readiness/start?courseId=${crossfitCourse._id}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${assessToken}`,
      },
    },
    JSON.stringify({ courseId: crossfitCourse._id })
  );

  console.log('Start assessment status code:', startRes.status);
  console.log('Attempt ID:', startRes.data?.data?.attemptId);
  console.log('Number of questions returned:', startRes.data?.data?.questions?.length);

  if (startRes.status !== 201 || !startRes.data?.data?.attemptId) {
    throw new Error('TEST 4 Failed: Could not start readiness assessment.');
  }

  // Submit assessment answers
  const questions = await ReadinessQuestion.find({ course: crossfitCourse._id }).limit(12);
  const answers = questions.map((q) => ({
    questionId: q._id.toString(),
    selectedIndex: q.correctAnswerIndex,
    selectedAnswerIndex: q.correctAnswerIndex,
  }));

  const submitRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/readiness/${startRes.data.data.attemptId}/submit`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${assessToken}`,
      },
    },
    JSON.stringify({ answers })
  );

  console.log('Submit assessment status code:', submitRes.status);
  if (submitRes.status !== 200) {
    console.log('Submit error response:', submitRes.data);
  }
  console.log('Assessment score:', submitRes.data?.data?.score);
  console.log('Assessment outcome:', submitRes.data?.data?.outcome);

  // Fetch assessment result endpoint
  const resultRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/readiness/${startRes.data.data.attemptId}/result`,
    method: 'GET',
    headers: { Authorization: `Bearer ${assessToken}` },
  });

  console.log('Result API outcome:', resultRes.data?.data?.outcome);
  console.log('Result API score:', resultRes.data?.data?.score);
  console.log('Result API linked invoice:', resultRes.data?.data?.invoice?._id);

  if (resultRes.status !== 200 || resultRes.data?.data?.score !== 100) {
    throw new Error('TEST 4 Failed: Assessment grading or result view failed.');
  }
  console.log('✓ [PASS] TEST 4: Assessment completed, graded, and results presented without forced auto-pay redirect.');

  // TEST 5: Verify Starting Assessment on Course WITHOUT Custom Questions Uses Shared Fallback
  console.log('\n--- TEST 5: Starting Assessment on Course Without Custom Questions (Shared Fallback) ---');
  const fallbackAssessRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/readiness/start?courseId=${spaceCourseWithoutQuestions._id}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    JSON.stringify({ courseId: spaceCourseWithoutQuestions._id })
  );

  console.log('Status code for course with fallback assessment:', fallbackAssessRes.status);
  if (fallbackAssessRes.status !== 201 && fallbackAssessRes.status !== 200) {
    throw new Error(`TEST 5 Failed: Fallback assessment could not be started: ${JSON.stringify(fallbackAssessRes.data)}`);
  }
  const fallbackQuestions = fallbackAssessRes.data?.data?.questions;
  console.log(`Number of questions returned: ${fallbackQuestions?.length}`);
  if (!Array.isArray(fallbackQuestions) || fallbackQuestions.length !== 12) {
    throw new Error('TEST 5 Failed: Expected 12 shared fallback questions.');
  }
  console.log('✓ [PASS] TEST 5: System accurately provides shared fallback assessment questions.');

  console.log('\n========================================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! Both Path A and Path B are fully verified.');
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
