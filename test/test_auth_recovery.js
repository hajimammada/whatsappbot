const assert = require('assert');
const http = require('http');

// Set test environment
process.env.PORT = '3099';
process.env.AUTHORIZED_API_KEY = 'mock_authorized_gemini_key_for_testing_12345';
process.env.RECOVERY_PASSWORD = 'HajiRecover2026!';

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

async function runTests() {
  console.log('🧪 Starting Dual-Password Authentication & Whitelist Tests...\n');

  const app = createServer();
  const server = app.listen(3099);

  try {
    const authorizedKey = 'mock_authorized_gemini_key_for_testing_12345';
    const recoveryPass = 'HajiRecover2026!';
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
    // Test 2: Login with wrong pass MUST be rejected (401)
    // -------------------------------------------------------------
    console.log('2️⃣ Testing login with wrong key or password...');
    const res2 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { apiKey: wrongPass });

    assert.strictEqual(res2.status, 401, 'Expected 401 Unauthorized for wrong key/password');
    assert.ok(res2.data.error.includes('Yanlış API açar') || res2.data.error.includes('Wrong API key'), 'Error should state Wrong API key or password');
    console.log(`   ✅ Passed: Rejected wrong input with message: "${res2.data.error}"`);

    // -------------------------------------------------------------
    // Test 3: Login with Main API key MUST succeed (200)
    // -------------------------------------------------------------
    console.log('3️⃣ Testing login with Primary Authorized API key...');
    const res3 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { apiKey: authorizedKey });

    assert.strictEqual(res3.status, 200, 'Expected 200 OK for authorized key');
    assert.strictEqual(res3.data.user.apiKey, authorizedKey);
    console.log('   ✅ Passed: Successfully authenticated primary authorized key!');

    // -------------------------------------------------------------
    // Test 4: Login with Second Recovery Password in the exact same field MUST succeed (200)
    // -------------------------------------------------------------
    console.log('4️⃣ Testing login with Second Recovery Password in the same API key field...');
    const res4 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { apiKey: recoveryPass });

    assert.strictEqual(res4.status, 200, 'Expected 200 OK for recovery password');
    assert.strictEqual(res4.data.user.apiKey, authorizedKey, 'Recovery password should map to primary user account');
    console.log(`   ✅ Passed: Recovery password successfully logged into primary user cabinet! (Resolved to: ${res4.data.user.apiKey})`);

    // -------------------------------------------------------------
    // Test 5: Access protected /api/status with authorized header MUST succeed (200)
    // -------------------------------------------------------------
    console.log('5️⃣ Testing /api/status with valid X-API-Key header...');
    const res5 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/status',
      method: 'GET',
      headers: { 'X-API-Key': authorizedKey }
    });
    assert.strictEqual(res5.status, 200, 'Expected 200 OK for status with authorized key');
    assert.ok(res5.data.version, 'Response should contain version info');
    console.log(`   ✅ Passed: Status returned successfully (Version: ${res5.data.version})`);

    // -------------------------------------------------------------
    // Test 6: Access protected /api/status with Second Recovery Password in header MUST succeed (200)
    // -------------------------------------------------------------
    console.log('6️⃣ Testing /api/status with Second Recovery Password in X-API-Key header...');
    const res6 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/status',
      method: 'GET',
      headers: { 'X-API-Key': recoveryPass }
    });
    assert.strictEqual(res6.status, 200, 'Expected 200 OK for status with recovery password');
    console.log('   ✅ Passed: Status accessible using second recovery password.');

    console.log('\n🎉 ALL DUAL-PASSWORD AUTHENTICATION TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
