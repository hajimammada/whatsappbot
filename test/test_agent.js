require('dotenv').config();
const assert = require('assert');
const {
  generateAIResponse,
  getKnowledgeBase,
  getActiveDocument,
  createDocument,
  setActiveDocument,
  deleteDocument
} = require('../src/ai_engine');
const { recordLead, getLeads } = require('../src/lead_manager');

async function runTests() {
  console.log('==================================================');
  console.log('🧪 RUNNING UNIVERSAL KNOWLEDGE BASE AGENT TESTS');
  console.log('==================================================\n');

  // Test 1: Verify Knowledge Base & Active Document
  console.log('Test 1: Validating Knowledge Base & Active Document Configuration...');
  const kb = getKnowledgeBase();
  assert(kb.documents && kb.documents.length > 0, 'Knowledge base must contain documents');
  const activeDoc = getActiveDocument();
  assert(activeDoc && activeDoc.title, 'Active document must have a title');
  assert(activeDoc.content.length > 0, 'Active document must contain knowledge text');
  console.log(`✅ Active Document: "${activeDoc.title}" (${activeDoc.content.length} chars)\n`);

  // Test 2: Price / Initial Payment Inquiry from Document
  console.log('Test 2: Testing Price & Initial Payment Inquiry ("Salam, ilkin ödəniş və aylıq nə qədərdir?")...');
  const priceTest = await generateAIResponse('test_user_1', 'Salam, ilkin ödəniş və aylıq nə qədərdir?');
  console.log('🤖 AI Answer:', priceTest.reply_text);
  assert(priceTest.reply_text.includes('55') || priceTest.reply_text.includes('703'), 'Reply should mention 55000 or 703 AZN');
  console.log('✅ Initial payment inquiry test passed.\n');

  // Test 3: Kupça and Mortgage Inquiry from Document
  console.log('Test 3: Testing Kupça Inquiry ("Kupçası var? İpotekanın faizi və ötürülməsi necədir?")...');
  const kupcaTest = await generateAIResponse('test_user_2', 'Kupçası var? İpotekanın faizi və ötürülməsi necədir?');
  console.log('🤖 AI Answer:', kupcaTest.reply_text);
  assert(kupcaTest.reply_text.toLowerCase().includes('kupça') || kupcaTest.reply_text.toLowerCase().includes('çıxarış') || kupcaTest.reply_text.includes('4%'), 'Reply should confirm kupça/mortgage');
  console.log('✅ Kupça inquiry test passed.\n');

  // Test 4: Viewing Appointment Request
  console.log('Test 4: Testing Viewing Appointment Request ("Sabah saat 18:00-da evə baxmaq istəyirəm")...');
  const viewingTest = await generateAIResponse('test_user_3', 'Sabah saat 18:00-da evə baxmaq istəyirəm');
  console.log('🤖 AI Answer:', viewingTest.reply_text);
  assert(viewingTest.is_viewing_request === true, 'is_viewing_request must be true');
  console.log('✅ Viewing appointment detection test passed.\n');

  // Test 5: Russian Language Inquiry
  console.log('Test 5: Testing Russian Inquiry ("Здравствуйте! Квартира продается? Есть купчая?")...');
  const ruTest = await generateAIResponse('test_user_4', 'Здравствуйте! Квартира продается? Есть купчая?');
  console.log('🤖 AI Answer:', ruTest.reply_text);
  assert(ruTest.language === 'ru', 'Language should be detected as Russian');
  console.log('✅ Russian inquiry test passed.\n');

  // Test 6: Document Lifecycle Management (Create, Activate, Delete)
  console.log('Test 6: Testing Document Creation & Active Switching...');
  const testDocTitle = 'Avtomobil Satışı - Toyota Corolla';
  const testDocContent = 'Model: Toyota Corolla 2022. Yürüş: 35 000 km. Qiymət: 24 000 USD.';
  createDocument(testDocTitle, testDocContent, false);
  const updatedKb = getKnowledgeBase();
  const createdDoc = updatedKb.documents.find(d => d.title === testDocTitle);
  assert(createdDoc, 'Created document should exist in knowledge base');
  
  // Test activating
  setActiveDocument(createdDoc.id);
  assert(getActiveDocument().id === createdDoc.id, 'Active document should be updated to created document');

  // Switch back to original default doc
  const originalDoc = updatedKb.documents.find(d => d.id !== createdDoc.id);
  if (originalDoc) {
    setActiveDocument(originalDoc.id);
  }
  // Delete test doc
  deleteDocument(createdDoc.id);
  console.log('✅ Document lifecycle management passed.\n');

  // Test 7: Lead Manager Recording
  console.log('Test 7: Testing Lead Manager Storage...');
  await recordLead('994501234567', 'Sabah saat 18:00-da evə baxmaq istəyirəm', viewingTest);
  const leads = getLeads();
  const foundLead = leads.find(l => l.phoneNumber === '994501234567');
  assert(foundLead, 'Lead must be recorded in data/leads.json');
  assert(foundLead.status === 'viewing_requested', 'Lead status should be viewing_requested');
  console.log('✅ Lead manager test passed.\n');

  console.log('==================================================');
  console.log('🎉 ALL 7 TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
