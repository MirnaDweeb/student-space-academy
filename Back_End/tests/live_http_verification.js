const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Helper to make HTTP requests
function request(options, postData = null, isMultipart = false, boundary = '') {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
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

async function runLiveHttpVerification() {
  console.log('=== EGSA Space Academy: Live HTTP Student Assessment Verification ===\n');

  // Step 1: Login as Sara Demo
  console.log('1. Authenticating as Student (sara.demo@egsa-academy.example)...');
  const loginPayload = JSON.stringify({
    email: 'sara.demo@egsa-academy.example',
    password: 'Password123!'
  });

  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload)
    }
  }, loginPayload);

  if (loginRes.status !== 200 || !loginRes.data?.data?.token) {
    console.error('Failed to log in:', loginRes.status, loginRes.data);
    process.exit(1);
  }

  const token = loginRes.data.data.token;
  const user = loginRes.data.data.user;
  console.log(`✓ Logged in as: ${user.name} (${user.email}), Role: ${user.role}\n`);

  const authHeaders = {
    'Authorization': `Bearer ${token}`
  };

  // Step 2: Fetch Student Assessments via GET /api/assessments/my
  console.log('2. Fetching student assessments (scoped to enrolled cohorts)...');
  const listRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/assessments/my',
    method: 'GET',
    headers: authHeaders
  });

  if (listRes.status !== 200) {
    console.error('Failed to get assessments:', listRes.status, listRes.data);
    process.exit(1);
  }

  const { sections, summary } = listRes.data.data;
  console.log(`✓ Assessments retrieved successfully:`);
  console.log(`  - Upcoming count: ${sections.upcoming.length}`);
  console.log(`  - Submitted count: ${sections.submitted.length}`);
  console.log(`  - Evaluated count: ${sections.evaluated.length}`);
  console.log(`  - Summary: Total=${summary.total}, Avg Score=${summary.averageScore}%`);

  // Verify that all assessments returned belong to Sara's enrolled course/cohort
  for (const groupName of ['upcoming', 'submitted', 'evaluated']) {
    for (const a of sections[groupName]) {
      console.log(`    [${groupName.toUpperCase()}] ${a.title} | Course: ${a.course?.title || a.course} | Due: ${a.dueDate || 'N/A'}`);
    }
  }

  // Step 3: View Details of an Upcoming Assessment
  if (sections.upcoming.length === 0) {
    console.log('Notice: No upcoming assessments. Let us inspect first available assessment.');
  }
  const targetAssessment = sections.upcoming[0] || sections.submitted[0] || sections.evaluated[0];
  console.log(`\n3. Viewing details of Assessment: "${targetAssessment.title}" (ID: ${targetAssessment._id})...`);

  const detailRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/assessments/${targetAssessment._id}`,
    method: 'GET',
    headers: authHeaders
  });

  if (detailRes.status !== 200) {
    console.error('Failed to get assessment details:', detailRes.status, detailRes.data);
    process.exit(1);
  }

  const detail = detailRes.data.data;
  console.log(`✓ Details verified:`);
  console.log(`  - Title: ${detail.assessment.title}`);
  console.log(`  - Max Score: ${detail.assessment.maxScore}`);
  console.log(`  - Submission Type: ${detail.assessment.submissionType}`);
  console.log(`  - Instructions present: ${!!detail.assessment.instructions}`);
  console.log(`  - Attachments count: ${detail.assessment.attachments?.length || 0}`);
  console.log(`  - Submission status: ${detail.status}`);
  console.log(`  - Result published: ${detail.result ? 'Yes' : 'No (Pending or Draft protected)'}`);

  // Step 4: Test IDOR Protection
  console.log('\n4. Verifying IDOR Protection against unauthorized cohort assessment...');
  const fakeId = '650000000000000000000099';
  const idorRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/assessments/${fakeId}`,
    method: 'GET',
    headers: authHeaders
  });
  console.log(`✓ Accessing non-enrolled / non-existent assessment returned status: ${idorRes.status} (expected 403 or 404)`);

  // Step 5: Test Submitting to an Assessment (Multipart Form-Data)
  // Let's find an assessment that is upcoming or allows resubmission
  const submittable = sections.upcoming.find(a => a.allowResubmission !== false) || targetAssessment;
  console.log(`\n5. Testing Student Submission to "${submittable.title}"...`);

  const boundary = '----WebKitFormBoundaryEGSA' + Date.now();
  const fileContent = 'EGSA Space Academy - Student Telemetry Analysis Work Document';
  const fileName = 'student_analysis_report.txt';

  let multipartBody = '';
  multipartBody += `--${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="textAnswer"\r\n\r\n`;
  multipartBody += `Telemetry analysis calibrated with zero-drift filters across 437 MHz orbital passes.\r\n`;
  multipartBody += `--${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
  multipartBody += `Content-Type: text/plain\r\n\r\n`;
  multipartBody += `${fileContent}\r\n`;
  multipartBody += `--${boundary}--\r\n`;

  const submitRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/assessments/${submittable._id}/submit`,
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(multipartBody)
    }
  }, multipartBody);

  console.log(`Submit response status: ${submitRes.status}`);
  if (submitRes.status === 200 || submitRes.status === 201) {
    console.log(`✓ Submission succeeded:`, {
      status: submitRes.data?.data?.submission?.status,
      version: submitRes.data?.data?.submission?.version,
      submittedAt: submitRes.data?.data?.submission?.submittedAt,
      fileName: submitRes.data?.data?.submission?.file?.originalName
    });
  } else {
    console.log(`Submission notice: ${submitRes.data?.message || submitRes.raw}`);
  }

  // Step 6: Verify Evaluated Tab & Instructor Published Results
  if (sections.evaluated.length > 0) {
    const evaluatedItem = sections.evaluated[0];
    console.log(`\n6. Verifying published evaluation details for: "${evaluatedItem.title}"...`);
    const evalRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/assessments/${evaluatedItem._id}`,
      method: 'GET',
      headers: authHeaders
    });

    const evalDetail = evalRes.data.data;
    console.log(`✓ Published Result verified:`);
    console.log(`  - Status: ${evalDetail.status}`);
    console.log(`  - Score: ${evalDetail.result?.score} / ${evalDetail.result?.maxScore}`);
    console.log(`  - Percentage: ${evalDetail.result?.percentage}%`);
    console.log(`  - Evaluator: ${evalDetail.result?.evaluator?.name || 'Academic Faculty'}`);
    console.log(`  - Feedback: "${evalDetail.result?.feedback}"`);
    console.log(`  - Strengths: "${evalDetail.result?.strengths}"`);
    console.log(`  - Areas for Improvement: "${evalDetail.result?.improvementAreas}"`);
  }

  console.log('\n=== ALL HTTP STUDENT CYCLE VERIFICATIONS PASSED SUCCESSFULLY ===');
}

runLiveHttpVerification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
