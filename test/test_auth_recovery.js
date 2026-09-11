const assert = require('assert');
const http = require('http');

// Set test environment with clean password
process.env.PORT = '3099';
process.env.ADMIN_PASSWORD = 'HajiShield#2026!Bot';
delete process.env.AUTHORIZED_API_KEY;
delete process.env.RECOVERY_PASSWORD;

const { createServer } = require('../src/server');
const userManager = require('../src/user_manager');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

const fs = require('fs');
const path = require('path');
const usersDbPath = path.join(__dirname, '..', 'data', 'users_db.json');
let originalDb = null;

async function runTests() {
  if (fs.existsSync(usersDbPath)) {
    originalDb = fs.readFileSync(usersDbPath, 'utf-8');
  }
  console.log('🧪 Starting Security & Admin Password Authentication Tests...\n');

  const app = createServer();
  const server = app.listen(3099);

  try {
    const adminPassword = 'HajiShield#2026!Bot';
    const wrongPass = 'completely_wrong_pass_99999';

    // -------------------------------------------------------------
    // Test 1: Unauthenticated request to /api/status MUST be rejected (401)
    // -------------------------------------------------------------
    console.log('1️⃣ Testing protected /api/status without credentials...');
    const res1 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/status',
      method: 'GET'
    });
    assert.strictEqual(res1.status, 401, 'Expected 401 Unauthorized for unauthenticated status request');
    console.log('   ✅ Passed: Blocked unauthenticated status request with 401.');

    // -------------------------------------------------------------
    // Test 2: Login with wrong password or API key MUST be rejected (401)
    // -------------------------------------------------------------
    console.log('2️⃣ Testing login with wrong password or arbitrary input...');
    const res2 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: wrongPass });

    assert.strictEqual(res2.status, 401, 'Expected 401 Unauthorized for wrong password');
    assert.ok(res2.data.error.includes('Yanlış') || res2.data.error.includes('Wrong'), 'Error should state Wrong password');
    console.log(`   ✅ Passed: Rejected wrong input with message: "${res2.data.error}"`);

    // -------------------------------------------------------------
    // Test 3: Login with Admin Password MUST succeed (200)
    // -------------------------------------------------------------
    console.log('3️⃣ Testing login with Admin Password...');
    const res3 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: adminPassword });

    assert.strictEqual(res3.status, 200, 'Expected 200 OK for admin password');
    assert.ok(res3.data.user, 'User object should be returned on successful login');
    console.log('   ✅ Passed: Successfully authenticated admin password!');

    // -------------------------------------------------------------
    // Test 4: Access protected /api/status with valid password header MUST succeed (200)
    // -------------------------------------------------------------
    console.log('4️⃣ Testing /api/status with valid admin password header...');
    const res4 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/status',
      method: 'GET',
      headers: { 'X-API-Key': adminPassword }
    });
    assert.strictEqual(res4.status, 200, 'Expected 200 OK for status with admin password');
    assert.strictEqual(res4.data.version, 'v3.4.2');
    console.log(`   ✅ Passed: Status returned successfully (Version: ${res4.data.version})`);

    // -------------------------------------------------------------
    // Test 5: In-cabinet API key update via POST /api/auth/update-key MUST succeed (200)
    // -------------------------------------------------------------
    console.log('5️⃣ Testing in-cabinet Gemini API key update (/api/auth/update-key)...');
    const newTestKey = 'mock_new_gemini_key_67890';
    const res5 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/update-key',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': adminPassword
      }
    }, { newApiKey: newTestKey });

    assert.strictEqual(res5.status, 200, 'Expected 200 OK for key update');
    assert.strictEqual(res5.data.success, true);
    assert.strictEqual(res5.data.user.apiKey, newTestKey);

    // Verify /api/status returns the updated geminiApiKey
    const res5b = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/status',
      method: 'GET',
      headers: { 'X-API-Key': adminPassword }
    });
    assert.strictEqual(res5b.status, 200);
    assert.strictEqual(res5b.data.geminiApiKey, newTestKey);
    console.log('   ✅ Passed: Successfully updated Gemini API key in personal cabinet!');

    // -------------------------------------------------------------
    // Test 6: Brute force protection on login attempts
    // -------------------------------------------------------------
    console.log('6️⃣ Testing brute-force rate limiter on login endpoint...');
    let hitRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const rateRes = await makeRequest({
        hostname: 'localhost',
        port: 3099,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.1.50' }
      }, { password: 'wrong_' + i });

      if (rateRes.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assert.ok(hitRateLimit, 'Expected 429 Too Many Requests after excessive failed login attempts');
    console.log('   ✅ Passed: Rate limiter actively blocked brute-force attempts with HTTP 429.');

    console.log('\n🎉 ALL SECURITY, RATE LIMITING & PASSWORD-ONLY TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
    if (originalDb !== null) {
      try {
        fs.writeFileSync(usersDbPath, originalDb, 'utf-8');
      } catch (e) {}
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
