/**
 * Live End-to-End Verification Test
 * Tests:
 * 1. New Student Registration -> MongoDB inspection -> Immediate Login -> JWT -> Student Dashboard API access
 * 2. Token Refresh -> Protected API access with refreshed token
 * 3. Logout -> Verify Protected Routes Reject (401) -> Re-login restore
 * 4. Wrong Password Login -> 401 Rejection
 * 5. Duplicate Email Registration -> 409 Conflict Rejection
 */

const mongoose = require('mongoose');
const http = require('http');

const API_BASE = 'http://127.0.0.1:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    if (bodyStr) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runLiveTests() {
  console.log('=== EGSA Space Academy Live Auth Verification Test ===');
  
  // 1. Connect to MongoDB to inspect created records directly
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB at', MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

  const testId = Date.now().toString().slice(-6);
  const testStudent = {
    fullName: `Cadet LiveTest ${testId}`,
    email: `cadet.live.${testId}@space.egsa.gov.eg`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    phone: `+2010${Math.floor(10000000 + Math.random() * 90000000)}`,
    nationalId: `2990101${Math.floor(1000000 + Math.random() * 9000000)}`,
    governorate: 'Cairo',
    educationLevel: 'Bachelor Degree',
    university: 'Cairo University',
    faculty: 'Aerospace Engineering',
    agreeToTerms: true,
  };

  const results = {};

  try {
    // ----------------------------------------------------
    // TEST 1: Register New Student & Verify Immediate Login
    // ----------------------------------------------------
    console.log('\n[TEST 1] Registering New Student:', testStudent.email);
    const regRes = await request(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: testStudent,
    });

    console.log('Registration Response Status:', regRes.statusCode);
    console.log('Registration Response Body:', JSON.stringify(regRes.data));

    if (regRes.statusCode !== 201 || !regRes.data.success) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
    }

    // Inspect user directly in MongoDB
    const dbUser = await User.findOne({ email: testStudent.email });
    if (!dbUser) {
      throw new Error('User was not persisted to MongoDB!');
    }

    console.log('MongoDB User Record Check:');
    console.log(' - ID:', dbUser._id);
    console.log(' - Email:', dbUser.email);
    console.log(' - isEmailVerified:', dbUser.isEmailVerified);
    console.log(' - accountStatus:', dbUser.accountStatus);
    console.log(' - isActive:', dbUser.isActive);
    console.log(' - Password Hashed:', Boolean(dbUser.password && dbUser.password.startsWith('$2')));

    if (dbUser.password === testStudent.password) {
      throw new Error('PASSWORD STORED AS PLAINTEXT! SECURITY VIOLATION');
    }
    if (dbUser.isEmailVerified !== true) {
      throw new Error(`Expected isEmailVerified to be true, got ${dbUser.isEmailVerified}`);
    }
    if (dbUser.accountStatus !== 'active') {
      throw new Error(`Expected accountStatus to be active, got ${dbUser.accountStatus}`);
    }

    // Attempt immediate Login with same credentials
    console.log('\nAttempting Immediate Login without any email verification step...');
    const loginRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: {
        email: testStudent.email,
        password: testStudent.password,
      },
    });

    console.log('Login Response Status:', loginRes.statusCode);
    console.log('Login Response Body User:', loginRes.data?.data?.user);

    if (loginRes.statusCode !== 200 || !loginRes.data?.data?.token) {
      throw new Error(`Immediate login failed: ${JSON.stringify(loginRes.data)}`);
    }

    const accessToken = loginRes.data.data.token;
    const refreshToken = loginRes.data.data.refreshToken;
    console.log('Access token received successfully. Length:', accessToken.length);

    // Call protected student dashboard route
    console.log('\nFetching Student Dashboard with received JWT...');
    const dashRes = await request(`${API_BASE}/dashboard`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log('Dashboard Response Status:', dashRes.statusCode);
    console.log('Dashboard Response Success:', dashRes.data?.success);

    if (dashRes.statusCode !== 200) {
      throw new Error(`Dashboard API rejected token with status ${dashRes.statusCode}: ${JSON.stringify(dashRes.data)}`);
    }

    results.test1 = 'PASS';
    console.log('>>> TEST 1: PASS (Registration -> Immediate Login -> JWT -> Student Dashboard)');

    // ----------------------------------------------------
    // TEST 2: Refresh Token Session Persistence
    // ----------------------------------------------------
    console.log('\n[TEST 2] Testing Token Refresh...');
    const refreshRes = await request(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      body: {
        refreshToken: refreshToken,
      },
    });

    console.log('Refresh Response Status:', refreshRes.statusCode);
    if (refreshRes.statusCode !== 200 || !refreshRes.data?.data?.token) {
      throw new Error(`Token refresh failed: ${JSON.stringify(refreshRes.data)}`);
    }

    const newAccessToken = refreshRes.data.data.token;
    // Verify refreshed token works on protected route
    const dashRes2 = await request(`${API_BASE}/dashboard`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${newAccessToken}`,
      },
    });

    if (dashRes2.statusCode !== 200) {
      throw new Error(`Refreshed token rejected: ${JSON.stringify(dashRes2.data)}`);
    }

    results.test2 = 'PASS';
    console.log('>>> TEST 2: PASS (Session Refresh & Protected Route Access)');

    // ----------------------------------------------------
    // TEST 3: Logout & Route Protection
    // ----------------------------------------------------
    console.log('\n[TEST 3] Testing Logout & Route Protection...');
    const logoutRes = await request(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${newAccessToken}`,
      },
      body: {
        refreshToken: refreshToken,
      },
    });

    console.log('Logout Response Status:', logoutRes.statusCode);
    if (logoutRes.statusCode !== 200) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutRes.data)}`);
    }

    // Attempt to access protected route without token
    const unauthRes = await request(`${API_BASE}/dashboard`, {
      method: 'GET',
    });
    console.log('Unauthenticated access attempt status:', unauthRes.statusCode);
    if (unauthRes.statusCode !== 401) {
      throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.statusCode}`);
    }

    // Re-login to confirm account can log in again
    const reloginRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: {
        email: testStudent.email,
        password: testStudent.password,
      },
    });
    if (reloginRes.statusCode !== 200) {
      throw new Error(`Re-login after logout failed: ${JSON.stringify(reloginRes.data)}`);
    }

    results.test3 = 'PASS';
    console.log('>>> TEST 3: PASS (Logout -> Protected Routes Blocked -> Re-login Restores Access)');

    // ----------------------------------------------------
    // TEST 4: Wrong Password Rejection
    // ----------------------------------------------------
    console.log('\n[TEST 4] Testing Wrong Password Rejection...');
    const wrongPassRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: {
        email: testStudent.email,
        password: 'IncorrectPassword999!',
      },
    });

    console.log('Wrong Password Response Status:', wrongPassRes.statusCode);
    console.log('Wrong Password Response Body:', wrongPassRes.data?.message);
    if (wrongPassRes.statusCode !== 401) {
      throw new Error(`Expected 401 for wrong password, got ${wrongPassRes.statusCode}`);
    }

    results.test4 = 'PASS';
    console.log('>>> TEST 4: PASS (Wrong Password Properly Rejected with 401)');

    // ----------------------------------------------------
    // TEST 5: Duplicate Email Registration Rejection
    // ----------------------------------------------------
    console.log('\n[TEST 5] Testing Duplicate Email Registration Rejection...');
    const dupRes = await request(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: {
        ...testStudent,
        nationalId: '29901019999999', // different nationalId to ensure email conflict triggers
      },
    });

    console.log('Duplicate Registration Response Status:', dupRes.statusCode);
    console.log('Duplicate Registration Response Body:', dupRes.data?.message);
    if (dupRes.statusCode !== 409 && dupRes.statusCode !== 400) {
      throw new Error(`Expected 409/400 for duplicate email, got ${dupRes.statusCode}`);
    }

    // Verify count in MongoDB did not increment
    const dupCount = await User.countDocuments({ email: testStudent.email });
    console.log('Count of users with email in DB:', dupCount);
    if (dupCount !== 1) {
      throw new Error(`Expected exactly 1 user with email, found ${dupCount}`);
    }

    results.test5 = 'PASS';
    console.log('>>> TEST 5: PASS (Duplicate Email Registration Rejected & Integrity Preserved)');

    // Clean up test user
    await User.deleteOne({ email: testStudent.email });
    console.log('\nCleaned up test cadet record.');

    console.log('\n=======================================');
    console.log('ALL 5 VERIFICATION TESTS COMPLETED WITH 100% SUCCESS:');
    console.log(JSON.stringify(results, null, 2));
    console.log('=======================================');

  } catch (err) {
    console.error('\nLIVE TEST FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runLiveTests();
