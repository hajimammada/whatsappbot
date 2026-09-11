const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Set test environment
process.env.PORT = '3099';
process.env.AUTHORIZED_API_KEY = 'mock_authorized_gemini_key_for_testing_12345';
process.env.RECOVERY_EMAIL = 'hajimammada@gmail.com';

const { createServer } = require('../src/server');
const recoveryManager = require('../src/recovery_manager');
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
  console.log('🧪 Starting Authentication Whitelist & One-Time Email Recovery Tests...\n');

  const app = createServer();
  const server = app.listen(3099);

  try {
    const authorizedKey = 'mock_authorized_gemini_key_for_testing_12345';
    const unauthorizedKey = 'mock_unauthorized_key_should_fail_99999';

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
    // Test 2: Login with unauthorized key MUST be rejected (401 / Wrong API key)
    // -------------------------------------------------------------
    console.log('2️⃣ Testing login with unauthorized API key...');
    const res2 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { apiKey: unauthorizedKey });

    assert.strictEqual(res2.status, 401, 'Expected 401 Unauthorized for unauthorized key');
    assert.ok(res2.data.error.includes('Yanlış API açar') || res2.data.error.includes('Wrong API key'), 'Error should state Wrong API key');
    console.log(`   ✅ Passed: Rejected unauthorized key with message: "${res2.data.error}"`);

    // -------------------------------------------------------------
    // Test 3: Login with authorized key MUST succeed (200)
    // -------------------------------------------------------------
    console.log('3️⃣ Testing login with authorized API key...');
    const res3 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { apiKey: authorizedKey });

    assert.strictEqual(res3.status, 200, 'Expected 200 OK for authorized key');
    assert.strictEqual(res3.data.user.apiKey, authorizedKey);
    console.log('   ✅ Passed: Successfully authenticated authorized key!');

    // -------------------------------------------------------------
    // Test 4: Access protected /api/status with authorized header MUST succeed (200)
    // -------------------------------------------------------------
    console.log('4️⃣ Testing /api/status with valid X-API-Key header...');
    const res4 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/status',
      method: 'GET',
      headers: { 'X-API-Key': authorizedKey }
    });
    assert.strictEqual(res4.status, 200, 'Expected 200 OK for status with authorized key');
    assert.ok(res4.data.version, 'Response should contain version info');
    console.log(`   ✅ Passed: Status returned successfully (Version: ${res4.data.version})`);

    // -------------------------------------------------------------
    // Test 5: Recovery Email Dispatch endpoint
    // -------------------------------------------------------------
    console.log('5️⃣ Testing recovery email request endpoint...');
    const res5 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/recover-request',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(res5.status, 200, 'Expected 200 OK for recovery request');
    assert.strictEqual(res5.data.success, true);
    assert.strictEqual(res5.data.targetEmail, 'hajimammada@gmail.com');
    console.log(`   ✅ Passed: Recovery request dispatched to ${res5.data.targetEmail}`);

    // -------------------------------------------------------------
    // Test 6: One-Time Token Verification & Single-Use Enforcement
    // -------------------------------------------------------------
    console.log('6️⃣ Testing One-Time Token generation & verification...');
    const { token } = recoveryManager.createRecoveryToken('http://localhost:3099');

    // Verify token validity
    const res6 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: `/api/auth/verify-token?token=${token}`,
      method: 'GET'
    });
    assert.strictEqual(res6.status, 200);
    assert.strictEqual(res6.data.valid, true);
    console.log('   ✅ Passed: Token verified successfully.');

    // Test invalid / expired token
    const res7 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: `/api/auth/verify-token?token=invalid_fake_token_xyz`,
      method: 'GET'
    });
    assert.strictEqual(res7.status, 400);
    assert.strictEqual(res7.data.valid, false);
    console.log('   ✅ Passed: Fake token was rejected.');

    // Consume the token
    recoveryManager.consumeRecoveryToken(token);

    // Verify token again after consumption -> MUST FAIL
    const res8 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: `/api/auth/verify-token?token=${token}`,
      method: 'GET'
    });
    assert.strictEqual(res8.status, 400);
    assert.strictEqual(res8.data.valid, false);
    assert.ok(res8.data.error.includes('artıq istifadə olunub') || res8.data.error.includes('already used'));
    console.log('   ✅ Passed: Consumed token cannot be reused (Single-use guarantee strictly enforced).');

    console.log('\n🎉 ALL AUTHENTICATION & RECOVERY TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
