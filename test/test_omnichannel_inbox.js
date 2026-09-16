const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

process.env.PORT = '3098';
process.env.ADMIN_PASSWORD = 'HajiShield#2026!Bot';
process.env.META_VERIFY_TOKEN = 'test_meta_verify_token_123';

const { createServer } = require('../src/server');
const waClient = require('../src/whatsapp_client');
const metaService = require('../src/meta_service');
const { recordLead, appendOperatorMessage, getLeads } = require('../src/lead_manager');

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

async function runOmnichannelTests() {
  console.log('🧪 Starting Omnichannel Unified Inbox & Meta Service Tests...\n');
  const app = createServer();
  const server = app.listen(3098);

  try {
    const adminPassword = 'HajiShield#2026!Bot';

    // -------------------------------------------------------------
    // Test 1: Record leads with platform tracking ('whatsapp', 'instagram', 'facebook')
    // -------------------------------------------------------------
    console.log('1️⃣ Testing recordLead across WhatsApp, Instagram, and Facebook...');
    const waLead = await recordLead('994501112233', 'Salam, ev satılır?', null, 'Ali Mammadov', null, 'whatsapp');
    assert.strictEqual(waLead.platform, 'whatsapp');
    assert.strictEqual(waLead.phoneNumber, '994501112233');

    const igLead = await recordLead('ig_user_445566', 'Salam, qiymət neçəyədir?', null, 'Leyla Aliyeva', null, 'instagram', 'ig_user_445566');
    assert.strictEqual(igLead.platform, 'instagram');
    assert.strictEqual(igLead.platformId, 'ig_user_445566');

    const fbLead = await recordLead('fb_psid_778899', 'Salam, çatdırılma var?', null, 'Rashad Guliyev', null, 'facebook', 'fb_psid_778899');
    assert.strictEqual(fbLead.platform, 'facebook');
    assert.strictEqual(fbLead.platformId, 'fb_psid_778899');
    console.log('   ✅ Passed: All 3 platforms recorded properly with distinct IDs and badges!');

    // -------------------------------------------------------------
    // Test 2: appendOperatorMessage appends operator message to lead history
    // -------------------------------------------------------------
    console.log('2️⃣ Testing appendOperatorMessage for manual operator replies...');
    const updatedLead = appendOperatorMessage('994501112233', 'Salam Ali bəy, bəli ev satışdadır.');
    assert.ok(updatedLead);
    assert.ok(updatedLead.messages.some(m => m.text.includes('bəli ev satışdadır') && m.operator === true && m.from === 'me'));
    console.log('   ✅ Passed: Operator reply appended to history with operator flag!');

    // -------------------------------------------------------------
    // Test 3: WhatsAppClient.sendManualMessage pauses bot and logs message
    // -------------------------------------------------------------
    console.log('3️⃣ Testing WhatsAppClient.sendManualMessage...');
    const manualRes = await waClient.sendManualMessage('994501112233', 'Bizimlə əlaqə saxladığınız üçün təşəkkür edirik!');
    assert.strictEqual(manualRes.success, true);
    // Check that bot is paused for this number
    const chatStatuses = waClient.getAllChatStatuses();
    assert.ok(chatStatuses['994501112233']?.isPaused, 'Expected bot to be paused after operator reply');
    console.log('   ✅ Passed: Manual operator message pauses bot and updates chat status!');

    // -------------------------------------------------------------
    // Test 4: POST /api/inbox/reply (Unified Inbox API)
    // -------------------------------------------------------------
    console.log('4️⃣ Testing POST /api/inbox/reply endpoint...');
    // Unauthenticated should fail
    const unauthReply = await makeRequest({
      hostname: 'localhost',
      port: 3098,
      path: '/api/inbox/reply',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { targetId: '994501112233', text: 'Salam' });
    assert.strictEqual(unauthReply.status, 401);

    // Authenticated reply for WhatsApp lead
    const authReply = await makeRequest({
      hostname: 'localhost',
      port: 3098,
      path: '/api/inbox/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': adminPassword
      }
    }, { leadId: waLead.id, targetId: '994501112233', text: 'Zəhmət olmasa baxış saatını seçin', platform: 'whatsapp' });
    assert.strictEqual(authReply.status, 200);
    assert.strictEqual(authReply.data.success, true);
    assert.strictEqual(authReply.data.platform, 'whatsapp');

    // Authenticated reply for Instagram lead (gracefully logs in history when no token)
    const authIgReply = await makeRequest({
      hostname: 'localhost',
      port: 3098,
      path: '/api/inbox/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': adminPassword
      }
    }, { leadId: igLead.id, targetId: 'ig_user_445566', text: 'Qiymət 150 AZN-dir.', platform: 'instagram' });
    assert.strictEqual(authIgReply.status, 200);
    assert.strictEqual(authIgReply.data.success, true);
    assert.strictEqual(authIgReply.data.platform, 'instagram');
    console.log('   ✅ Passed: /api/inbox/reply works cleanly for WhatsApp and Instagram!');

    // -------------------------------------------------------------
    // Test 5: Meta Webhook Handshake Verification (GET /api/webhook/meta)
    // -------------------------------------------------------------
    console.log('5️⃣ Testing Meta Webhook Verification (hub.challenge)...');
    metaService.verifyToken = 'test_meta_verify_token_123';

    // Invalid token returns 403
    const badVerify = await makeRequest({
      hostname: 'localhost',
      port: 3098,
      path: '/api/webhook/meta?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=11223344',
      method: 'GET'
    });
    assert.strictEqual(badVerify.status, 403);

    // Valid token returns challenge
    const goodVerify = await makeRequest({
      hostname: 'localhost',
      port: 3098,
      path: '/api/webhook/meta?hub.mode=subscribe&hub.verify_token=test_meta_verify_token_123&hub.challenge=test_challenge_success',
      method: 'GET'
    });
    assert.strictEqual(goodVerify.status, 200);
    assert.strictEqual(goodVerify.raw, 'test_challenge_success');
    console.log('   ✅ Passed: Meta Webhook handshake verified correctly!');

    // -------------------------------------------------------------
    // Test 6: Meta Webhook Ingestion (POST /api/webhook/meta)
    // -------------------------------------------------------------
    console.log('6️⃣ Testing Meta Webhook Message Ingestion...');
    const metaWebhookPayload = {
      object: 'instagram',
      entry: [{
        id: '17841400000000000',
        time: Date.now(),
        messaging: [{
          sender: { id: 'ig_customer_999' },
          recipient: { id: '17841400000000000' },
          timestamp: Date.now(),
          message: {
            mid: 'm_test_mid_123',
            text: 'Salam, Instagram üzərindən yazıram.'
          }
        }]
      }]
    };

    const webhookRes = await makeRequest({
      hostname: 'localhost',
      port: 3098,
      path: '/api/webhook/meta',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, metaWebhookPayload);
    assert.strictEqual(webhookRes.status, 200);
    assert.strictEqual(webhookRes.raw, 'EVENT_RECEIVED');
    console.log('   ✅ Passed: Meta Webhook events successfully ingested!');

    // -------------------------------------------------------------
    // Test 7: /api/status includes Meta configuration details
    // -------------------------------------------------------------
    console.log('7️⃣ Testing /api/status includes Meta service status...');
    const statusRes = await makeRequest({
      hostname: 'localhost',
      port: 3098,
      path: '/api/status',
      method: 'GET',
      headers: { 'X-API-Key': adminPassword }
    });
    assert.strictEqual(statusRes.status, 200);
    assert.ok(statusRes.data.meta);
    assert.strictEqual(typeof statusRes.data.meta.configured, 'boolean');
    assert.strictEqual(statusRes.data.meta.verifyTokenConfigured, true);
    console.log('   ✅ Passed: /api/status includes Meta service details!');

    console.log('\n🎉 ALL OMNICHANNEL INBOX & META SERVICE TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runOmnichannelTests().catch(err => {
    console.error('❌ Omnichannel Test Failed:', err);
    process.exit(1);
  });
}

module.exports = { runOmnichannelTests };
