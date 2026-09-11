const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const TOKENS_PATH = path.join(__dirname, '..', 'data', 'recovery_tokens.json');
const DEFAULT_EMAIL = 'hajimammada@gmail.com';

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadTokens() {
  try {
    if (!fs.existsSync(TOKENS_PATH)) {
      const initial = { tokens: {} };
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(TOKENS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading recovery tokens:', err);
    return { tokens: {} };
  }
}

function saveTokens(data) {
  try {
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving recovery tokens:', err);
    return false;
  }
}

function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user || DEFAULT_EMAIL,
        pass: pass
      }
    });
  }

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  return null;
}

/**
 * Creates a cryptographically secure 30-minute one-time recovery token
 */
function createRecoveryToken(hostUrl) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes validity
  const cleanHost = (hostUrl || 'https://whatsappbot.hajimammad.com').replace(/\/+$/, '');
  const recoveryUrl = `${cleanHost}/?recover_token=${token}`;

  const data = loadTokens();
  data.tokens[token] = {
    token,
    createdAt: new Date().toISOString(),
    expiresAt,
    used: false,
    usedAt: null
  };

  saveTokens(data);
  return { token, recoveryUrl, expiresAt };
}

/**
 * Sends one-time recovery link to hajimammada@gmail.com
 */
async function sendRecoveryEmail(hostUrl) {
  const { token, recoveryUrl, expiresAt } = createRecoveryToken(hostUrl);
  const targetEmail = process.env.RECOVERY_EMAIL || DEFAULT_EMAIL;
  const transporter = getMailTransporter();

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b141a; color: #e9edef; padding: 20px; }
        .container { max-width: 560px; margin: 0 auto; background: #111b21; border-radius: 12px; border: 1px solid #202c33; padding: 32px; }
        .brand { font-size: 20px; font-weight: 700; color: #00a884; margin-bottom: 24px; text-align: center; }
        .content { font-size: 15px; line-height: 1.6; color: #d1d7db; margin-bottom: 24px; }
        .btn-wrapper { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; background-color: #00a884; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
        .token-box { background: #1f2c34; border: 1px dashed #00a884; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 13px; color: #25d366; margin: 16px 0; }
        .footer { font-size: 12px; color: #8696a0; border-top: 1px solid #202c33; padding-top: 16px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">🤖 whatsappbot.hajimammad.com</div>
        <div class="content">
          <p>Salam,</p>
          <p>Admin paneli üçün hesab bərpası sorğusu göndərildi. Aşağıdakı birdəfəlik keçidə daxil olaraq mövcud sənədlərinizi və məlumatlarınızı qorumaqla <strong>yeni Google Gemini API açarınızı</strong> təyin edə bilərsiniz:</p>
          <div class="btn-wrapper">
            <a href="${recoveryUrl}" class="btn" target="_blank">Hesabı Bərpa Et & Yeni Açar Təyin Et</a>
          </div>
          <p style="font-size: 13px; color: #8696a0;">Əgər düymə işləmirsə, bu linki birbaşa brauzerinizdə açın:</p>
          <div class="token-box">${recoveryUrl}</div>
          <p style="font-size: 13px; color: #ffa726;">⚠️ <strong>Diqqət:</strong> Bu keçid <strong>birdəfəlikdir</strong> və 30 dəqiqə ərzində etibarlıdır. İstifadədən dərhal sonra avtomatik yararsızlaşır.</p>
        </div>
        <div class="footer">
          Əgər bu sorğunu siz göndərməmisinizsə, bu e-poçta məhəl qoymayın. Sistem qorunur.
        </div>
      </div>
    </body>
    </html>
  `;

  const emailText = `whatsappbot.hajimammad.com - Hesab Bərpası\n\n` +
    `Köhnə hesabınıza daxil olmaq üçün birdəfəlik bərpa keçidi:\n${recoveryUrl}\n\n` +
    `Bu keçid 30 dəqiqə ərzində və yalnız 1 dəfə istifadə edilə bilər.`;

  console.log(`\n🔑 [RECOVERY] Generated One-Time Recovery URL for ${targetEmail}:`);
  console.log(`➡️  ${recoveryUrl}\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"WhatsApp Bot Admin" <${process.env.SMTP_USER || process.env.GMAIL_USER || DEFAULT_EMAIL}>`,
        to: targetEmail,
        subject: '🔐 whatsappbot.hajimammad.com - Hesabın Bərpası üçün Birdəfəlik Keçid',
        text: emailText,
        html: emailHtml
      });
      console.log(`📧 [RECOVERY] Email successfully delivered to ${targetEmail}`);
      return {
        success: true,
        emailSent: true,
        targetEmail: targetEmail,
        expiresAt: expiresAt,
        message: `Bərpa keçidi ${targetEmail} ünvanına göndərildi. E-poçtunuzu yoxlayın!`
      };
    } catch (err) {
      console.error(`⚠️ [RECOVERY] Failed to send email via transporter:`, err.message);
      return {
        success: true,
        emailSent: false,
        targetEmail: targetEmail,
        recoveryUrl: recoveryUrl,
        expiresAt: expiresAt,
        message: `Bərpa linki yaradıldı. (SMTP xətası: ${err.message}). Link server loquna yazıldı.`
      };
    }
  } else {
    return {
      success: true,
      emailSent: false,
      targetEmail: targetEmail,
      recoveryUrl: recoveryUrl,
      expiresAt: expiresAt,
      message: `Bərpa linki yaradıldı və server loquna qeyd olundu.`
    };
  }
}

/**
 * Validates a recovery token without consuming it
 */
function verifyRecoveryToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Bərpa tokeni tapılmadı / Recovery token is missing' };
  }

  const cleanToken = token.trim();
  const data = loadTokens();
  const entry = data.tokens[cleanToken];

  if (!entry) {
    return { valid: false, error: 'Keçid etibarsızdır və ya mövcud deyil / Invalid token' };
  }

  if (entry.used) {
    return { valid: false, error: 'Bu bərpa keçidi artıq istifadə olunub (Birdəfəlikdir) / Token already used' };
  }

  if (Date.now() > entry.expiresAt) {
    return { valid: false, error: 'Bu bərpa keçidinin vaxtı bitib (30 dəqiqə keçib) / Token expired' };
  }

  return { valid: true, tokenData: entry };
}

/**
 * Marks a recovery token as used (single-use guarantee)
 */
function consumeRecoveryToken(token) {
  const verification = verifyRecoveryToken(token);
  if (!verification.valid) {
    throw new Error(verification.error);
  }

  const cleanToken = token.trim();
  const data = loadTokens();
  if (data.tokens[cleanToken]) {
    data.tokens[cleanToken].used = true;
    data.tokens[cleanToken].usedAt = new Date().toISOString();
    saveTokens(data);
  }
  return true;
}

module.exports = {
  createRecoveryToken,
  sendRecoveryEmail,
  verifyRecoveryToken,
  consumeRecoveryToken,
  DEFAULT_EMAIL
};
