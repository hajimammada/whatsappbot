const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const { generateAIResponse, getAgentSettings } = require('./ai_engine');
const { recordLead, migrateLeadLidToPhone } = require('./lead_manager');
const pkg = require('../package.json');

const AUTH_DIR = path.join(__dirname, '..', 'auth_info_baileys');
const LID_MAPPINGS_FILE = path.join(__dirname, '..', 'data', 'lid_mappings.json');

function archiveAuthDir() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    if (!files || files.length === 0) return;

    const trashDir = path.join(__dirname, '..', 'trash', 'auth_sessions', `session_${Date.now()}`);
    fs.mkdirSync(trashDir, { recursive: true });

    for (const file of files) {
      if (file === 'trash') continue;
      const srcPath = path.join(AUTH_DIR, file);
      const destPath = path.join(trashDir, file);
      try {
        fs.renameSync(srcPath, destPath);
      } catch (e) {
        try {
          fs.copyFileSync(srcPath, destPath);
          fs.unlinkSync(srcPath);
        } catch (e2) {}
      }
    }
    console.log(`📦 WhatsApp session credentials archived to trash: ${trashDir}`);
  } catch (err) {
    console.error('Error archiving auth directory:', err);
  }
}

class WhatsAppClient {
  constructor() {
    this.socket = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'waiting_qr' | 'connected'
    this.qrCodeRaw = null;
    this.qrCodeDataUrl = null;
    this.userInfo = null;
    this.autoReplyEnabled = process.env.AUTO_REPLY_ENABLED !== 'false';
    this.recentMessages = [];
    this.cooldowns = new Map(); // sender -> timestamp
    this.messageBuffers = new Map(); // senderPhone -> { remoteJid, senderPhone, pushName, texts: [], timer: null, isProcessing: false }
    this.humanTakeovers = new Map(); // remoteJid or phone -> timestamp
    this.botSentMessageIds = new Set(); // message ID -> true
    this.eventListeners = [];
    this.lidToPhoneMap = new Map(); // cleanLid -> cleanPhone
    this.phoneToLidMap = new Map(); // cleanPhone -> cleanLid
    this.loadLidMappings();
  }

  loadLidMappings() {
    try {
      if (fs.existsSync(LID_MAPPINGS_FILE)) {
        const raw = fs.readFileSync(LID_MAPPINGS_FILE, 'utf-8');
        const data = JSON.parse(raw || '{}');
        for (const [lid, phone] of Object.entries(data)) {
          const cleanL = String(lid).replace(/@.+/, '').replace(/\D/g, '');
          const cleanP = String(phone).replace(/@.+/, '').replace(/\D/g, '');
          if (cleanL && cleanP) {
            this.lidToPhoneMap.set(cleanL, cleanP);
            this.phoneToLidMap.set(cleanP, cleanL);
          }
        }
      }
    } catch (e) {
      console.warn('Could not load lid_mappings.json:', e);
    }
  }

