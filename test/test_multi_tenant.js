require('dotenv').config();
const assert = require('assert');
const userManager = require('../src/user_manager');
const { validateGeminiApiKey } = require('../src/ai_engine');

async function runMultiTenantTests() {
  console.log('==================================================');
  console.log('🧪 RUNNING GEMINI BYOK & MULTI-TENANT AUTH TESTS');
  console.log('==================================================\n');

  // Test 1: Fake / Random Key is REJECTED by Gemini Live Validation
  console.log('Test 1: Testing rejection of fake/random key ("random_gibberish_fake_123")...');
  const fakeValidation = await validateGeminiApiKey('random_gibberish_fake_123');
  assert(fakeValidation.valid === false, 'Fake key must be rejected');
  console.log(`✅ Fake key successfully rejected with message: "${fakeValidation.error}"\n`);

  await assert.rejects(
    async () => {
      await userManager.getOrCreateUser('random_gibberish_fake_123');
    },
    /Google Gemini API Key etibarsızdır/,
    'getOrCreateUser must reject invalid Gemini keys'
  );
  console.log('✅ getOrCreateUser blocked fake key and refused to create profile.\n');

  // Test 2: Master Key allows owner to log in
  console.log('Test 2: Verifying Master Profile for server owner...');
  const masterKey = process.env.MASTER_API_KEY || 'master';
  const { user: masterUser, isNew: masterIsNew } = await userManager.getOrCreateUser(masterKey);
  assert(masterUser, 'Master user must exist');
  assert(masterUser.documents.length > 0, 'Master user must contain documents');
  console.log(`✅ Master Profile: Key="${masterKey}", Docs=${masterUser.documents.length}, Active="${masterUser.documents[0].title}"\n`);

  // Test 3: Real Gemini API Key from .env is Validated and creates profile
  console.log('Test 3: Testing live validation of real Gemini API Key from .env...');
  const realKey = process.env.GEMINI_API_KEY;
  if (realKey && realKey.length > 20) {
    const realValidation = await validateGeminiApiKey(realKey);
    console.log('Gemini validation result:', realValidation);
    assert(realValidation.valid === true, 'Real key must be valid or pass quota check');

    const { user: realUser, isNew: realIsNew } = await userManager.getOrCreateUser(realKey);
    assert(realUser.apiKey === realKey, 'Profile apiKey must match realKey');
    console.log(`✅ Real user profile provisioned with valid Gemini Key: ID=${realUser.id}\n`);

    // Test 4: Subsequent login with same real key loads existing profile
    console.log('Test 4: Logging in again with the same real key...');
    const { user: returnUser, isNew: returnIsNew } = await userManager.getOrCreateUser(realKey);
    assert(returnIsNew === false, 'Subsequent login must load existing profile');
    assert(returnUser.id === realUser.id, 'User ID must match');
    console.log('✅ Existing profile loaded successfully without recreation.\n');
  }

  // Test 5: Document and Lead Isolation
  console.log('Test 5: Verifying Document & Lead Isolation between profiles...');
  const key1 = 'test_user_key_alpha';
  const key2 = 'test_user_key_beta';
  
  // Directly save in DB for isolation testing
  const db = userManager.loadUsersDb();
  db.users[key1] = {
    id: 'usr_alpha',
    apiKey: key1,
    documents: [{ id: 'doc_alpha', title: 'Alpha Sənəd', content: 'Alpha məlumatı' }],
    activeDocumentId: 'doc_alpha',
    leads: [{ id: 'l1', phoneNumber: '994501111111', name: 'Alpha Alıcı' }]
  };
  db.users[key2] = {
    id: 'usr_beta',
    apiKey: key2,
    documents: [{ id: 'doc_beta', title: 'Beta Sənəd', content: 'Beta məlumatı' }],
    activeDocumentId: 'doc_beta',
    leads: [{ id: 'l2', phoneNumber: '994502222222', name: 'Beta Alıcı' }]
  };
  userManager.saveUsersDb(db);

  const check1 = userManager.getUser(key1);
  const check2 = userManager.getUser(key2);

  assert(!check1.documents.some(d => d.title === 'Beta Sənəd'), 'User 1 cannot see User 2 document');
  assert(!check2.documents.some(d => d.title === 'Alpha Sənəd'), 'User 2 cannot see User 1 document');
  assert(!check1.leads.some(l => l.phoneNumber === '994502222222'), 'User 1 cannot see User 2 lead');
  assert(!check2.leads.some(l => l.phoneNumber === '994501111111'), 'User 2 cannot see User 1 lead');
  console.log('✅ Documents and Leads are 100% isolated.\n');

  console.log('==================================================');
  console.log('🎉 ALL BYOK GEMINI & MULTI-TENANT TESTS PASSED!');
  console.log('==================================================');
}

runMultiTenantTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
