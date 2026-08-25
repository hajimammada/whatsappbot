require('dotenv').config();
const assert = require('assert');
const { generateAIResponse, getHouseProfile } = require('../src/ai_engine');
const { recordLead, getLeads, updateLeadStatus } = require('../src/lead_manager');

async function runTests() {
  console.log('==================================================');
  console.log('🧪 RUNNING WHATSAPP REAL ESTATE AGENT TEST SUITE');
  console.log('==================================================\n');

  // Test 1: Verify House Profile
  console.log('Test 1: Validating House Profile Configuration...');
  const profile = getHouseProfile();
  assert(profile.property_info, 'Property info section must exist');
  assert(profile.specifications, 'Specifications section must exist');
  assert(profile.financial_details || profile.pricing_and_negotiation, 'Pricing/Financial section must exist');
  console.log('✅ House profile valid.\n');

  // Test 2: Price / Initial Payment Inquiry (Azerbaijani)
  console.log('Test 2: Testing Price & Initial Payment Inquiry ("Salam, ilkin ödəniş və aylıq nə qədərdir?")...');
  const priceTest = await generateAIResponse('test_user_1', 'Salam, ilkin ödəniş və aylıq nə qədərdir?');
  console.log('🤖 AI Answer:', priceTest.reply_text);
  assert(priceTest.reply_text.includes('55') || priceTest.reply_text.includes('703'), 'Reply should mention 55000 or 703 AZN');
  console.log('✅ Initial payment inquiry test passed.\n');

  // Test 3: Kupça and Mortgage Inquiry (Azerbaijani)
  console.log('Test 3: Testing Kupça Inquiry ("Kupçası var? İpotekanın faizi və ötürülməsi necədir?")...');
  const kupcaTest = await generateAIResponse('test_user_2', 'Kupçası var? İpotekanın faizi və ötürülməsi necədir?');
  console.log('🤖 AI Answer:', kupcaTest.reply_text);
  assert(kupcaTest.reply_text.toLowerCase().includes('kupça') || kupcaTest.reply_text.toLowerCase().includes('çıxarış') || kupcaTest.reply_text.includes('4%'), 'Reply should confirm kupça and mortgage');
  console.log('✅ Kupça inquiry test passed.\n');

  // Test 4: Viewing Appointment Request (Azerbaijani)
  console.log('Test 4: Testing Viewing Appointment Request ("Sabah saat 18:00-da evə baxmaq istəyirəm")...');
  const viewingTest = await generateAIResponse('test_user_3', 'Sabah saat 18:00-da evə baxmaq istəyirəm');
  console.log('🤖 AI Answer:', viewingTest.reply_text);
  console.log('📊 Analysis Metadata:', JSON.stringify(viewingTest, null, 2));
  assert(viewingTest.is_viewing_request === true, 'is_viewing_request must be true');
  console.log('✅ Viewing appointment detection test passed.\n');

  // Test 5: Russian Language Inquiry
  console.log('Test 5: Testing Russian Inquiry ("Здравствуйте! Квартира продается? Есть купчая?")...');
  const ruTest = await generateAIResponse('test_user_4', 'Здравствуйте! Квартира продается? Есть купчая?');
  console.log('🤖 AI Answer:', ruTest.reply_text);
  assert(ruTest.language === 'ru', 'Language should be detected as Russian');
  console.log('✅ Russian inquiry test passed.\n');

  // Test 6: Lead Manager Recording
  console.log('Test 6: Testing Lead Manager Storage...');
  await recordLead('994501234567', 'Sabah saat 18:00-da evə baxmaq istəyirəm', viewingTest);
  const leads = getLeads();
  const foundLead = leads.find(l => l.phoneNumber === '994501234567');
  assert(foundLead, 'Lead must be recorded in data/leads.json');
  assert(foundLead.status === 'viewing_requested', 'Lead status should be viewing_requested');
  console.log('✅ Lead manager test passed.\n');

  console.log('==================================================');
  console.log('🎉 ALL 6 TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
