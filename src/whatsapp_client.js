const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const { generateAIResponse, getAgentSettings } = require('./ai_engine');
const { recordLead } = require('./lead_manager');
const pkg = require('../package.json');

const AUTH_DIR = path.join(__dirname, '..', 'auth_info_baileys');

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
    this.humanTakeovers = new Map(); // remoteJid -> timestamp
    this.botSentMessageIds = new Set(); // message ID -> true
    this.eventListeners = [];
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
    const jid = phoneOrJid.includes('@') ? phoneOrJid : `${phoneOrJid}@s.whatsapp.net`;
    this.humanTakeovers.delete(jid);
    const phone = phoneOrJid.replace(/@.+/, '');
    console.log(`🤖 +${phone} üçün bot panel üzərindən dərhal yenidən aktiv edildi.`);
    this.notifySubscribers('chat_status_updated', {
      phone: phone,
      isPaused: false,
      remainingMinutes: 0
    });
    return { success: true, phone, isPaused: false };
  }

  pauseBotForChat(phoneOrJid, minutes = 300) {
    const jid = phoneOrJid.includes('@') ? phoneOrJid : `${phoneOrJid}@s.whatsapp.net`;
    this.humanTakeovers.set(jid, Date.now());
    const phone = phoneOrJid.replace(/@.+/, '');
    console.log(`⏸️ +${phone} üçün bot panel üzərindən ${minutes} dəqiqəlik (${Math.round(minutes/60)} saatlıq) dayandırıldı.`);
    this.notifySubscribers('chat_status_updated', {
      phone: phone,
      isPaused: true,
      remainingMinutes: minutes
    });
    return { success: true, phone, isPaused: true, remainingMinutes: minutes };
  }

  getAllChatStatuses() {
    const settings = getAgentSettings();
    const takeoverMinutes = settings.human_takeover_minutes !== undefined ? settings.human_takeover_minutes : 300;
    const now = Date.now();
    const result = {};

    for (const [jid, timestamp] of this.humanTakeovers.entries()) {
      const elapsedMs = now - timestamp;
      const totalMs = takeoverMinutes * 60 * 1000;
      if (elapsedMs < totalMs) {
        const remainingMinutes = Math.ceil((totalMs - elapsedMs) / 60000);
        const phone = jid.replace(/@.+/, '');
        result[phone] = {
          isPaused: true,
          remainingMinutes: remainingMinutes,
          pausedAt: new Date(timestamp).toISOString()
        };
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

  async start() {
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
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this.status = 'disconnected';
        this.qrCodeRaw = null;
        this.qrCodeDataUrl = null;
        this.userInfo = null;

        console.log(`WhatsApp connection closed (Status code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
        this.notifySubscribers('status_change', { status: this.status });

        if (shouldReconnect) {
          setTimeout(() => this.start(), 4000);
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

    this.socket.ev.on('messaging-history.set', async ({ chats, contacts, messages }) => {
      try {
        if (messages && messages.length > 0) {
          console.log(`📥 WhatsApp chat tarixçəsi sinxronlaşdırılır (${messages.length} mesaj)...`);
          for (const msg of messages) {
            const remoteJid = msg.key?.remoteJid;
            if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;
            const senderPhone = remoteJid.replace(/@.+/, '');
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
            if (!text || text.trim() === '') continue;

            const fromMe = Boolean(msg.key?.fromMe);
            const pushName = msg.pushName || (fromMe ? 'Siz' : 'WhatsApp İstifadəçisi');
            await recordLead(senderPhone, fromMe ? `Siz: ${text}` : text, null, fromMe ? null : pushName);

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

        const senderPhone = remoteJid.replace(/@.+/, '');

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
            this.humanTakeovers = this.humanTakeovers || new Map();
            this.humanTakeovers.set(remoteJid, Date.now());
            console.log(`👤 Siz +${senderPhone} ilə şəxsən söhbətə daxil oldunuz. Bot bu çatda ${takeoverMinutes} dəqiqə avtomatik susacaq.`);
            this.notifySubscribers('chat_status_updated', {
              phone: senderPhone,
              isPaused: true,
              remainingMinutes: takeoverMinutes
            });
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

          await recordLead(senderPhone, `Siz: ${text}`, null, null);
          this.notifySubscribers('leads_updated', {});
          continue;
        }

        const pushName = msg.pushName || 'WhatsApp İstifadəçisi';

        console.log(`\n📩 Incoming Message from +${senderPhone} (${pushName}): "${text}"`);

        // Record incoming message IMMEDIATELY so it is always present in Messages tab & Live feed
        await recordLead(senderPhone, text, null, pushName);
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
        this.humanTakeovers = this.humanTakeovers || new Map();
        const lastHumanMessage = this.humanTakeovers.get(remoteJid) || 0;

        if (takeoverMinutes > 0 && Date.now() - lastHumanMessage < takeoverMinutes * 60 * 1000) {
          console.log(`👤 Siz şəxsən söhbətdə olduğunuz üçün bot +${senderPhone} nömrəsinə mane olmur (${takeoverMinutes} dəqiqəlik sükut aktivdir).`);
          continue;
        }

        // Check cooldown (10 seconds between automatic replies to same sender)
        const now = Date.now();
        const lastTime = this.cooldowns.get(remoteJid) || 0;
        if (now - lastTime < 10000) {
          console.log(`⏳ Cooldown active for +${senderPhone}, skipping duplicate auto-reply.`);
          continue;
        }
        this.cooldowns.set(remoteJid, now);

        // If auto-reply is disabled globally, just log
        if (!this.autoReplyEnabled) {
          console.log(`ℹ️ Auto-Reply is disabled globally. Message recorded without AI reply.`);
          continue;
        }

        const processStartTime = Date.now();

        // Show typing indicator ("yazır...") for 2.5 seconds before replying
        try {
          await this.socket.sendPresenceUpdate('composing', remoteJid);
          await new Promise((resolve) => setTimeout(resolve, 2500));
          await this.socket.sendPresenceUpdate('paused', remoteJid);
        } catch (e) {
          // Non-critical
        }

        // Generate AI response
        try {
          console.log(`🤖 Processing AI response for +${senderPhone}...`);
          const aiResponse = await generateAIResponse(remoteJid, text);

          // CRITICAL SAFETY CHECK: Did the owner speak while AI was generating?
          const currentHumanTime = this.humanTakeovers.get(remoteJid) || 0;
          if (takeoverMinutes > 0 && (currentHumanTime >= processStartTime || Date.now() - currentHumanTime < takeoverMinutes * 60 * 1000)) {
            console.log(`🛑 Siz bu arada mesaj yazdığınız üçün hazırlanmış AI cavabı ləğv edildi və alıcıya göndərilmədi!`);
            continue;
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

          // Record Lead and Appointment
          await recordLead(senderPhone, text, aiResponse, pushName);

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
        }
      }
    });
  }

  async logout() {
    try {
      if (this.socket) {
        await this.socket.logout();
      }
      this.status = 'disconnected';
      this.userInfo = null;
      this.qrCodeDataUrl = null;
      this.notifySubscribers('status_change', { status: this.status });
    } catch (e) {
      console.error('Logout error:', e);
    }
  }
}

const waClientInstance = new WhatsAppClient();

module.exports = waClientInstance;
