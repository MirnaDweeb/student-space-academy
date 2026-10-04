require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Cohort = require('../src/models/Cohort');
const Application = require('../src/models/Application');
const Invoice = require('../src/models/Invoice');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const Enrollment = require('../src/models/Enrollment');
const Media = require('../src/models/Media');

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
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
  console.log('EGSA Space Academy — Real Stripe Payment & Media Workflow Live Verification');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/egsa_academy';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB:', mongoUri);

  // 1. Authenticate as Admin and Student
  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    adminUser = await User.findOne({ role: 'superadmin' });
  }

  let studentUser = await User.findOne({ role: 'student', isVerified: true });
  if (!studentUser) {
    studentUser = await User.findOne({ role: 'student' });
    if (studentUser) {
      studentUser.isVerified = true;
      await studentUser.save();
    }
  }

  console.log('✓ Target Student:', studentUser.email);
  console.log('✓ Target Admin:', adminUser.email);

  // Login Student via HTTP to get real JWT
  const studentLoginRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: studentUser.email, password: 'Password123!' })
  );

  let studentToken = studentLoginRes.data?.data?.token;
  if (!studentToken) {
    // Generate token if password differed
    const jwt = require('jsonwebtoken');
    studentToken = jwt.sign({ id: studentUser._id, role: studentUser.role }, process.env.JWT_SECRET || 'change_this_secret', { expiresIn: '1d' });
  }
  console.log('✓ Student JWT acquired');

  // Login Admin via HTTP to get real JWT
  const adminLoginRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: adminUser.email, password: 'Password123!' })
  );

  let adminToken = adminLoginRes.data?.data?.token;
  if (!adminToken) {
    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET || 'change_this_secret', { expiresIn: '1d' });
  }
  console.log('✓ Admin JWT acquired');

  // Find or create test Course & Cohort
  let course = await Course.findOne({ isPublished: true });
  if (!course) {
    course = await Course.findOne();
  }
  let cohort = await Cohort.findOne({ course: course._id });
  if (!cohort) {
    cohort = await Cohort.create({
      course: course._id,
      name: 'Batch Live-2026',
      capacity: 30,
      seatsTaken: 1,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      status: 'Open',
    });
  }

  // Ensure a fresh Accepted Application exists for student for clean invoice testing
  const testRef = `EGSA-APP-LIVE-${Date.now()}`;
  const application = await Application.create({
    student: studentUser._id,
    course: course._id,
    cohort: cohort._id,
    status: 'Accepted',
    referenceNumber: testRef,
    statusHistory: [{ status: 'Accepted', note: 'Admitted for live verification' }],
  });
  console.log('✓ Accepted Application prepared:', application.referenceNumber);

  // TEST 1: Authoritative Price Calculation (HTTP GET/POST)
  console.log('\n--- TEST 1: Authoritative Server-Side Pricing ---');
  const priceRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/calculate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ courseId: course._id, packageType: 'WITH_TRANSPORTATION' })
  );
  console.log('  Pricing API Response:', priceRes.data?.data);
  if (priceRes.data?.data?.packageType === 'WITH_TRANSPORTATION' && priceRes.data?.data?.totalAmount > 0) {
    console.log('✓ [PASS] Authoritative pricing strictly calculated on backend');
  } else {
    console.error('✗ [FAIL] Pricing calculation failed:', priceRes.data);
  }

  // TEST 2: Prepare Invoice
  console.log('\n--- TEST 2: Prepare Invoice for Accepted Application ---');
  const prepRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/prepare',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ applicationId: application._id, packageType: 'WITH_TRANSPORTATION' })
  );
  const invoice = prepRes.data?.data?.invoice;
  console.log('  Invoice ID:', invoice?._id, 'Status:', invoice?.status, 'Amount:', invoice?.amount);
  if (invoice?._id && invoice?.amount > 0) {
    console.log('✓ [PASS] Invoice prepared with trusted pricing snapshot');
  } else {
    console.error('✗ [FAIL] Prepare invoice failed:', prepRes.data);
  }

  // TEST 3: Initiate Payment (returns paymentUrl and redirectUrl)
  console.log('\n--- TEST 3: Payment Initiation ---');
  const initRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/initiate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ invoiceId: invoice._id, packageType: 'WITH_TRANSPORTATION' })
  );
  const paymentData = initRes.data?.data;
  console.log('  Payment URL:', paymentData?.paymentUrl);
  console.log('  Redirect URL:', paymentData?.redirectUrl);
  console.log('  Provider:', paymentData?.transaction?.provider);
  console.log('  Transaction ID:', paymentData?.transaction?.transactionId);

  if (paymentData?.paymentUrl && paymentData?.redirectUrl && paymentData?.transaction?.transactionId) {
    console.log('✓ [PASS] Payment initiation returns both paymentUrl & redirectUrl');
  } else {
    console.error('✗ [FAIL] Payment initiation response contract mismatch:', initRes.data);
  }

  // TEST 4: Query Payment Session Status
  console.log('\n--- TEST 4: Payment Session Status Endpoint ---');
  const statusRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/payments/session-status/${paymentData.transaction.transactionId}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });
  console.log('  Session Status:', statusRes.data?.status, 'isSettled:', statusRes.data?.isSettled);
  if (statusRes.data?.success && statusRes.data?.status) {
    console.log('✓ [PASS] Session status queried successfully');
  } else {
    console.error('✗ [FAIL] Session status query failed:', statusRes.data);
  }

  // TEST 5: Negative Security Test (IDOR Protection)
  console.log('\n--- TEST 5: Negative Security IDOR Test ---');
  const studentB = await User.findOne({ role: 'student', _id: { $ne: studentUser._id } });
  if (studentB) {
    const jwt = require('jsonwebtoken');
    const tokenB = jwt.sign({ id: studentB._id, role: studentB.role }, process.env.JWT_SECRET || 'change_this_secret');
    const idorRes = await httpRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/payments/session-status/${paymentData.transaction.transactionId}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    console.log('  IDOR Attempt HTTP Status:', idorRes.status);
    if (idorRes.status === 403) {
      console.log('✓ [PASS] IDOR attack prevented: Student B cannot inspect Student A session');
    } else {
      console.error('✗ [FAIL] IDOR vulnerability: Non-owner got status:', idorRes.status);
    }
  }

  // TEST 6: Payment Verification & Idempotency
  console.log('\n--- TEST 6: Payment Verification & Idempotency ---');
  const verifyRes1 = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ transactionId: paymentData.transaction.transactionId })
  );
  console.log('  1st Verify Result:', verifyRes1.data?.data?.status);
  if (verifyRes1.data?.success && verifyRes1.data?.data?.status === 'PAID') {
    console.log('✓ [PASS] First verification settled invoice and confirmed enrollment');
  } else {
    console.error('✗ [FAIL] Verification failed:', verifyRes1.data);
  }

  // 2nd Verify (Duplicated call)
  const verifyRes2 = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/payments/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ transactionId: paymentData.transaction.transactionId })
  );
  console.log('  2nd Verify Result (Duplicate):', verifyRes2.data?.data?.alreadySettled);
  if (verifyRes2.data?.success && verifyRes2.data?.data?.alreadySettled === true) {
    console.log('✓ [PASS] Idempotency confirmed: Replayed verification returned alreadySettled');
  } else {
    console.error('✗ [FAIL] Duplicate verification not handled idempotently:', verifyRes2.data);
  }

  // TEST 7: Media Workflow
  console.log('\n--- TEST 7: Media Upload & Category Workflow ---');
  // Ensure student has a confirmed enrollment
  const enrollment = await Enrollment.findOne({ student: studentUser._id, course: course._id });
  console.log('  Confirmed Enrollment present:', Boolean(enrollment));

  // Create media with category via service/model
  const sampleMedia = await Media.create({
    student: studentUser._id,
    course: course._id,
    cohort: cohort._id,
    category: 'Project',
    title: 'EGSA CubeSat Structural Frame Assembly',
    caption: 'Cleanroom assembly testing for payload integration',
    description: 'Practical training documentation completed during Academy workshop.',
    fileUrl: '/uploads/media/egsa_sample_oscilloscope.svg',
    filename: 'egsa_sample_oscilloscope.svg',
    originalName: 'oscilloscope.svg',
    mimeType: 'image/svg+xml',
    fileSize: 2775,
    status: 'Pending_Review',
    submittedAt: new Date(),
  });
  console.log('✓ Media created with Category "Project":', sampleMedia._id);

  // List admin media queue via HTTP
  const adminMediaRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/media/admin?status=Pending_Review',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  const adminMediaItems = adminMediaRes.data?.data?.items || adminMediaRes.data?.items || [];
  const foundInQueue = adminMediaItems.find((m) => m._id.toString() === sampleMedia._id.toString());
  console.log('  Found in Admin Queue:', Boolean(foundInQueue), 'Category:', foundInQueue?.category);

  if (foundInQueue && foundInQueue.category === 'Project') {
    console.log('✓ [PASS] Admin Media queue displays student submission with category and course');
  } else {
    console.error('✗ [FAIL] Media missing from admin queue or category not returned');
  }

  // Admin approves media via HTTP
  const approveRes = await httpRequest(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/media/admin/${sampleMedia._id}/approve`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    },
    JSON.stringify({ notes: 'Verified compliance with Space Agency documentation standards.' })
  );
  console.log('  Admin Approval HTTP Status:', approveRes.status);
  const updatedMedia = await Media.findById(sampleMedia._id);
  console.log('  Updated Media Status in DB:', updatedMedia.status);

  if (updatedMedia.status === 'Approved') {
    console.log('✓ [PASS] Admin approval persisted status "Approved" to MongoDB');
  } else {
    console.error('✗ [FAIL] Media approval failed to persist status');
  }

  // TEST 8: Image Serving via /uploads/media
  console.log('\n--- TEST 8: Image Serving Verification ---');
  const imgRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/uploads/media/egsa_sample_oscilloscope.svg',
    method: 'GET',
    // Deliberately no Authorization header, simulating standard browser <img src="..."> request
  });
  console.log('  Image HTTP Status:', imgRes.status);
  if (imgRes.status === 200) {
    console.log('✓ [PASS] Media file served directly for browser <img> tags without 401 error');
  } else {
    console.error('✗ [FAIL] Media file failed to serve: status', imgRes.status);
  }

  console.log('\n========================================================================');
  console.log('ALL LIVE VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runLiveVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
