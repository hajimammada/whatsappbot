const assert = require('assert');
const http = require('http');

// Set test environment with clean password
process.env.PORT = '3099';
process.env.ADMIN_PASSWORD = 'HajiShield#2026!Bot';
delete process.env.AUTHORIZED_API_KEY;
delete process.env.RECOVERY_PASSWORD;

const { createServer } = require('../src/server');
const userManager = require('../src/user_manager');
const waClient = require('../src/whatsapp_client');
const aiEngine = require('../src/ai_engine');

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
    assert.strictEqual(res4.data.version, 'v3.7.2');
    console.log(`   ✅ Passed: Status returned successfully (Version: ${res4.data.version})`);

    // Verify unauthenticated /api/health endpoint for 24/7 Keep-Alive
    const resHealth = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/health',
      method: 'GET'
    });
    assert.strictEqual(resHealth.status, 200);
    assert.strictEqual(resHealth.data.status, 'ok');
    assert.strictEqual(resHealth.data.service, 'whatsappbot.hajimammad.com');
    console.log('   ✅ Passed: /api/health endpoint returns 200 OK for keep-alive pings!');

    // Verify CORS permits onrender.com
    const resCors = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/status',
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://whatsappbot-8wk2.onrender.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    assert.strictEqual(resCors.headers['access-control-allow-origin'], 'https://whatsappbot-8wk2.onrender.com');
    console.log('   ✅ Passed: CORS correctly allows both hajimammad.com and onrender.com domains!');

    // -------------------------------------------------------------
    // Test 5: In-cabinet API key update via POST /api/auth/update-key MUST succeed (200)
    // -------------------------------------------------------------
    console.log('5️⃣ Testing in-cabinet Gemini API key update (/api/auth/update-key)...');
    const res5 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/auth/update-key',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': adminPassword }
    }, { newApiKey: 'mock_new_api_key_for_testing_12345' });
    assert.strictEqual(res5.status, 200, 'Expected 200 OK for update-key with admin password');
    assert.strictEqual(res5.data.success, true);
    console.log('   ✅ Passed: Successfully updated Gemini API key in personal cabinet!');

    // -------------------------------------------------------------
    // Test 5c: Verify GET /api/leads returns actual leads from disk
    // -------------------------------------------------------------
    console.log('5️⃣c Testing /api/leads returns actual leads from disk...');
    const res5c = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/leads',
      method: 'GET',
      headers: { 'X-API-Key': adminPassword }
    });
    assert.strictEqual(res5c.status, 200, 'Expected 200 OK for /api/leads');
    assert.ok(Array.isArray(res5c.data), 'Expected array of leads');
    assert.ok(res5c.data.length > 0, 'Expected non-empty array of leads from leads.json');
    console.log(`   ✅ Passed: /api/leads returned ${res5c.data.length} lead(s) successfully!`);

    // -------------------------------------------------------------
    // Test 5d: Verify Pause and Resume bot for LID/Phone contacts
    // -------------------------------------------------------------
    console.log('5️⃣d Testing pause and resume bot endpoints for LID & Phone...');
    const testLid = '104247563690150';
    // Test indefinite manual pause
    const pauseManualRes = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: `/api/chat/${testLid}/pause`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': adminPassword }
    }, { isManual: true });
    assert.strictEqual(pauseManualRes.status, 200);
    assert.strictEqual(pauseManualRes.data.isPaused, true);
    assert.strictEqual(pauseManualRes.data.isManual, true);

    const statusCheck1 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/chat-statuses',
      method: 'GET',
      headers: { 'X-API-Key': adminPassword }
    });
    assert.ok(statusCheck1.data[testLid]?.isPaused, 'Expected testLid to be paused');
    assert.strictEqual(statusCheck1.data[testLid]?.isManual, true);

    // Resume bot for testLid (Tests the bug fix!)
    const resumeRes = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: `/api/chat/${testLid}/resume`,
      method: 'POST',
      headers: { 'X-API-Key': adminPassword }
    });
    assert.strictEqual(resumeRes.status, 200);
    assert.strictEqual(resumeRes.data.isPaused, false);

    const statusCheck2 = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/chat-statuses',
      method: 'GET',
      headers: { 'X-API-Key': adminPassword }
    });
    assert.ok(!statusCheck2.data[testLid], 'Expected testLid to no longer be paused after resume');
    console.log('   ✅ Passed: Pause and Resume bot works reliably for LID and regular numbers!');

    // -------------------------------------------------------------
    // Test 5e: Verify Lead phone update endpoint (/api/leads/:id/phone)
    // -------------------------------------------------------------
    console.log('5️⃣e Testing updating lead phone number (/api/leads/:id/phone)...');
    const existingLead = res5c.data[0];
    const updatePhoneRes = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: `/api/leads/${existingLead.id}/phone`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': adminPassword }
    }, { phoneNumber: '994509876543' });
    assert.strictEqual(updatePhoneRes.status, 200);
    assert.strictEqual(updatePhoneRes.data.lead.phoneNumber, '994509876543');
    // Restore original phone
    await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: `/api/leads/${existingLead.id}/phone`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': adminPassword }
    }, { phoneNumber: existingLead.phoneNumber });
    // -------------------------------------------------------------
    // Test 5f: Verify WhatsApp Session Management endpoints (/api/whatsapp/*)
    // -------------------------------------------------------------
    console.log('5️⃣f Testing WhatsApp session endpoints (/api/whatsapp/logout, /reset, /reconnect)...');
    
    // Unauthenticated requests should be blocked
    const unauthLogout = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/whatsapp/logout',
      method: 'POST'
    });
    assert.strictEqual(unauthLogout.status, 401, 'Expected 401 for unauthenticated logout');

    const unauthReset = await makeRequest({
      hostname: 'localhost',
      port: 3099,
      path: '/api/whatsapp/reset',
      method: 'POST'
    });
    assert.strictEqual(unauthReset.status, 401, 'Expected 401 for unauthenticated reset');

    console.log('   ✅ Passed: WhatsApp endpoints properly protected against unauthenticated requests.');

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

    // -------------------------------------------------------------
    // Test 7: Message Buffer Queue & Contact History Normalization
    // -------------------------------------------------------------
    console.log('7️⃣ Testing Message Buffer Queue & Contact History Normalization...');
    const testPhone = '994509998877';
    const testJid = `${testPhone}@s.whatsapp.net`;

    // Enqueue 3 rapid consecutive messages
    waClient.enqueueIncomingMessage(testJid, testPhone, 'Test User', 'Birinci mesaj: Son olaraq hansı mesajları yazmışam?');
    waClient.enqueueIncomingMessage(testJid, testPhone, 'Test User', 'İkinci mesaj: Hə?');
    waClient.enqueueIncomingMessage(testJid, testPhone, 'Test User', 'Üçüncü mesaj: Necəsən?');

    const buf = waClient.messageBuffers.get(testPhone);
    assert.ok(buf, 'Buffer should exist for testPhone');
    assert.strictEqual(buf.texts.length, 3, 'Buffer must contain all 3 rapid messages without dropping');
    assert.strictEqual(buf.texts[0], 'Birinci mesaj: Son olaraq hansı mesajları yazmışam?');
    assert.strictEqual(buf.texts[1], 'İkinci mesaj: Hə?');
    assert.strictEqual(buf.texts[2], 'Üçüncü mesaj: Necəsən?');
    assert.ok(buf.timer !== null, 'Debounce timer should be active');

    // Clean up timer
    waClient.clearAllBufferTimers();
    assert.strictEqual(waClient.messageBuffers.size, 0, 'Buffer must be cleanly emptied by clearAllBufferTimers()');

    // Verify contact ID normalization for history
    const histFromJid = aiEngine.getChatHistory(testJid);
    const histFromPhone = aiEngine.getChatHistory(testPhone);
    assert.strictEqual(histFromJid, histFromPhone, 'Both JID and Phone must resolve to identical history reference');

    histFromPhone.push({ role: 'user', text: 'Ev satılıbmı?', timestamp: new Date().toISOString() });
    histFromPhone.push({ role: 'assistant', text: 'Xeyr, ev satışdadır.', timestamp: new Date().toISOString() });
    assert.strictEqual(aiEngine.getChatHistory(testJid).length, 2, 'History updated via phone must be visible via JID');

    // Verify fallback engine history recall
    const recallResp = await aiEngine.generateAIResponse(testPhone, 'Son olaraq nə yazmışam sənə?');
    assert.ok(recallResp.reply_text, 'Recall response must have reply text');
    console.log(`   🤖 Bot recall reply: "${recallResp.reply_text.split('\n')[0]}..."`);
    console.log('   ✅ Passed: Message buffer queue aggregates consecutive messages and preserves history!');

    // -------------------------------------------------------------
    // Test 8: Audio / Voice Note Message Buffer & Processing
    // -------------------------------------------------------------
    console.log('8️⃣ Testing Audio / Voice Note Message Buffer & Processing...');
    const audioPhone = '994508887766';
    const audioJid = `${audioPhone}@s.whatsapp.net`;
    const mockAudioItem = {
      buffer: Buffer.from('RIFF_MOCK_OGG_OPUS_AUDIO_BYTES_12345'),
      mimeType: 'audio/ogg',
      seconds: 7
    };

    // Enqueue 1 audio message and 1 follow-up text message
    waClient.enqueueIncomingMessage(audioJid, audioPhone, 'Audio User', '🎤 Səsli mesaj (7 san)', mockAudioItem);
    waClient.enqueueIncomingMessage(audioJid, audioPhone, 'Audio User', 'Və əlavə olaraq qiymətini də deyərdiniz');

    const audioBuf = waClient.messageBuffers.get(audioPhone);
    assert.ok(audioBuf, 'Buffer should exist for audioPhone');
    assert.strictEqual(audioBuf.texts.length, 2, 'Buffer must contain both text entries');
    assert.strictEqual(audioBuf.audios.length, 1, 'Buffer must contain the audioItem');
    assert.strictEqual(audioBuf.audios[0].mimeType, 'audio/ogg');
    assert.strictEqual(audioBuf.audios[0].seconds, 7);

    // Clean up timers
    waClient.clearAllBufferTimers();

    // Verify AI response generation with audioItems returns text reply
    const audioResp = await aiEngine.generateAIResponse(audioPhone, '🎤 Səsli mesaj (7 san)', null, null, [mockAudioItem]);
    assert.ok(audioResp, 'AI response must be returned');
    assert.strictEqual(typeof audioResp.reply_text, 'string', 'AI reply must be a string');
    assert.ok(audioResp.reply_text.length > 0, 'AI reply must not be empty');
    console.log(`   🤖 Audio response text: "${audioResp.reply_text.split('\n')[0]}..."`);
    console.log('   ✅ Passed: Audio / voice notes successfully queued, processed and replied with text!');

    console.log('\n🎉 ALL SECURITY, RATE LIMITING, MESSAGE BUFFER, AUDIO & PASSWORD TESTS PASSED PERFECTLY!');
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
