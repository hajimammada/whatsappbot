const fs = require('fs');
const path = require('path');
const https = require('https');

const LEADS_FILE = path.join(__dirname, '..', 'data', 'leads.json');

// Ensure data directory and leads file exist
function ensureStorage() {
  const dir = path.dirname(LEADS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function getLeads() {
  try {
    ensureStorage();
    const data = fs.readFileSync(LEADS_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading leads:', err);
    return [];
  }
}

function saveLeadsList(leads) {
  try {
    ensureStorage();
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving leads:', err);
  }
}

async function sendTelegramAlert(lead, viewingRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = `💬 *YENİ GÖRÜŞ / ƏLAQƏ MÜRACİƏTİ (whatsappbot.hajimammad.com)*\n\n` +
    `👤 *Alıcı:* ${lead.name || 'Ad qeyd edilməyib'}\n` +
    `📱 *Nömrə:* \`${lead.phoneNumber}\`\n` +
    `🕒 *İstədiyi vaxt:* ${viewingRequest.preferred_time || 'Dəqiqləşdirilməyib'}\n` +
    `💬 *Son mesaj:* "${lead.lastMessage}"\n` +
    `📅 *Tarix:* ${new Date().toLocaleString('az-AZ')}`;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const postData = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  });

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      resolve();
    });
    req.on('error', (e) => {
      console.warn('Telegram alert error:', e.message);
      resolve();
    });
    req.write(postData);
    req.end();
  });
}

async function recordLead(phoneNumber, rawMessage, aiAnalysis) {
  const leads = getLeads();
  let lead = leads.find(l => l.phoneNumber === phoneNumber);

  const isViewing = aiAnalysis && aiAnalysis.is_viewing_request;
  const callerName = aiAnalysis && aiAnalysis.detected_name ? aiAnalysis.detected_name : (lead ? lead.name : null);
  const appointmentTime = aiAnalysis && aiAnalysis.appointment_time ? aiAnalysis.appointment_time : null;

  if (!lead) {
    lead = {
      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      phoneNumber: phoneNumber,
      name: callerName || 'Naməlum Alıcı',
      status: isViewing ? 'viewing_requested' : 'inquired',
      interestLevel: isViewing ? 'high' : 'medium',
      firstContact: new Date().toISOString(),
      lastContact: new Date().toISOString(),
      lastMessage: rawMessage,
      viewingAppointments: [],
      historyCount: 1,
      notes: aiAnalysis && aiAnalysis.summary ? aiAnalysis.summary : ''
    };
    leads.unshift(lead);
  } else {
    lead.lastContact = new Date().toISOString();
    lead.lastMessage = rawMessage;
    lead.historyCount = (lead.historyCount || 1) + 1;
    if (callerName) lead.name = callerName;
    if (isViewing) {
      lead.status = 'viewing_requested';
      lead.interestLevel = 'high';
    }
    if (aiAnalysis && aiAnalysis.summary) {
      lead.notes = aiAnalysis.summary;
    }
  }

  if (isViewing && appointmentTime) {
    lead.viewingAppointments.push({
      id: 'apt_' + Date.now(),
      requestedAt: new Date().toISOString(),
      preferred_time: appointmentTime,
      status: 'pending_confirmation'
    });
    // Send instant Telegram notification
    await sendTelegramAlert(lead, { preferred_time: appointmentTime });
  }

  saveLeadsList(leads);
  return lead;
}

function updateLeadStatus(id, newStatus, notes) {
  const leads = getLeads();
  const lead = leads.find(l => l.id === id);
  if (lead) {
    if (newStatus) lead.status = newStatus;
    if (notes !== undefined) lead.notes = notes;
    saveLeadsList(leads);
    return lead;
  }
  return null;
}

module.exports = {
  getLeads,
  recordLead,
  updateLeadStatus,
  sendTelegramAlert
};
