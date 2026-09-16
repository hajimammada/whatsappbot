/**
 * Meta Graph API & Webhook Service
 * Handles Instagram Direct and Facebook Messenger integration
 * 
 * Features:
 * - Meta Webhook Verification (hub.challenge / hub.verify_token)
 * - Ingestion of Instagram Direct & Facebook Messenger conversations
 * - Real-time AI response dispatch via Meta Send API
 * - Lead logging with platform tracking ('instagram' | 'facebook')
 * - Operator manual replies from Unified Inbox
 */

const https = require('https');
const { recordLead, appendOperatorMessage, getLeads } = require('./lead_manager');
const { generateAIResponse, getAgentSettings } = require('./ai_engine');

class MetaService {
  constructor() {
    this.verifyToken = process.env.META_VERIFY_TOKEN || 'whatsappbot_meta_token_2026';
    this.pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '';
    this.instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID || '';
    this.facebookPageId = process.env.FACEBOOK_PAGE_ID || '';
    this.eventListeners = [];
    this.recentMessages = [];
  }

  isConfigured() {
    return Boolean(this.pageAccessToken && this.pageAccessToken.trim());
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      hasPageAccessToken: Boolean(this.pageAccessToken),
      instagramAccountId: this.instagramAccountId || null,
      facebookPageId: this.facebookPageId || null,
      verifyTokenConfigured: Boolean(this.verifyToken)
    };
  }

  onEvent(cb) {
    this.eventListeners.push(cb);
  }

  notifySubscribers(eventType, data) {
    for (const cb of this.eventListeners) {
      try {
        cb(eventType, data);
      } catch (err) {
        console.warn('[MetaService] Event subscriber error:', err.message);
      }
    }
  }

  /**
   * Verify Webhook challenge from Meta for Developers
   */
  verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('✅ [Meta Webhook] Successfully verified webhook handshake!');
      return challenge;
    }
    return null;
  }

  /**
   * Send a text message via Meta Graph API
   */
  async sendMessage(recipientId, text, platform = 'instagram') {
    if (!text || !text.trim()) {
      throw new Error('Mesaj mətni boş ola bilməz');
    }

    const token = this.pageAccessToken;
    if (!token) {
      console.warn(`⚠️ [Meta] META_PAGE_ACCESS_TOKEN təyin edilməyib. Mesaj yalnız daxili tarixçəyə yazıldı.`);
      appendOperatorMessage(recipientId, text.trim());
      return {
        success: true,
        sent: false,
        warning: 'Token not configured, recorded in history only',
        recipientId,
        text
      };
    }

    const payload = JSON.stringify({
      recipient: { id: recipientId },
      message: { text: text.trim() },
      messaging_type: 'RESPONSE'
    });

    const url = new URL('https://graph.facebook.com/v19.0/me/messages');
    url.searchParams.append('access_token', token);

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => { responseBody += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(responseBody);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              appendOperatorMessage(recipientId, text.trim());
              const outgoingLog = {
                id: data.message_id || ('meta_' + Date.now()),
                to: recipientId,
                text: text.trim(),
                platform: platform,
                direction: 'outgoing',
                from: 'me',
                isOperator: true,
                timestamp: new Date().toISOString()
              };
              this.recentMessages.push(outgoingLog);
              if (this.recentMessages.length > 100) this.recentMessages.shift();
              this.notifySubscribers('new_message', outgoingLog);
              resolve({ success: true, sent: true, data });
            } else {
              console.error('❌ [Meta Send API Error]:', data);
              reject(new Error(data?.error?.message || 'Meta API request failed'));
            }
          } catch (e) {
            reject(new Error('Invalid response from Meta API'));
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Handle incoming Webhook events from Meta
   */
  async handleIncomingWebhook(body) {
    if (!body || !body.entry) return { status: 'ignored' };

    const objectType = body.object; // 'page' (Facebook) | 'instagram'
    const platform = objectType === 'instagram' ? 'instagram' : 'facebook';

    for (const entry of body.entry) {
      const messagingEvents = entry.messaging || [];
      for (const event of messagingEvents) {
        if (event.message && !event.message.is_echo) {
          await this._processIncomingMessage(event, platform);
        }
      }
    }
    return { status: 'processed' };
  }

  async _processIncomingMessage(event, platform) {
    const senderId = event.sender?.id;
    if (!senderId) return;

    let incomingText = event.message.text || '';
    if (!incomingText && event.message.attachments) {
      const att = event.message.attachments[0];
      if (att.type === 'audio') {
        incomingText = '🎤 Səsli mesaj (Audio)';
      } else {
        incomingText = `[${att.type || 'Fayl'}]`;
      }
    }

    if (!incomingText.trim()) return;

    const senderDisplayName = platform === 'instagram' 
      ? `IG: @user_${senderId.slice(-4)}` 
      : `FB İstifadəçisi (${senderId.slice(-4)})`;

    console.log(`📥 [${platform.toUpperCase()}] Mesaj qəbul edildi (${senderId}): "${incomingText}"`);

    // Notify UI immediately about incoming message
    const incomingLog = {
      id: event.message.mid || ('inc_' + Date.now()),
      from: senderId,
      name: senderDisplayName,
      text: incomingText,
      platform: platform,
      direction: 'incoming',
      timestamp: new Date().toISOString()
    };
    this.recentMessages.push(incomingLog);
    if (this.recentMessages.length > 100) this.recentMessages.shift();
    this.notifySubscribers('new_message', incomingLog);

    // Retrieve previous history for this lead
    const leads = getLeads();
    const existingLead = leads.find(l => l.platformId === senderId || l.phoneNumber === senderId);
    const history = (existingLead && existingLead.messages) ? existingLead.messages.slice(-15) : [];

    // Generate AI response
    try {
      const contactId = `${platform}_${senderId}`;
      const aiResponse = await generateAIResponse(contactId, incomingText);
      console.log(`🤖 [${platform.toUpperCase()} AI] Cavab: "${aiResponse.reply_text}"`);

      // Record lead in DB
      await recordLead(senderId, incomingText, aiResponse, senderDisplayName, null, platform, senderId);

      // Send reply back to customer
      await this.sendMessage(senderId, aiResponse.reply_text, platform);
    } catch (err) {
      console.error(`❌ [${platform} AI Error]:`, err.message);
      await recordLead(senderId, incomingText, null, senderDisplayName, null, platform, senderId);
    }
  }
}

module.exports = new MetaService();
