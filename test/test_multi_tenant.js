const assert = require('assert');
const userManager = require('../src/user_manager');

async function runMultiTenantTests() {
  console.log('==================================================');
  console.log('🧪 RUNNING MULTI-TENANT API KEY AUTH TESTS');
  console.log('==================================================\n');

  // Test 1: Master Profile exists with Sumqayıt documents
  console.log('Test 1: Verifying Master Profile & Existing Data Migration...');
  const masterKey = process.env.MASTER_API_KEY || 'master';
  const { user: masterUser, isNew: masterIsNew } = userManager.getOrCreateUser(masterKey);
  assert(masterUser, 'Master user must exist');
  assert(masterUser.documents.length > 0, 'Master user must contain documents');
  console.log(`✅ Master Profile: Key="${masterKey}", Docs=${masterUser.documents.length}, Active="${masterUser.documents[0].title}"\n`);

  // Test 2: User A enters a new API Key -> System auto-creates profile
  console.log('Test 2: User A enters new API key ("sk_test_user_a")...');
  const keyA = 'sk_test_user_a';
  const { user: userA, isNew: isNewA } = userManager.getOrCreateUser(keyA);
  assert(isNewA === true, 'First time entering keyA must create a new profile');
  assert(userA.apiKey === keyA, 'Profile apiKey must match keyA');
  console.log(`✅ Profile A auto-created: ID=${userA.id}, Docs=${userA.documents.length}\n`);

  // Test 3: User A saves a unique document
  console.log('Test 3: User A saves custom document ("Mənzil A Elanı")...');
  userManager.createUserDocument(keyA, 'Mənzil A Elanı', 'Bu User A-nın mənzilidir. Qiymət: 100 000 AZN.', true);
  const updatedUserA = userManager.getUser(keyA);
  assert(updatedUserA.documents.some(d => d.title === 'Mənzil A Elanı'), 'User A must have Mənzil A Elanı');
  console.log('✅ User A document created and saved.\n');

  // Test 4: User B enters a new API Key -> System auto-creates profile B
  console.log('Test 4: User B enters new API key ("sk_test_user_b")...');
  const keyB = 'sk_test_user_b';
  const { user: userB, isNew: isNewB } = userManager.getOrCreateUser(keyB);
  assert(isNewB === true, 'First time entering keyB must create a new profile');
  console.log(`✅ Profile B auto-created: ID=${userB.id}\n`);

  // Test 5: User B saves a unique document
  console.log('Test 5: User B saves custom document ("Avtomobil B Elanı")...');
  userManager.createUserDocument(keyB, 'Avtomobil B Elanı', 'Bu User B-nin avtomobilidir. Qiymət: 30 000 USD.', true);
  const updatedUserB = userManager.getUser(keyB);
  assert(updatedUserB.documents.some(d => d.title === 'Avtomobil B Elanı'), 'User B must have Avtomobil B Elanı');
  console.log('✅ User B document created and saved.\n');

  // Test 6: Verify Complete Data Isolation between User A and User B
  console.log('Test 6: Verifying Complete Data Isolation...');
  const checkA = userManager.getUser(keyA);
  const checkB = userManager.getUser(keyB);
  assert(!checkA.documents.some(d => d.title === 'Avtomobil B Elanı'), 'User A must NOT see User B document');
  assert(!checkB.documents.some(d => d.title === 'Mənzil A Elanı'), 'User B must NOT see User A document');
  console.log('✅ Documents are 100% isolated between profiles.\n');

  // Test 7: User A logs in again -> Existing profile loaded, NOT recreated
  console.log('Test 7: User A logs in again with same keyA...');
  const { user: returnUserA, isNew: returnIsNewA } = userManager.getOrCreateUser(keyA);
  assert(returnIsNewA === false, 'Subsequent login with keyA must NOT recreate profile');
  assert(returnUserA.documents.some(d => d.title === 'Mənzil A Elanı'), 'Existing documents must be preserved');
  console.log('✅ Existing profile loaded with all saved data preserved.\n');

  // Test 8: Lead Isolation
  console.log('Test 8: Testing Lead Isolation between Profiles...');
  userManager.recordUserLead(keyA, '994501111111', 'Salam A', { is_viewing_request: false, summary: 'Lead for A' });
  userManager.recordUserLead(keyB, '994502222222', 'Salam B', { is_viewing_request: false, summary: 'Lead for B' });

  const leadsA = userManager.getUser(keyA).leads;
  const leadsB = userManager.getUser(keyB).leads;

  assert(leadsA.some(l => l.phoneNumber === '994501111111'), 'User A must have Lead A');
  assert(!leadsA.some(l => l.phoneNumber === '994502222222'), 'User A must NOT see Lead B');
  assert(leadsB.some(l => l.phoneNumber === '994502222222'), 'User B must have Lead B');
  assert(!leadsB.some(l => l.phoneNumber === '994501111111'), 'User B must NOT see Lead A');
  console.log('✅ Leads are 100% isolated between profiles.\n');

  console.log('==================================================');
  console.log('🎉 ALL MULTI-TENANT PROFILE TESTS PASSED!');
  console.log('==================================================');
}

runMultiTenantTests().catch(err => {
  console.error('❌ Multi-tenant test failed:', err);
  process.exit(1);
});
