const fs = require('fs');
const path = require('path');
const { validateGeminiApiKey } = require('./ai_engine');

const USERS_DB_PATH = path.join(__dirname, '..', 'data', 'users_db.json');
const KNOWLEDGE_BASE_PATH = path.join(__dirname, '..', 'config', 'knowledge_base.json');
const LEADS_PATH = path.join(__dirname, '..', 'data', 'leads.json');

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getInitialDocuments() {
  if (fs.existsSync(KNOWLEDGE_BASE_PATH)) {
    try {
      const kb = JSON.parse(fs.readFileSync(KNOWLEDGE_BASE_PATH, 'utf-8'));
      if (kb.documents && kb.documents.length > 0) {
        return {
          documents: kb.documents,
          activeDocumentId: kb.activeDocumentId || kb.documents[0].id
        };
      }
    } catch (e) {
      console.warn('Could not read existing knowledge base:', e);
    }
  }

  const defaultDoc = {
    id: 'doc_' + Date.now(),
    title: 'Bilik Bazası (Nümunə Sənəd)',
    content: `Bura AI botun müştərilərə cavab verməsi üçün bilməsini istədiyiniz bütün məlumatları sərbəst şəkildə yaza bilərsiniz.

Məsələn:
- Təqdim olunan xidmət, satılan məhsul və ya təklifləriniz
- Qiymətlər, ödəniş şərtləri və endirim qaydaları
- Ünvan, iş saatları, əlaqə vasitələri və qəbul qaydaları
- Müştərilərin ən çox verdiyi suallar və onların dəqiq cavabları

İstədiyiniz vaxt bu mətni silib öz məlumatlarınızı yaza və ya "➕ Yeni Sənəd" düyməsi ilə əlavə sənədlər yarada bilərsiniz.`,
    updatedAt: new Date().toISOString()
  };
  return { documents: [defaultDoc], activeDocumentId: defaultDoc.id };
}

function loadUsersDb() {
  try {
    if (!fs.existsSync(USERS_DB_PATH)) {
      const initialDb = { users: {} };
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }

    const raw = fs.readFileSync(USERS_DB_PATH, 'utf-8');
    const db = JSON.parse(raw);
    
    // Ensure no legacy master bypass key
    if (db.users && db.users['master']) {
      delete db.users['master'];
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    }
    return db;
  } catch (err) {
    console.error('Error loading users DB:', err);
    return { users: {} };
  }
}

function saveUsersDb(db) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving users DB:', err);
    return false;
  }
}

// Strictly requires a valid Google Gemini API Key
// If key is in DB -> loads existing profile
// If key is NOT in DB -> validates with Google Gemini API live; if valid, auto-creates profile
async function getOrCreateUser(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error('Google Gemini API Key tələb olunur / Google Gemini API Key required');
  }

  const cleanKey = apiKey.trim();
  const db = loadUsersDb();

  // 1. If it is already in database -> return existing profile (no recreation)
  if (db.users[cleanKey]) {
    db.users[cleanKey].lastActiveAt = new Date().toISOString();
    saveUsersDb(db);
    return { user: db.users[cleanKey], isNew: false };
  }

  // 2. Validate live against Google Gemini API
  const validation = await validateGeminiApiKey(cleanKey);
  if (!validation.valid) {
    throw new Error(validation.error || 'Daxil edilən Google Gemini API Key etibarsızdır. Zəhmət olmasa aistudio.google.com-dan düzgün açar daxil edin.');
  }

  // 3. Valid key -> system automatically creates new profile and saves in DB
  const newUserId = 'usr_' + Date.now();
  const now = new Date().toISOString();
  const initial = getInitialDocuments();

  const newUser = {
    id: newUserId,
    apiKey: cleanKey,
    createdAt: now,
    lastActiveAt: now,
    documents: initial.documents,
    activeDocumentId: initial.activeDocumentId,
    leads: [],
    settings: {
      human_takeover_minutes: 300,
      auto_reply_enabled: true
    }
  };

  db.users[cleanKey] = newUser;
  saveUsersDb(db);
  console.log(`✨ Yeni profil avtomatik yaradıldı və bazaya qeyd olundu: API Key = "${cleanKey.substring(0, 8)}..."`);
  return { user: newUser, isNew: true };
}

function getUser(apiKey) {
  if (!apiKey) return null;
  const db = loadUsersDb();
  return db.users[apiKey.trim()] || null;
}

function getUserActiveDocument(user) {
  if (!user || !user.documents || user.documents.length === 0) {
    return { id: 'default', title: 'Data', content: '' };
  }
  const active = user.documents.find(d => d.id === user.activeDocumentId);
  return active || user.documents[0];
}

