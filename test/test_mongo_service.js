const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoService = require('../src/mongo_service');
const { createServer } = require('../src/server');

async function runMongoTests() {
  console.log('🧪 Starting MongoDB Atlas Persistence & Session Tests...\n');

  // 1. Test Session Serialization & Restoration Roundtrip
  console.log('1️⃣ Testing Baileys session serialization and restoration...');
  const testAuthDir = path.join(__dirname, '..', 'auth_info_baileys');
  if (!fs.existsSync(testAuthDir)) fs.mkdirSync(testAuthDir, { recursive: true });

  const mockCredFile = path.join(testAuthDir, 'test_mongo_creds.json');
  const mockKeyFile = path.join(testAuthDir, 'test_mongo_key.bin');

  fs.writeFileSync(mockCredFile, JSON.stringify({ me: { id: '994509990011:1@s.whatsapp.net' } }));
  fs.writeFileSync(mockKeyFile, Buffer.from([0x0A, 0x0B, 0x0C]));

  const bundle = mongoService._serializeSession();
  assert(bundle, 'Session bundle must be created');
  assert(bundle['test_mongo_creds.json'], 'Credentials file must be in bundle');

  // Clean local files
  fs.unlinkSync(mockCredFile);
  fs.unlinkSync(mockKeyFile);

  // Restore
  const restored = mongoService._restoreSession(bundle);
  assert(restored >= 2, `Expected at least 2 restored files, got ${restored}`);
  assert(fs.existsSync(mockCredFile));
  assert(fs.existsSync(mockKeyFile));

  // Verify contents
  const parsedCred = JSON.parse(fs.readFileSync(mockCredFile, 'utf-8'));
  assert.strictEqual(parsedCred.me.id, '994509990011:1@s.whatsapp.net');

  // Cleanup test files
  fs.unlinkSync(mockCredFile);
  fs.unlinkSync(mockKeyFile);
  console.log('   ✅ Passed: Multi-file WhatsApp Baileys session serialization and restoration works perfectly!');

  // 2. Test Live MongoDB Atlas Connection
  console.log('2️⃣ Testing live connection to MongoDB Atlas cluster...');
  const connected = await mongoService.init();
  assert.strictEqual(connected, true, 'Must connect to MongoDB Atlas');
  assert.strictEqual(mongoService.isConnected, true);
  console.log('   ✅ Passed: Successfully connected to MongoDB Atlas cluster!');

  // 3. Test Sync Leads & Users to MongoDB
  console.log('3️⃣ Testing live sync of leads and users database to MongoDB...');
  const mockLead = {
    id: 'test_lead_mongo_001',
    phoneNumber: '994501112233',
    name: 'MongoDB Test User',
    lastMessage: 'Salam, baza yoxlanışı',
    status: 'new'
  };

  await mongoService.syncLeads([mockLead]);
  const leadsCol = mongoService.db.collection('leads');
  const found = await leadsCol.findOne({ id: 'test_lead_mongo_001' });
  assert(found, 'Lead must be found in MongoDB');
  assert.strictEqual(found.phoneNumber, '994501112233');

  // Clean test lead
  await leadsCol.deleteOne({ id: 'test_lead_mongo_001' });
  console.log('   ✅ Passed: Real-time lead sync and query on MongoDB Atlas works flawlessly!');

  // 4. Test HTTP Endpoints (/api/backup/status and /api/backup/now)
  console.log('4️⃣ Testing /api/backup/status and /api/backup/now HTTP endpoints...');
  process.env.ADMIN_PASSWORD = 'HajiShield#2026!Bot';
  const app = createServer();
  const server = app.listen(3097);

  const makeReq = (options) => new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, raw: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });

  try {
    const resStatus = await makeReq({
      hostname: 'localhost',
      port: 3097,
      path: '/api/backup/status',
      method: 'GET',
      headers: { 'X-API-Key': 'HajiShield#2026!Bot' }
    });
    assert.strictEqual(resStatus.status, 200);
    assert.strictEqual(resStatus.data.connected, true);
    assert.strictEqual(resStatus.data.provider, 'MongoDB Atlas');

    const resSyncNow = await makeReq({
      hostname: 'localhost',
      port: 3097,
      path: '/api/backup/now',
      method: 'POST',
      headers: { 'X-API-Key': 'HajiShield#2026!Bot' }
    });
    assert.strictEqual(resSyncNow.status, 200);
    assert.strictEqual(resSyncNow.data.success, true);
    console.log('   ✅ Passed: Dashboard API endpoints reflect MongoDB Atlas connection and manual sync!');
  } finally {
    server.close();
  }

  // Close mongo connection for clean test exit
  if (mongoService.client) {
    await mongoService.client.close();
  }

  console.log('\n🎉 ALL MONGODB ATLAS PERSISTENCE TESTS PASSED PERFECTLY!');
}

runMongoTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
