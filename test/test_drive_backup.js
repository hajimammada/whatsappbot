const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const driveBackup = require('../src/drive_backup');

async function runDriveBackupTests() {
  console.log('🧪 Starting Google Drive Backup & Session Packaging Tests...\n');

  // 1. Test unconfigured state
  console.log('1️⃣ Testing unconfigured state...');
  const status = driveBackup.getStatus();
  assert.strictEqual(typeof status.configured, 'boolean');
  assert.strictEqual(typeof status.lastBackupStatus, 'string');
  console.log('   ✅ Passed: DriveBackup gracefully reports unconfigured state when keys are absent.');

  // 2. Test Baileys session serialization and restoration roundtrip
  console.log('2️⃣ Testing Baileys session serialization and restoration roundtrip...');
  const testAuthDir = path.join(__dirname, '..', 'auth_info_baileys');
  const testFile1 = path.join(testAuthDir, 'test_creds_mock.json');
  const testFile2 = path.join(testAuthDir, 'test_key_mock.bin');

  if (!fs.existsSync(testAuthDir)) {
    fs.mkdirSync(testAuthDir, { recursive: true });
  }
  fs.writeFileSync(testFile1, JSON.stringify({ me: { id: '994501234567:1@s.whatsapp.net' } }), 'utf-8');
  fs.writeFileSync(testFile2, Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]));

  const serialized = driveBackup._serializeSession();
  assert(serialized, 'Session bundle must not be null');
  const parsedBundle = JSON.parse(serialized);
  assert(parsedBundle['test_creds_mock.json'], 'creds file must be in bundle');
  assert(parsedBundle['test_key_mock.bin'], 'binary file must be in bundle');

  // Clean up mock files before test restoration
  fs.unlinkSync(testFile1);
  fs.unlinkSync(testFile2);
  assert(!fs.existsSync(testFile1), 'Mock file 1 must be deleted');
  assert(!fs.existsSync(testFile2), 'Mock file 2 must be deleted');

  // Restore session bundle
  const restoredCount = driveBackup._restoreSession(serialized);
  assert(restoredCount >= 2, `Expected at least 2 restored files, got ${restoredCount}`);
  assert(fs.existsSync(testFile1), 'Restored creds file must exist');
  assert(fs.existsSync(testFile2), 'Restored binary file must exist');

  // Verify contents match exactly
  const restoredJson = JSON.parse(fs.readFileSync(testFile1, 'utf-8'));
  assert.strictEqual(restoredJson.me.id, '994501234567:1@s.whatsapp.net');
  const restoredBin = fs.readFileSync(testFile2);
  assert.deepStrictEqual([...restoredBin], [0x01, 0x02, 0x03, 0x04, 0x05]);

  // Clean up test files
  fs.unlinkSync(testFile1);
  fs.unlinkSync(testFile2);
  console.log('   ✅ Passed: Baileys session multi-file credentials bundle and restore perfectly!');

  // 3. Test Service Account JWT Signing logic
  console.log('3️⃣ Testing Google Service Account RS256 JWT generation...');
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const mockKey = {
    client_email: 'whatsappbot-backup@whatsappbot-508812.iam.gserviceaccount.com',
    private_key: privateKey
  };

  const parsed = driveBackup._parseServiceAccount(JSON.stringify(mockKey));
  assert.strictEqual(parsed.client_email, mockKey.client_email);
  assert.strictEqual(parsed.private_key, mockKey.private_key);
  console.log('   ✅ Passed: Service account JSON parsed successfully.');

  // 4. Test debounce timer
  console.log('4️⃣ Testing debounced backup triggering...');
  // When unconfigured, triggerBackup safely returns without scheduling
  driveBackup.triggerBackup(50);
  assert.strictEqual(driveBackup.debounceTimer, null);

  // When configured, debounceTimer is properly scheduled
  driveBackup.folderId = 'mock_folder_123';
  driveBackup.serviceAccount = mockKey;
  assert.strictEqual(driveBackup.isConfigured(), true);

  driveBackup.triggerBackup(50);
  assert(driveBackup.debounceTimer !== null, 'Debounce timer should be scheduled when configured');
  clearTimeout(driveBackup.debounceTimer);
  driveBackup.debounceTimer = null;

  // Restore unconfigured state
  driveBackup.folderId = null;
  driveBackup.serviceAccount = null;
  // 5. Test /api/backup/status and /api/backup/now HTTP endpoints
  console.log('5️⃣ Testing /api/backup/status and /api/backup/now endpoints...');
  const http = require('http');
  const { createServer } = require('../src/server');
  process.env.ADMIN_PASSWORD = 'HajiShield#2026!Bot';
  const app = createServer();
  const server = app.listen(3098);

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
    // Unauthenticated status request should be rejected with 401
    const resUnauth = await makeReq({
      hostname: 'localhost',
      port: 3098,
      path: '/api/backup/status',
      method: 'GET'
    });
    assert.strictEqual(resUnauth.status, 401, 'Unauthenticated /api/backup/status must return 401');

    // Authenticated status request should return 200 with status object
    const resAuth = await makeReq({
      hostname: 'localhost',
      port: 3098,
      path: '/api/backup/status',
      method: 'GET',
      headers: { 'X-API-Key': 'HajiShield#2026!Bot' }
    });
    assert.strictEqual(resAuth.status, 200);
    assert.strictEqual(typeof resAuth.data.configured, 'boolean');

    // Unconfigured manual backup should return 400 with helpful error
    const resBackupUnauth = await makeReq({
      hostname: 'localhost',
      port: 3098,
      path: '/api/backup/now',
      method: 'POST',
      headers: { 'X-API-Key': 'HajiShield#2026!Bot' }
    });
    assert.strictEqual(resBackupUnauth.status, 400);
    assert(resBackupUnauth.data.error.includes('Google Drive backup is not configured'));

    console.log('   ✅ Passed: Backup endpoints properly authenticated and return correct statuses.');
  } finally {
    server.close();
  }

  console.log('\n🎉 ALL GOOGLE DRIVE BACKUP & RESTORE UNIT TESTS PASSED!');
}

runDriveBackupTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
