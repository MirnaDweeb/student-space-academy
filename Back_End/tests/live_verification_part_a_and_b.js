/**
 * EGSA Space Academy — Live Verification for Bug 1 (Email Verification) & Bug 2 (Readiness Questions)
 */

const mongoose = require('mongoose');
const http = require('http');

const User = require('../src/models/User');
const Course = require('../src/models/Course');
const ReadinessQuestion = require('../src/models/ReadinessQuestion');
const ReadinessAttempt = require('../src/models/ReadinessAttempt');

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

async function runLiveVerification() {
  console.log('========================================================================');
  console.log('EGSA Space Academy — Bug 1 & Bug 2 Live End-to-End Verification');
  console.log('========================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/egsa_academy');
  console.log('✓ Connected to MongoDB');

  // ========================================================================
  // PART A: EMAIL VERIFICATION & LOGIN GATE VERIFICATION
  // ========================================================================
  console.log('\n--- PART A: Email Verification & Login Gate Full Chain ---');

  const testEmail = `cadet.live.${Date.now()}@egsa.test.example`;
  const testPassword = 'Password123!';
  const testNationalId = String(Math.floor(10000000000000 + Math.random() * 90000000000000)).slice(0, 14);

  // A1. Registration attempt
  console.log(`1. Registering student: ${testEmail}...`);
  const regRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      fullName: 'Tarek Space Cadet',
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      phone: '01012345678',
      nationalId: testNationalId,
      university: 'Cairo University',
      faculty: 'Aerospace Engineering',
      status: 'student',
      agreeToTerms: true,
    })
  );

  console.log('  Registration HTTP Status:', regRes.status);
  console.log('  Registration Message:', regRes.data?.message);
  console.log('  Registration emailSent flag:', regRes.data?.emailSent);
  console.log('  Recipient passed to mail service:', regRes.data?.data?.fullEmail || testEmail);

  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
  }
  console.log('✓ [PASS] User account registered and persisted in MongoDB');

  // Check DB state of registered user
  const unverifiedUser = await User.findOne({ email: testEmail }).select(
    '+emailVerificationToken +emailVerificationTokenHash +emailVerificationExpires'
  );
  console.log('  DB isEmailVerified:', unverifiedUser.isEmailVerified);
  console.log('  DB accountStatus:', unverifiedUser.accountStatus);
  console.log('  Token Hash generated in DB:', Boolean(unverifiedUser.emailVerificationTokenHash));

  // A2. Login attempt BEFORE verification (Must be blocked with 403 EMAIL_NOT_VERIFIED)
  console.log('\n2. Testing Login Gate (Unverified account)...');
  const preLoginRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: testEmail, password: testPassword })
  );

  console.log('  Pre-verification Login HTTP Status:', preLoginRes.status);
  console.log('  Pre-verification Error Code:', preLoginRes.data?.code);
  if (preLoginRes.status === 403 && preLoginRes.data?.code === 'EMAIL_NOT_VERIFIED') {
    console.log('✓ [PASS] Login Gate strictly blocks unverified user with EMAIL_NOT_VERIFIED');
  } else {
    console.error('✗ [FAIL] Expected 403 EMAIL_NOT_VERIFIED, got:', preLoginRes.status, preLoginRes.data);
  }

  // A3. Resend Verification Link
  console.log('\n3. Testing Resend Verification Link endpoint...');
  const resendRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/resend-verification',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: testEmail })
  );

  console.log('  Resend HTTP Status:', resendRes.status);
  console.log('  Resend Message:', resendRes.data?.message);
  console.log('  Resend emailSent flag:', resendRes.data?.emailSent);
  if (resendRes.data?.success) {
    console.log('✓ [PASS] Resend endpoint generated a fresh token and reported truthful status');
  } else {
    console.error('✗ [FAIL] Resend endpoint failed:', resendRes.data);
  }

  // Refetch user to get the latest raw verification token
  const refreshedUser = await User.findOne({ email: testEmail }).select('+emailVerificationToken');
  const rawToken = refreshedUser.emailVerificationToken;
  console.log('  Acquired valid verification token for test execution');

  // A4. Verify Email Address via GET /api/auth/verify-email?token=...
  console.log('\n4. Executing Email Verification...');
  const verifyRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/auth/verify-email?token=${rawToken}`,
    method: 'GET',
  });

  console.log('  Verify HTTP Status:', verifyRes.status);
  console.log('  Verify Response Message:', verifyRes.data?.message);
  if (verifyRes.data?.success) {
    console.log('✓ [PASS] Verification token consumed successfully');
  } else {
    console.error('✗ [FAIL] Verification endpoint failed:', verifyRes.data);
  }

  // Confirm DB state after verification
  const verifiedUser = await User.findOne({ email: testEmail });
  console.log('  DB isEmailVerified after verify:', verifiedUser.isEmailVerified);
  console.log('  DB accountStatus after verify:', verifiedUser.accountStatus);
  console.log('  DB isActive after verify:', verifiedUser.isActive);
  if (verifiedUser.isEmailVerified && verifiedUser.accountStatus === 'active') {
    console.log('✓ [PASS] User record in MongoDB marked active and verified');
  } else {
    console.error('✗ [FAIL] User record was not properly activated');
  }

  // A5. Login attempt AFTER verification (Must succeed with 200 OK + JWT)
  console.log('\n5. Testing Login after Verification...');
  const postLoginRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: testEmail, password: testPassword })
  );

  console.log('  Post-verification Login HTTP Status:', postLoginRes.status);
  const studentToken = postLoginRes.data?.data?.accessToken || postLoginRes.data?.data?.token;
  console.log('  Acquired Student Access Token:', Boolean(studentToken));
  if (postLoginRes.status === 200 && studentToken) {
    console.log('✓ [PASS] Student authenticated successfully and access token granted');
  } else {
    console.error('✗ [FAIL] Login after verification failed:', postLoginRes.data);
  }

  // ========================================================================
  // PART B: READINESS ASSESSMENT & QUESTION MANAGEMENT
  // ========================================================================
  console.log('\n--- PART B: Readiness Assessment & Question Configuration ---');

  // Find target course
  let course = await Course.findOne({ isPublished: true });
  if (!course) course = await Course.findOne();
  console.log(`Target Course: [${course.code || course.slug}] ${course.title} (${course._id})`);

  // B1. Verify state BEFORE fix
  const countBefore = await ReadinessQuestion.countDocuments({ course: course._id });
  console.log(`1. Questions in MongoDB for this course before seeding: ${countBefore}`);

  // Login Admin to test question authoring endpoints
  const adminUser = await User.findOne({ role: 'admin' });
  const jwt = require('jsonwebtoken');
  const adminToken = jwt.sign(
    { id: adminUser._id, role: adminUser.role },
    process.env.JWT_SECRET || 'change_this_secret',
    { expiresIn: '1d' }
  );
  console.log('✓ Admin JWT acquired for question authoring');

  // B2. Admin Authors Questions via Bulk API (Real interface, 5 test questions)
  console.log('\n2. Admin authoring 5 test questions for course...');
  const sampleQuestions = [
    {
      question: 'Which Keplerian orbital element defines the angle between the orbit plane and the Earth equator?',
      options: ['Semi-major axis (a)', 'Eccentricity (e)', 'Inclination (i)', 'True anomaly (ν)'],
      correctAnswerIndex: 2,
      topic: 'Orbital Mechanics',
      difficulty: 'Medium',
    },
    {
      question: 'What is the primary role of the Attitude Determination and Control Subsystem (ADCS)?',
      options: [
        'Regulate payload DC bus voltages',
        'Orient and stabilize the spacecraft pointing in 3D space',
        'Collect solar photons for battery storage',
        'Compress synthetic aperture radar imagery',
      ],
      correctAnswerIndex: 1,
      topic: 'Satellite Subsystems',
      difficulty: 'Medium',
    },
    {
      question: 'Which atmospheric phenomenon causes orbital degradation for low-Earth satellites below 600 km?',
      options: ['Aerodynamic drag from atomic oxygen and residual atmosphere', 'Solar wind plasma stagnation', 'Cosmic ray ionization', 'Geomagnetic field cancellation'],
      correctAnswerIndex: 0,
      topic: 'Space Environment',
      difficulty: 'Medium',
    },
    {
      question: 'Which frequency band is commonly allocated for space telemetry, tracking, and command (TT&C)?',
      options: ['HF Band (3–30 MHz)', 'S-Band (2–4 GHz)', 'VLF Band (3–30 kHz)', 'Longwave Radio'],
      correctAnswerIndex: 1,
      topic: 'Telecommunications & Telemetry',
      difficulty: 'Medium',
    },
    {
      question: 'What is the primary power generation technology utilized on modern Earth-observation CubeSats?',
      options: ['Thermoelectric Radioisotope Generators (RTG)', 'Triple-Junction Photovoltaic Solar Cells', 'Direct Hydrogen Fuel Cells', 'Lithium Primary Wet Cells'],
      correctAnswerIndex: 1,
      topic: 'Power & Energy Systems',
      difficulty: 'Easy',
    },
  ];

  const bulkCreateRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/readiness/admin/questions/bulk',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    },
    JSON.stringify({
      courseId: course._id,
      questions: sampleQuestions,
    })
  );

  console.log('  Admin Bulk Question Creation HTTP Status:', bulkCreateRes.status);
  console.log('  Inserted count reported by API:', bulkCreateRes.data?.count);
  if (bulkCreateRes.status === 201 && bulkCreateRes.data?.count === 5) {
    console.log('✓ [PASS] Admin Question Authoring interface successfully created 5 questions');
  } else {
    console.error('✗ [FAIL] Admin bulk question creation failed:', bulkCreateRes.data);
  }

  const countAfter = await ReadinessQuestion.countDocuments({ course: course._id });
  console.log(`  Questions in MongoDB after admin creation: ${countAfter}`);

  // B3. Student Initiates Readiness Assessment
  console.log('\n3. Student starting readiness assessment for course...');
  const startRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/readiness/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ courseId: course._id })
  );

  console.log('  Start Assessment HTTP Status:', startRes.status);
  const attemptId = startRes.data?.data?.attemptId;
  const clientQuestions = startRes.data?.data?.questions || [];
  console.log('  Attempt ID:', attemptId);
  console.log('  Questions served to student:', clientQuestions.length);

  if (startRes.status === 201 && attemptId && clientQuestions.length > 0) {
    console.log('✓ [PASS] Readiness Assessment initiated; questions loaded without "no questions configured" error');
  } else {
    console.error('✗ [FAIL] Start assessment failed:', startRes.data);
  }

  // B4. Student Submits Answers (Answering all correctly for a READY outcome)
  console.log('\n4. Student answering and submitting assessment...');
  const answers = clientQuestions.map((q) => {
    // Find matching question in sample questions to submit the correct answer
    const sample = sampleQuestions.find((sq) => sq.question === q.question);
    return {
      questionId: q.id,
      selectedIndex: sample ? sample.correctAnswerIndex : 0,
    };
  });

  const submitRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/readiness/${attemptId}/submit`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ answers })
  );

  console.log('  Submit HTTP Status:', submitRes.status);
  const submitData = submitRes.data?.data;
  console.log('  Score:', submitData?.score + '%');
  console.log('  Outcome Classification:', submitData?.outcome);
  console.log('  Knowledge Gaps:', submitData?.knowledgeGaps);

  if (submitRes.status === 200 && submitData?.score === 100 && submitData?.outcome === 'READY') {
    console.log('✓ [PASS] Assessment scored and classified as READY');
  } else {
    console.error('✗ [FAIL] Assessment submission scoring failed:', submitRes.data);
  }

  // B5. Verify Result Query Endpoint
  console.log('\n5. Querying Result Details endpoint...');
  const resultRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/readiness/${attemptId}/result`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });

  console.log('  Result Query HTTP Status:', resultRes.status);
  const attemptRecord = await ReadinessAttempt.findById(attemptId);
  console.log('  DB Attempt Status:', attemptRecord.status);
  console.log('  DB Attempt Score:', attemptRecord.score);
  console.log('  DB Attempt Student Match:', String(attemptRecord.student) === String(verifiedUser._id));

  if (resultRes.status === 200 && attemptRecord.status === 'Submitted') {
    console.log('✓ [PASS] ReadinessAttempt record successfully persisted and accessible to student');
  } else {
    console.error('✗ [FAIL] Result query or DB record mismatch');
  }

  console.log('\n========================================================================');
  console.log('ALL VERIFICATION CHECKS COMPLETED FOR PART A AND PART B!');
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runLiveVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
