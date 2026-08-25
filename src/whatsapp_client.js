const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const { generateAIResponse } = require('./ai_engine');
const { recordLead } = require('./lead_manager');

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

  getStatus() {
    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      userInfo: this.userInfo,
      autoReplyEnabled: this.autoReplyEnabled,
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
      browser: ['tap.az Real Estate Agent', 'Chrome', '1.0.0'],
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

    this.socket.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid) continue;

        // Ignore group chats and status broadcasts
        if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

        const senderPhone = remoteJid.replace(/@.+/, '');

        // Extract message text
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        // 1. HUMAN TAKEOVER / RESUME COMMAND:
        // If YOU send a message in this chat:
        if (msg.key.fromMe) {
          this.humanTakeovers = this.humanTakeovers || new Map();
          const cleanText = text.trim().toLowerCase();
          if (cleanText === '!bot' || cleanText === '!resume' || cleanText === '!aktiv' || cleanText === '!start') {
            this.humanTakeovers.delete(remoteJid);
            console.log(`🤖 +${senderPhone} üçün bot dərhal yenidən aktivləşdirildi.`);
          } else {
            this.humanTakeovers.set(remoteJid, Date.now());
            console.log(`👤 Siz +${senderPhone} ilə şəxsən söhbətə daxil oldunuz. Bot bu çatda ${getAgentSettings().human_takeover_minutes || 2} dəqiqə susacaq.`);
          }
          continue;
        }

        if (!text || text.trim() === '') continue;

        const pushName = msg.pushName || 'tap.az Alıcı';

        console.log(`\n📩 Incoming Message from +${senderPhone} (${pushName}): "${text}"`);

        // Check if Owner is currently chatting in this conversation
        const settings = getAgentSettings();
        const takeoverMinutes = settings.human_takeover_minutes !== undefined ? settings.human_takeover_minutes : 2;
        this.humanTakeovers = this.humanTakeovers || new Map();
        const lastHumanMessage = this.humanTakeovers.get(remoteJid) || 0;

        if (Date.now() - lastHumanMessage < takeoverMinutes * 60 * 1000) {
          console.log(`👤 Siz şəxsən söhbətdə olduğunuz üçün bot +${senderPhone} nömrəsinə mane olmur (${takeoverMinutes} dəqiqəlik sükut aktivdir).`);
          const logEntry = {
            id: msg.key.id,
            from: senderPhone,
            name: pushName,
            text: text,
            direction: 'incoming',
            timestamp: new Date().toISOString(),
            status: 'human_takeover_skipped'
          };
          this.recentMessages.push(logEntry);
          this.notifySubscribers('new_message', logEntry);
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

        // Record incoming message in recent logs
        const logEntry = {
          id: msg.key.id,
          from: senderPhone,
          name: pushName,
          text: text,
          direction: 'incoming',
          timestamp: new Date().toISOString()
        };
        this.recentMessages.push(logEntry);
        this.notifySubscribers('new_message', logEntry);

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
          if (currentHumanTime >= processStartTime || Date.now() - currentHumanTime < takeoverMinutes * 60 * 1000) {
            console.log(`🛑 Siz bu arada mesaj yazdığınız üçün hazırlanmış AI cavabı ləğv edildi və alıcıya göndərilmədi!`);
            continue;
          }

          console.log(`📤 Sending AI Reply to +${senderPhone}: "${aiResponse.reply_text}"`);

          // Send WhatsApp reply
          await this.socket.sendMessage(remoteJid, { text: aiResponse.reply_text });

          // Record Lead and Appointment
          await recordLead(senderPhone, text, aiResponse);

          const outgoingLog = {
            id: 'reply_' + Date.now(),
            to: senderPhone,
            text: aiResponse.reply_text,
            direction: 'outgoing',
            timestamp: new Date().toISOString(),
            isViewingRequest: aiResponse.is_viewing_request
          };
          this.recentMessages.push(outgoingLog);
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