function saveUserDocument(apiKey, doc) {
  const db = loadUsersDb();
  const user = db.users[apiKey];
  if (!user) throw new Error('İstifadəçi tapılmadı');

  user.documents = user.documents || [];
  const idx = user.documents.findIndex(d => d.id === doc.id);
  const now = new Date().toISOString();

  if (idx !== -1) {
    user.documents[idx] = { ...user.documents[idx], ...doc, updatedAt: now };
  } else {
    const newDoc = {
      id: doc.id || 'doc_' + Date.now(),
      title: doc.title || 'Yeni Sənəd',
      content: doc.content || '',
      updatedAt: now
    };
    user.documents.push(newDoc);
    if (!user.activeDocumentId) {
      user.activeDocumentId = newDoc.id;
    }
  }

  if (doc.makeActive) {
    user.activeDocumentId = doc.id;
  }

  saveUsersDb(db);
  return user;
}

function createUserDocument(apiKey, title, content, makeActive = false) {
  const newDoc = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: title || 'Yeni Sənəd',
    content: content || '',
    makeActive: makeActive
  };
  return saveUserDocument(apiKey, newDoc);
}

function setUserActiveDocument(apiKey, docId) {
  const db = loadUsersDb();
  const user = db.users[apiKey];
  if (!user) return false;

  const exists = (user.documents || []).some(d => d.id === docId);
  if (exists) {
    user.activeDocumentId = docId;
    saveUsersDb(db);
    return true;
  }
  return false;
}

function deleteUserDocument(apiKey, docId) {
  const db = loadUsersDb();
  const user = db.users[apiKey];
  if (!user) throw new Error('İstifadəçi tapılmadı');

  user.documents = user.documents || [];
  if (user.documents.length <= 1) {
    throw new Error('Ən azı 1 sənəd qalmalıdır.');
  }

  user.documents = user.documents.filter(d => d.id !== docId);
  if (user.activeDocumentId === docId) {
    user.activeDocumentId = user.documents[0].id;
  }

  saveUsersDb(db);
  return user;
}

function recordUserLead(apiKey, phone, lastMessage, analysis) {
  const db = loadUsersDb();
  const user = db.users[apiKey];
  if (!user) return;

  user.leads = user.leads || [];
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  let lead = user.leads.find(l => l.phoneNumber === cleanPhone);

  const now = new Date().toISOString();

  if (!lead) {
    lead = {
      id: 'lead_' + Date.now(),
      phoneNumber: cleanPhone,
      name: analysis?.detected_name || 'Alıcı / Müştəri',
      firstContact: now,
      lastContact: now,
      lastMessage: lastMessage,
      interestLevel: analysis?.is_viewing_request ? 'high' : 'medium',
      status: analysis?.is_viewing_request ? 'viewing_requested' : 'interested',
      viewingAppointments: analysis?.appointment_time ? [{
        requested_at: now,
        preferred_time: analysis.appointment_time,
        status: 'pending'
      }] : [],
      summary: analysis?.summary || ''
    };
    user.leads.push(lead);
  } else {
    lead.lastContact = now;
    lead.lastMessage = lastMessage;
    if (analysis?.detected_name && lead.name === 'Alıcı / Müştəri') {
      lead.name = analysis.detected_name;
    }
    if (analysis?.is_viewing_request) {
      lead.interestLevel = 'high';
      lead.status = 'viewing_requested';
      if (analysis?.appointment_time) {
        lead.viewingAppointments = lead.viewingAppointments || [];
        lead.viewingAppointments.push({
          requested_at: now,
          preferred_time: analysis.appointment_time,
          status: 'pending'
        });
      }
    }
    if (analysis?.summary) {
      lead.summary = analysis.summary;
    }
  }

  saveUsersDb(db);
  return lead;
}

function updateUserLeadStatus(apiKey, leadId, status, notes) {
  const db = loadUsersDb();
  const user = db.users[apiKey];
  if (!user) return null;

  user.leads = user.leads || [];
  const lead = user.leads.find(l => l.id === leadId);
  if (lead) {
    lead.status = status;
    if (notes) lead.notes = notes;
    lead.updatedAt = new Date().toISOString();
    saveUsersDb(db);
    return lead;
  }
  return null;
}

module.exports = {
  loadUsersDb,
  saveUsersDb,
  getOrCreateUser,
  getUser,
  getUserActiveDocument,
  saveUserDocument,
  createUserDocument,
  setUserActiveDocument,
  deleteUserDocument,
  recordUserLead,
  updateUserLeadStatus
};
