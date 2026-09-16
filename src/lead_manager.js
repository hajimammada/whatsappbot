const fs = require('fs');
const path = require('path');
const https = require('https');

const LEADS_FILE = path.join(__dirname, '..', 'data', 'leads.json');
const driveBackup = require('./drive_backup');

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

function isChannelOrGroup(jidOrPhone) {
  if (!jidOrPhone) return false;
  const str = String(jidOrPhone).toLowerCase();
  const clean = str.replace(/@.+/, '').replace(/\D/g, '');
  return (
    str.endsWith('@newsletter') ||
    str.includes('newsletter') ||
    str.endsWith('@g.us') ||
    str.endsWith('@broadcast') ||
    str.endsWith('@call') ||
    str === 'status@broadcast' ||
    (clean.startsWith('120363') && clean.length >= 17)
  );
}

function getLeads() {
  try {
    ensureStorage();
    const data = fs.readFileSync(LEADS_FILE, 'utf-8');
    const rawList = JSON.parse(data || '[]');
    const filtered = rawList.filter(l => !isChannelOrGroup(l.phoneNumber) && !isChannelOrGroup(l.jid) && !isChannelOrGroup(l.lid));
    if (filtered.length !== rawList.length) {
      saveLeadsList(filtered);
    }
    return filtered;
  } catch (err) {
    console.error('Error reading leads:', err);
    return [];
  }
}

function saveLeadsList(leads) {
  try {
    ensureStorage();
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
    driveBackup.triggerBackup();
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

async function recordLead(phoneNumber, rawMessage, aiAnalysis = null, contactName = null, jid = null) {
  if (isChannelOrGroup(phoneNumber) || isChannelOrGroup(jid)) {
    return null;
  }

  const leads = getLeads();
  const cleanPhone = String(phoneNumber || '').replace(/@.+/, '').replace(/\D/g, '');
  const cleanJid = jid || (phoneNumber && String(phoneNumber).includes('@') ? phoneNumber : null);

  let lead = leads.find(l => 
    (cleanPhone && l.phoneNumber === cleanPhone) ||
    (cleanPhone && l.lid === cleanPhone) ||
    (cleanJid && l.jid === cleanJid)
  );

  const isViewing = Boolean(aiAnalysis && aiAnalysis.is_viewing_request);
  const callerName = (aiAnalysis && aiAnalysis.detected_name) || contactName || (lead ? lead.name : null);
  const appointmentTime = aiAnalysis && aiAnalysis.appointment_time ? aiAnalysis.appointment_time : null;

  const now = new Date().toISOString();
  const msgEntry = {
    text: rawMessage,
    from: rawMessage.startsWith('Siz: ') ? 'me' : 'contact',
    timestamp: now
  };

  const isLid = cleanJid ? cleanJid.endsWith('@lid') : cleanPhone.length > 13;

  if (!lead) {
    lead = {
      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      phoneNumber: cleanPhone,
      jid: cleanJid,
      lid: isLid ? cleanPhone : null,
      name: callerName || 'WhatsApp İstifadəçisi',
      status: isViewing ? 'viewing_requested' : 'inquired',
      interestLevel: isViewing ? 'high' : 'medium',
      firstContact: now,
      lastContact: now,
      lastMessage: rawMessage,
      messages: [msgEntry],
      viewingAppointments: [],
      historyCount: 1,
      notes: aiAnalysis && aiAnalysis.summary ? aiAnalysis.summary : ''
    };
    leads.unshift(lead);
  } else {
    lead.lastContact = now;
    lead.lastMessage = rawMessage;
    lead.historyCount = (lead.historyCount || 1) + 1;
    if (cleanJid && !lead.jid) lead.jid = cleanJid;
    if (isLid && !lead.lid) lead.lid = cleanPhone;
    if (!isLid && lead.phoneNumber !== cleanPhone) lead.phoneNumber = cleanPhone;

    lead.messages = lead.messages || [];
    // Avoid exact duplicate adjacent messages
    const lastExisting = lead.messages[lead.messages.length - 1];
    if (!lastExisting || lastExisting.text !== rawMessage || Date.now() - new Date(lastExisting.timestamp).getTime() > 1000) {
      lead.messages.push(msgEntry);
      if (lead.messages.length > 50) lead.messages.shift();
    }

    if (callerName && (lead.name === 'Naməlum Alıcı' || lead.name === 'WhatsApp İstifadəçisi' || !lead.name)) {
      lead.name = callerName;
    }
    if (isViewing) {
      lead.status = 'viewing_requested';
      lead.interestLevel = 'high';
    }
    if (aiAnalysis && aiAnalysis.summary) {
      lead.notes = aiAnalysis.summary;
    }
  }

  if (isViewing && appointmentTime) {
    lead.viewingAppointments = lead.viewingAppointments || [];
    lead.viewingAppointments.push({
      id: 'apt_' + Date.now(),
      requestedAt: now,
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

function migrateLeadLidToPhone(lid, phone) {
  const leads = getLeads();
  const cleanLid = String(lid).replace(/@.+/, '').replace(/\D/g, '');
  const cleanPhone = String(phone).replace(/@.+/, '').replace(/\D/g, '');
  if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return false;

  let modified = false;
  for (const l of leads) {
    if (l.phoneNumber === cleanLid || l.lid === cleanLid) {
      l.lid = cleanLid;
      l.phoneNumber = cleanPhone;
      modified = true;
    }
  }
  if (modified) {
    saveLeadsList(leads);
  }
  return modified;
}

function updateLeadPhone(idOrOldPhone, newPhone) {
  const leads = getLeads();
  const cleanNew = String(newPhone).replace(/@.+/, '').replace(/\D/g, '');
  if (!cleanNew) return null;

  const lead = leads.find(l => l.id === idOrOldPhone || l.phoneNumber === idOrOldPhone || l.lid === idOrOldPhone);
  if (lead) {
    if (lead.phoneNumber && lead.phoneNumber !== cleanNew && !lead.lid) {
      lead.lid = lead.phoneNumber;
    }
    lead.phoneNumber = cleanNew;
    saveLeadsList(leads);
    return lead;
  }
  return null;
}

module.exports = {
  getLeads,
  recordLead,
  updateLeadStatus,
  migrateLeadLidToPhone,
  updateLeadPhone,
  sendTelegramAlert
};