  saveLidMapping(lidRaw, phoneRaw) {
    if (!lidRaw || !phoneRaw) return;
    const cleanLid = String(lidRaw).replace(/@.+/, '').replace(/\D/g, '');
    const cleanPhone = String(phoneRaw).replace(/@.+/, '').replace(/\D/g, '');
    if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return;

    this.lidToPhoneMap.set(cleanLid, cleanPhone);
    this.phoneToLidMap.set(cleanPhone, cleanLid);

    try {
      const dir = path.dirname(LID_MAPPINGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = {};
      for (const [l, p] of this.lidToPhoneMap.entries()) {
        obj[l] = p;
      }
      fs.writeFileSync(LID_MAPPINGS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not save lid_mappings.json:', e);
    }

    try {
      migrateLeadLidToPhone(cleanLid, cleanPhone);
    } catch (e) {
      // Ignored
    }
  }

  resolveContactPhone(remoteJid, msg = null) {
    const rawClean = String(remoteJid || '').replace(/@.+/, '').replace(/\D/g, '');
    const isLid = String(remoteJid || '').endsWith('@lid');

    // 1. Check if Baileys provides real phone in senderPn or participantPn
    const senderPn = msg?.key?.senderPn || msg?.key?.participantPn;
    if (senderPn) {
      const pnClean = String(senderPn).replace(/@.+/, '').replace(/\D/g, '');
      if (pnClean && pnClean !== rawClean) {
        if (isLid) {
          this.saveLidMapping(rawClean, pnClean);
        }
        return {
          phone: pnClean,
          lid: isLid ? rawClean : null,
          isLid: isLid,
          resolved: true
        };
      }
    }

    // 2. Check if we already have a saved mapping for this LID
    if (isLid && this.lidToPhoneMap.has(rawClean)) {
      return {
        phone: this.lidToPhoneMap.get(rawClean),
        lid: rawClean,
        isLid: true,
        resolved: true
      };
    }

    // 3. Fallback: regular phone or unmapped LID
    return {
      phone: rawClean,
      lid: isLid ? rawClean : null,
      isLid: isLid,
      resolved: !isLid
    };
  }

  onEvent(callback) {
    this.eventListeners.push(callback);
  }

  notifySubscribers(eventType, data) {
    for (const cb of this.eventListeners) {
      try {
        cb(eventType, data);
      } catch (err) {
        console.error('Subscriber notify error:', err);
      }
    }
  }

  setAutoReply(enabled) {
    this.autoReplyEnabled = Boolean(enabled);
    this.notifySubscribers('settings_updated', { autoReplyEnabled: this.autoReplyEnabled });
  }

  resumeBotForChat(phoneOrJid) {
    const raw = String(phoneOrJid || '').trim();
    const clean = raw.replace(/@.+/, '').replace(/\D/g, '');
    const mappedPhone = this.lidToPhoneMap.get(clean);
    const mappedLid = this.phoneToLidMap.get(clean);

    const keysToDelete = new Set([
      raw,
      clean,
      `${clean}@s.whatsapp.net`,
      `${clean}@lid`
    ]);
    if (mappedPhone) {
      keysToDelete.add(mappedPhone);
      keysToDelete.add(`${mappedPhone}@s.whatsapp.net`);
    }
    if (mappedLid) {
      keysToDelete.add(mappedLid);
      keysToDelete.add(`${mappedLid}@lid`);
    }

    // Clear all matching variations in humanTakeovers
    for (const key of Array.from(this.humanTakeovers.keys())) {
      if (
        keysToDelete.has(key) ||
        key.includes(clean) ||
        (mappedPhone && key.includes(mappedPhone)) ||
        (mappedLid && key.includes(mappedLid))
      ) {
        this.humanTakeovers.delete(key);
      }
    }

    console.log(`🤖 +${clean} üçün bot panel üzərindən dərhal yenidən aktiv edildi.`);
    this.notifySubscribers('chat_status_updated', {
      phone: clean,
      isPaused: false,
      remainingMinutes: 0
    });
    if (mappedPhone && mappedPhone !== clean) {
      this.notifySubscribers('chat_status_updated', {
        phone: mappedPhone,
        isPaused: false,
        remainingMinutes: 0
      });
    }
    if (mappedLid && mappedLid !== clean) {
      this.notifySubscribers('chat_status_updated', {
        phone: mappedLid,
        isPaused: false,
        remainingMinutes: 0
      });
    }
    return { success: true, phone: clean, isPaused: false };
  }

  pauseBotForChat(phoneOrJid, minutes = null, isManual = null) {
    const raw = String(phoneOrJid || '').trim();
    const clean = raw.replace(/@.+/, '').replace(/\D/g, '');
    const now = Date.now();
    const mappedPhone = this.lidToPhoneMap.get(clean);
    const mappedLid = this.phoneToLidMap.get(clean);

    // If isManual is explicitly boolean, use it.
    // Otherwise, if minutes is null/undefined/<=0, it's manual indefinite pause.
    const isMan = isManual !== null ? Boolean(isManual) : (!minutes || Number(minutes) <= 0);
    const pauseRecord = {
      timestamp: now,
      isManual: isMan,
      minutes: isMan ? null : Number(minutes)
    };

    const keys = [
      raw,
      clean,
      `${clean}@s.whatsapp.net`,
      `${clean}@lid`
    ];
    if (mappedPhone) {
      keys.push(mappedPhone, `${mappedPhone}@s.whatsapp.net`);
    }
    if (mappedLid) {
      keys.push(mappedLid, `${mappedLid}@lid`);
    }

    for (const k of keys) {
      this.humanTakeovers.set(k, pauseRecord);
    }

    if (isMan) {
      console.log(`⏸️ +${clean} üçün bot panel üzərindən tamamilə (qeyri-müəyyən müddətə) dayandırıldı.`);
    } else {
      console.log(`⏸️ +${clean} üçün bot ${minutes} dəqiqəlik dayandırıldı.`);
    }

    const payload = {
      phone: clean,
      isPaused: true,
      isManual: isMan,
      remainingMinutes: isMan ? null : Number(minutes)
    };

    this.notifySubscribers('chat_status_updated', payload);
    if (mappedPhone && mappedPhone !== clean) {
      this.notifySubscribers('chat_status_updated', { ...payload, phone: mappedPhone });
    }
    if (mappedLid && mappedLid !== clean) {
      this.notifySubscribers('chat_status_updated', { ...payload, phone: mappedLid });
    }
    return { success: true, ...payload };
  }

  isChatPaused(remoteJid) {
    const settings = getAgentSettings();
    const takeoverMinutes = settings.human_takeover_minutes !== undefined ? settings.human_takeover_minutes : 30;

    const raw = String(remoteJid || '');
    const clean = raw.replace(/@.+/, '').replace(/\D/g, '');
    const mappedPhone = this.lidToPhoneMap.get(clean);
    const mappedLid = this.phoneToLidMap.get(clean);

    const checkKeys = [
      raw,
      clean,
      `${clean}@s.whatsapp.net`,
      `${clean}@lid`
    ];
    if (mappedPhone) {
      checkKeys.push(mappedPhone, `${mappedPhone}@s.whatsapp.net`);
    }
    if (mappedLid) {
      checkKeys.push(mappedLid, `${mappedLid}@lid`);
    }

    const now = Date.now();
    for (const k of checkKeys) {
      const rec = this.humanTakeovers.get(k);
      if (!rec) continue;

      if (typeof rec === 'number') {
        const windowMs = takeoverMinutes * 60 * 1000;
        if ((now - rec) < windowMs) return true;
      } else if (rec && typeof rec === 'object') {
        if (rec.isManual) {
          // Indefinite manual pause: stays paused until explicitly resumed
          return true;
        }
        const limitMins = rec.minutes || takeoverMinutes;
        const windowMs = limitMins * 60 * 1000;
        if ((now - rec.timestamp) < windowMs) {
          return true;
        }
      }
    }
    return false;
  }

  getAllChatStatuses() {
    const settings = getAgentSettings();
    const takeoverMinutes = settings.human_takeover_minutes !== undefined ? settings.human_takeover_minutes : 30;
    const now = Date.now();
    const result = {};

    for (const [jid, rec] of this.humanTakeovers.entries()) {
      let isPaused = false;
      let isManual = false;
      let remainingMinutes = null;
      let timestamp = now;

      if (typeof rec === 'number') {
        timestamp = rec;
        const elapsedMs = now - rec;
        const totalMs = takeoverMinutes * 60 * 1000;
        if (elapsedMs < totalMs) {
          isPaused = true;
          isManual = false;
          remainingMinutes = Math.ceil((totalMs - elapsedMs) / 60000);
        }
      } else if (rec && typeof rec === 'object') {
        timestamp = rec.timestamp;
        if (rec.isManual) {
          isPaused = true;
          isManual = true;
          remainingMinutes = null;
        } else {
          const limitMins = rec.minutes || takeoverMinutes;
          const elapsedMs = now - rec.timestamp;
          const totalMs = limitMins * 60 * 1000;
          if (elapsedMs < totalMs) {
            isPaused = true;
            isManual = false;
            remainingMinutes = Math.ceil((totalMs - elapsedMs) / 60000);
          }
        }
      }

      if (isPaused) {
        const clean = jid.replace(/@.+/, '').replace(/\D/g, '');
        const statusObj = {
          isPaused: true,
          isManual: isManual,
          remainingMinutes: remainingMinutes,
          pausedAt: new Date(timestamp).toISOString()
        };
        if (clean) {
          result[clean] = statusObj;
          const mappedPhone = this.lidToPhoneMap.get(clean);
          if (mappedPhone) result[mappedPhone] = statusObj;
          const mappedLid = this.phoneToLidMap.get(clean);
          if (mappedLid) result[mappedLid] = statusObj;
        }
      }
    }
    return result;
  }

  getStatus() {
    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      userInfo: this.userInfo,
      autoReplyEnabled: this.autoReplyEnabled,
      chatStatuses: this.getAllChatStatuses(),
      recentMessages: this.recentMessages.slice(-20)
    };
  }

  clearAllBufferTimers() {
    for (const [phone, buf] of this.messageBuffers.entries()) {
      if (buf.timer) {
        clearTimeout(buf.timer);
        buf.timer = null;
      }
    }
    this.messageBuffers.clear();
  }

  enqueueIncomingMessage(remoteJid, senderPhone, pushName, text) {
    let buf = this.messageBuffers.get(senderPhone);
    if (!buf) {
      buf = {
        remoteJid,
        senderPhone,
        pushName,
        texts: [],
        timer: null,
        isProcessing: false
      };
      this.messageBuffers.set(senderPhone, buf);
    }

    // Keep contact details updated
    buf.remoteJid = remoteJid;
    if (pushName && pushName !== 'WhatsApp İstifadəçisi') {
      buf.pushName = pushName;
    }
    buf.texts.push(text);

    console.log(`📥 [Buffer] +${senderPhone} üçün növbəyə alındı (Cəmi ${buf.texts.length} mesaj). Əlavə olunan: "${text}"`);

    // Show WhatsApp typing indicator ("yazır...") immediately
    if (this.socket) {
      this.socket.sendPresenceUpdate('composing', remoteJid).catch(() => {});
    }

    // If currently generating AI reply for a prior batch, let it finish;
    // this message will automatically be picked up in the next pass.
    if (buf.isProcessing) {
      console.log(`⏳ +${senderPhone} üçün hazırda AI cavab hazırlanır. Yeni mesaj növbəti dövrə üçün buferə əlavə edildi.`);
      return;
    }

    // Debounce: Wait 3.5 seconds of silence before bundling messages and invoking AI
    if (buf.timer) {
      clearTimeout(buf.timer);
    }
    buf.timer = setTimeout(() => {
      this.processMessageBuffer(senderPhone);
    }, 3500);
  }

  async processMessageBuffer(senderPhone) {
    const buf = this.messageBuffers.get(senderPhone);
    if (!buf || buf.texts.length === 0) {
      if (buf && !buf.isProcessing && buf.texts.length === 0) {
        this.messageBuffers.delete(senderPhone);
      }
      return;
    }

    if (buf.isProcessing) {
      return;
    }

    buf.isProcessing = true;
    buf.timer = null;

    const batchTexts = [...buf.texts];
    buf.texts = [];
    const combinedText = batchTexts.join('\n');
    const remoteJid = buf.remoteJid;
    const pushName = buf.pushName || 'WhatsApp İstifadəçisi';

    try {
      // Check pause / human takeover
      if (this.isChatPaused(remoteJid)) {
        const settings = getAgentSettings();
        const takeoverMinutes = settings.human_takeover_minutes !== undefined ? settings.human_takeover_minutes : 30;
        console.log(`👤 Siz şəxsən söhbətdə olduğunuz üçün bot +${senderPhone} nömrəsinə mane olmur (${takeoverMinutes} dəqiqəlik sükut aktivdir).`);
        buf.isProcessing = false;
        return;
      }

      // Check if auto-reply is globally enabled
      if (!this.autoReplyEnabled) {
        console.log(`ℹ️ Auto-Reply is disabled globally. Mesajlar buferləşdirildi, lakin avto-cavab göndərilmədi.`);
        buf.isProcessing = false;
        return;
      }

      // Show typing indicator ("yazır...")
      if (this.socket) {
        try {
          await this.socket.sendPresenceUpdate('composing', remoteJid);
        } catch (e) {}
      }

      console.log(`🤖 Processing AI response for +${senderPhone} (${batchTexts.length} mesaj birləşdirildi):\n"${combinedText}"`);
      const aiResponse = await generateAIResponse(remoteJid, combinedText);

      // Stop typing indicator
      if (this.socket) {
        try {
          await this.socket.sendPresenceUpdate('paused', remoteJid);
        } catch (e) {}
      }

      // CRITICAL SAFETY CHECK: Did the owner speak while AI was generating?
      if (this.isChatPaused(remoteJid)) {
        console.log(`🛑 Siz bu arada mesaj yazdığınız üçün hazırlanmış AI cavabı ləğv edildi və alıcıya göndərilmədi!`);
        buf.isProcessing = false;
        return;
      }

      console.log(`📤 Sending AI Reply to +${senderPhone}: "${aiResponse.reply_text}"`);

      // Send WhatsApp reply and record ID so bot doesn't consider its own reply as human takeover
      const sent = await this.socket.sendMessage(remoteJid, { text: aiResponse.reply_text });
      if (sent?.key?.id) {
        this.botSentMessageIds.add(sent.key.id);
        if (this.botSentMessageIds.size > 2000) {
          const first = this.botSentMessageIds.values().next().value;
          this.botSentMessageIds.delete(first);
        }
      }

      // Record Lead and Appointment with combinedText
      await recordLead(senderPhone, combinedText, aiResponse, pushName, remoteJid);

      const outgoingLog = {
        id: (sent?.key?.id) || ('reply_' + Date.now()),
        to: senderPhone,
        text: aiResponse.reply_text,
        direction: 'outgoing',
        timestamp: new Date().toISOString(),
        isViewingRequest: aiResponse.is_viewing_request
      };
      this.recentMessages.push(outgoingLog);
      if (this.recentMessages.length > 100) this.recentMessages.shift();
      this.notifySubscribers('new_message', outgoingLog);
      this.notifySubscribers('leads_updated', {});
    } catch (err) {
      console.error(`Error processing/sending reply to +${senderPhone}:`, err);
    } finally {
      buf.isProcessing = false;

      // If new messages arrived while AI was generating, schedule processing them after short breath (2s)
      if (buf.texts.length > 0) {
        console.log(`🔁 +${senderPhone} üçün emal zamanı yeni ${buf.texts.length} mesaj daxil olub, 2 saniyə sonra emal ediləcək.`);
        if (buf.timer) clearTimeout(buf.timer);
        buf.timer = setTimeout(() => {
          this.processMessageBuffer(senderPhone);
        }, 2000);
      } else {
        this.messageBuffers.delete(senderPhone);
      }
    }
  }

  async start() {
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners();
        this.socket.end(undefined);
      } catch (e) {}
      this.socket = null;
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    this.status = 'connecting';
    this.notifySubscribers('status_change', { status: this.status });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`Starting WhatsApp Bot (Baileys v${version.join('.')}, isLatest: ${isLatest})...`);

    const logger = pino({ level: 'silent' });

    this.socket = makeWASocket({
      version,
      logger,
      printQRInTerminal: false, // We'll handle QR custom rendering
      auth: state,
      browser: ['whatsappbot.hajimammad.com', 'Chrome', pkg.version || '3.2.0'],
      syncFullHistory: false
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = 'waiting_qr';
        this.qrCodeRaw = qr;
        try {
          this.qrCodeDataUrl = await QRCode.toDataURL(qr);
        } catch (e) {
          console.error('Failed to generate QR DataURL:', e);
        }

        console.log('\n=============================================');
        console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP APP:');
        console.log('=============================================');
        qrcodeTerminal.generate(qr, { small: true });
        console.log('Or open Web Dashboard at: http://localhost:' + (process.env.PORT || 3000));
        console.log('=============================================\n');

        this.notifySubscribers('qr_generated', {
          qrRaw: qr,
          qrCodeDataUrl: this.qrCodeDataUrl
        });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403;
        this.status = 'disconnected';
        this.qrCodeRaw = null;
        this.qrCodeDataUrl = null;
        this.userInfo = null;

        console.log(`WhatsApp connection closed (Status code: ${statusCode}). Is logged out: ${isLoggedOut}`);
        this.notifySubscribers('status_change', { status: this.status });

        if (isLoggedOut) {
          console.log('⚠️ WhatsApp session was logged out or unlinked. Archiving session credentials and generating a new QR code...');
          archiveAuthDir();
          setTimeout(() => {
            this.start().catch(e => console.error('Failed to restart after logout:', e));
          }, 2000);
        } else {
          setTimeout(() => {
            this.start().catch(e => console.error('Failed to reconnect after close:', e));
          }, 4000);
        }
      } else if (connection === 'open') {
        this.status = 'connected';
        this.qrCodeRaw = null;
        this.qrCodeDataUrl = null;
        this.userInfo = this.socket.user;

        console.log(`\n✅ WhatsApp Agent Connected Successfully!`);
        console.log(`Connected as: ${this.socket.user?.name || this.socket.user?.id}\n`);
        this.notifySubscribers('status_change', {
          status: this.status,
          userInfo: this.userInfo
        });
      }
    });

    this.socket.ev.on('chats.phoneNumberShare', async ({ lid, jid }) => {
      if (lid && jid) {
        console.log(`🔗 WhatsApp LID nömrə ilə əlaqələndirildi: ${lid} -> ${jid}`);
        this.saveLidMapping(lid, jid);
        this.notifySubscribers('leads_updated', {});
      }
    });

    this.socket.ev.on('contacts.upsert', async (contacts) => {
      for (const c of contacts) {
        if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
          this.saveLidMapping(c.lid, c.id);
        }
        if (c.id && c.id.endsWith('@lid') && c.phoneNumber) {
          this.saveLidMapping(c.id, c.phoneNumber);
        }
      }
    });

    this.socket.ev.on('contacts.update', async (contacts) => {
      for (const c of contacts) {
        if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
          this.saveLidMapping(c.lid, c.id);
        }
      }
    });

    this.socket.ev.on('messaging-history.set', async ({ chats, contacts, messages }) => {
      try {
        if (contacts && contacts.length > 0) {
          for (const c of contacts) {
            if (c.lid && c.id && c.id.endsWith('@s.whatsapp.net')) {
              this.saveLidMapping(c.lid, c.id);
            }
            if (c.id && c.id.endsWith('@lid') && c.phoneNumber) {
              this.saveLidMapping(c.id, c.phoneNumber);
            }
          }
        }

        if (messages && messages.length > 0) {
          console.log(`📥 WhatsApp chat tarixçəsi sinxronlaşdırılır (${messages.length} mesaj)...`);
          for (const msg of messages) {
            const remoteJid = msg.key?.remoteJid;
            if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

            const resolved = this.resolveContactPhone(remoteJid, msg);
            const senderPhone = resolved.phone;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
            if (!text || text.trim() === '') continue;

            const fromMe = Boolean(msg.key?.fromMe);
            const pushName = msg.pushName || (fromMe ? 'Siz' : 'WhatsApp İstifadəçisi');
            await recordLead(senderPhone, fromMe ? `Siz: ${text}` : text, null, fromMe ? null : pushName, remoteJid);

            const msgTimestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString();
            const logEntry = {
              id: msg.key?.id || ('hist_' + Date.now()),
              from: fromMe ? 'me' : senderPhone,
              to: fromMe ? senderPhone : undefined,
              name: pushName,
              text: text,
              direction: fromMe ? 'outgoing' : 'incoming',
              timestamp: msgTimestamp
            };
            this.recentMessages.push(logEntry);
          }
          if (this.recentMessages.length > 100) {
            this.recentMessages = this.recentMessages.slice(-100);
          }
          this.notifySubscribers('leads_updated', {});
          this.notifySubscribers('status_change', this.getStatus());
        }
      } catch (err) {
        console.warn('Error processing messaging-history.set:', err);
      }
    });

    this.socket.ev.on('messages.upsert', async (m) => {
      for (const msg of m.messages) {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid) continue;

        // Ignore group chats and status broadcasts
        if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

        const resolved = this.resolveContactPhone(remoteJid, msg);
        const senderPhone = resolved.phone;

        // Ignore messages sent by the bot itself (prevent self-pause echo loop)
        if (msg.key.id && this.botSentMessageIds.has(msg.key.id)) {
          this.botSentMessageIds.delete(msg.key.id);
          continue;
        }

        // Extract message text
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        // Ignore empty messages, receipts, app state syncs, media without caption
        if (!text || text.trim() === '') continue;

        const msgTimestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString();

        // 1. HUMAN TAKEOVER / OWNER MANUAL MESSAGE:
        // If YOU manually type and send a message in this chat, bot pauses only for this contact
        if (msg.key.fromMe) {
          const settings = getAgentSettings();
          const takeoverMinutes = settings.human_takeover_minutes !== undefined ? settings.human_takeover_minutes : 30;
          if (takeoverMinutes > 0) {
            const currentRec = this.humanTakeovers.get(remoteJid);
            if (!currentRec?.isManual) {
              this.pauseBotForChat(remoteJid, takeoverMinutes, false);
              console.log(`👤 Siz +${senderPhone} ilə şəxsən söhbətə daxil oldunuz. Bot bu çatda ${takeoverMinutes} dəqiqə avtomatik susacaq.`);
            }
          }

          // Record owner's outgoing message in recentMessages and leads table
          const outgoingLog = {
            id: msg.key.id || ('me_' + Date.now()),
            from: 'me',
            to: senderPhone,
            name: 'Siz',
            text: text,
            direction: 'outgoing',
            timestamp: msgTimestamp
          };
          this.recentMessages.push(outgoingLog);
          if (this.recentMessages.length > 100) this.recentMessages.shift();
          this.notifySubscribers('new_message', outgoingLog);

          await recordLead(senderPhone, `Siz: ${text}`, null, null, remoteJid);
          this.notifySubscribers('leads_updated', {});
          continue;
        }

        const pushName = msg.pushName || 'WhatsApp İstifadəçisi';

        console.log(`\n📩 Incoming Message from +${senderPhone} (${pushName}): "${text}"`);

        // Record incoming message IMMEDIATELY so it is always present in Messages tab & Live feed
        await recordLead(senderPhone, text, null, pushName, remoteJid);
        this.notifySubscribers('leads_updated', {});

        const logEntry = {
          id: msg.key.id,
          from: senderPhone,
          name: pushName,
          text: text,
          direction: 'incoming',
          timestamp: msgTimestamp
        };
        this.recentMessages.push(logEntry);
        if (this.recentMessages.length > 100) this.recentMessages.shift();
        this.notifySubscribers('new_message', logEntry);

        // If this was an offline sync or history append, do NOT auto-reply
        if (m.type !== 'notify') {
          continue;
        }

        // Check message age: if older than 2 minutes, skip auto-reply
        if (msg.messageTimestamp && (Date.now() / 1000 - msg.messageTimestamp > 120)) {
          console.log(`⌛ Köhnə mesaj (+${senderPhone}), avto-cavab verilmədi.`);
          continue;
        }

        // Check if Owner is currently chatting in this conversation
        const settings = getAgentSettings();
        const takeoverMinutes = settings.human_takeover_minutes !== undefined ? settings.human_takeover_minutes : 30;

        if (this.isChatPaused(remoteJid)) {
          console.log(`👤 Siz şəxsən söhbətdə olduğunuz üçün bot +${senderPhone} nömrəsinə mane olmur (${takeoverMinutes} dəqiqəlik sükut aktivdir).`);
          continue;
        }

        // If auto-reply is disabled globally, just log
        if (!this.autoReplyEnabled) {
          console.log(`ℹ️ Auto-Reply is disabled globally. Message recorded without AI reply.`);
          continue;
        }

        // Enqueue to intelligent message buffer (aggregates consecutive messages into unified prompt)
        this.enqueueIncomingMessage(remoteJid, senderPhone, pushName, text);
      }
    });
  }

  async logout() {
    try {
      console.log('🚪 Initiating WhatsApp logout and session reset...');
      if (this.socket) {
        try {
          await this.socket.logout();
        } catch (err) {
          console.warn('Socket logout warning:', err.message);
        }
        try {
          this.socket.ev.removeAllListeners();
          this.socket.end(undefined);
        } catch (err) {}
        this.socket = null;
      }
      this.status = 'disconnected';
      this.userInfo = null;
      this.qrCodeRaw = null;
      this.qrCodeDataUrl = null;
      this.clearAllBufferTimers();
      this.notifySubscribers('status_change', { status: this.status });

      archiveAuthDir();

      setTimeout(() => {
        this.start().catch(e => console.error('Failed to restart after logout:', e));
      }, 1500);

      return { success: true, message: 'WhatsApp hesabı uğurla çıxarıldı və yeni QR kod hazırlanır.' };
    } catch (e) {
      console.error('Logout error:', e);
      throw e;
    }
  }

  async resetSessionAndRestart() {
    console.log('🔄 Manually resetting WhatsApp session and generating new QR code...');
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners();
        this.socket.end(undefined);
      } catch (err) {}
      this.socket = null;
    }
    this.status = 'disconnected';
    this.userInfo = null;
    this.qrCodeRaw = null;
    this.qrCodeDataUrl = null;
    this.clearAllBufferTimers();
    this.notifySubscribers('status_change', { status: this.status });

    archiveAuthDir();

    await this.start();
    return { success: true, message: 'Yeni QR kod hazırlanır...' };
  }

  async reconnect(cleanSession = false) {
    if (cleanSession) {
      return this.resetSessionAndRestart();
    }
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners();
        this.socket.end(undefined);
      } catch (e) {}
      this.socket = null;
    }
    await this.start();
    return { success: true, message: 'Qoşulur...' };
  }
}

const waClientInstance = new WhatsAppClient();

module.exports = waClientInstance;
