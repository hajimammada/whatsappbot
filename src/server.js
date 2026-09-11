const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const waClient = require('./whatsapp_client');
const userManager = require('./user_manager');
const { generateAIResponse, getAgentSettings, validateGeminiApiKey } = require('./ai_engine');

function getAppVersion() {
  if (process.env.APP_VERSION) {
    const v = process.env.APP_VERSION.trim();
    return v.startsWith('v') ? v : `v${v}`;
  }

  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (pkg.version) {
      const v = pkg.version.trim();
      return v.startsWith('v') ? v : `v${v}`;
    }
  } catch (err) {}

  try {
    const gitTag = execSync('git describe --tags --always', {
      cwd: path.join(__dirname, '..'),
      timeout: 2000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    if (gitTag) {
      return gitTag.startsWith('v') ? gitTag : `v${gitTag}`;
    }
  } catch (err) {
    // Git command not available
  }

  return 'v3.4.5';
}

function createServer() {
  const app = express();
  
  // Strict CORS policy
  const allowedOrigins = [
    'https://whatsappbot.hajimammad.com',
    'http://localhost:3000',
    'http://localhost:3099'
  ];
  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    }
  }));

  app.use(express.json());

  // Dynamic Root Handler: Injects live version & cache-busters directly into HTML
  app.get(['/', '/index.html'], (req, res) => {
    try {
      const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
      let html = fs.readFileSync(htmlPath, 'utf-8');
      const ver = getAppVersion();
      html = html.replace(/id="app-version">.*?<\/span>/, `id="app-version">${ver}</span>`);
      html = html.replace(/href="styles\.css(?:\?v=[^"]*)?"/, `href="styles.css?v=${ver}"`);
      html = html.replace(/src="app\.js(?:\?v=[^"]*)?"/, `src="app.js?v=${ver}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(html);
    } catch (e) {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // In-memory brute-force rate limiter for login
  const loginAttempts = new Map();
  function loginRateLimiter(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 10;

    let record = loginAttempts.get(ip);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      loginAttempts.set(ip, record);
    } else {
      record.count++;
    }

    if (record.count > maxAttempts) {
      const waitMinutes = Math.ceil((record.resetAt - now) / 60000);
      return res.status(429).json({
        error: `Həddindən artıq uğursuz cəhd edildi. Zəhmət olmasa ${waitMinutes} dəqiqə sonra yenidən cəhd edin. / Too many login attempts. Please try again later.`
      });
    }
    next();
  }

  // SSE clients array
  const sseClients = [];

  function broadcastSSE(type, data) {
    const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(payload);
      } catch (err) {
        // Ignored
      }
    }
  }

  // Subscribe to WhatsApp client events
  waClient.onEvent((eventType, data) => {
    broadcastSSE(eventType, data);
  });

  // Auth Middleware: Strictly verifies admin password
  async function requireAuth(req, res, next) {
    const cred = req.headers['x-api-key'] || req.headers['x-admin-password'] || req.query.api_key || req.query.password;
    if (!cred) {
      return res.status(401).json({ error: 'Giriş üçün parol tələb olunur / Password required' });
    }
    if (!userManager.isAuthorizedPassword(cred)) {
      return res.status(401).json({ error: 'Yanlış parol / Unauthorized' });
    }
    req.user = userManager.getPrimaryUser();
    next();
  }

  // Auth API: Single password login
  app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    try {
      const password = req.body.password || req.body.apiKey;
      if (!password || !password.trim()) {
        return res.status(400).json({ error: 'Parol daxil edilməlidir / Password is required' });
      }
      const { user } = await userManager.verifyAdminLogin(password.trim());
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      loginAttempts.delete(ip);

      res.json({
        success: true,
        message: 'Mövcud profilinizə uğurla daxil oldunuz!',
        user: {
          id: user.id,
          apiKey: user.apiKey,
          documentCount: (user.documents || []).length,
          activeDocumentId: user.activeDocumentId
        }
      });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  // Update Google Gemini API Key (Authenticated)
  app.post('/api/auth/update-key', requireAuth, async (req, res) => {
    try {
      const { newApiKey } = req.body;
      if (!newApiKey || !newApiKey.trim()) {
        return res.status(400).json({ error: 'Yeni Google Gemini API Key daxil edilməlidir' });
      }

      const cleanKey = newApiKey.trim();
      const validation = await validateGeminiApiKey(cleanKey);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error || 'Daxil edilən yeni Google Gemini API Key etibarsızdır.' });
      }

      const updatedUser = userManager.rekeyUserAccount(cleanKey);

      res.json({
        success: true,
        message: 'Google Gemini API açarınız uğurla yeniləndi!',
        user: {
          id: updatedUser.id,
          apiKey: updatedUser.apiKey,
          documentCount: (updatedUser.documents || []).length,
          activeDocumentId: updatedUser.activeDocumentId
        }
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // SSE stream endpoint (Authenticated)
  app.get('/api/events', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);
    // Send initial status
    res.write(`data: ${JSON.stringify({ type: 'status_change', data: waClient.getStatus() })}\n\n`);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Get status (Authenticated)
  app.get('/api/status', requireAuth, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      ...waClient.getStatus(),
      version: getAppVersion(),
      geminiApiKey: req.user.apiKey || ''
    });
  });

  // Get app version info dynamically (Public)
  app.get('/api/version', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      name: 'whatsappbot.hajimammad.com',
      version: getAppVersion()
    });
  });

  // Toggle Auto-Reply (Authenticated)
  app.post('/api/auto-reply', requireAuth, (req, res) => {
    const { enabled } = req.body;
    waClient.setAutoReply(enabled);
    res.json({ success: true, autoReplyEnabled: waClient.autoReplyEnabled });
  });

  // Per-Chat Human Takeover & Resume endpoints (Authenticated)
  app.get('/api/chat-statuses', requireAuth, (req, res) => {
    res.json(waClient.getAllChatStatuses());
  });

  app.post('/api/chat/:phone/resume', requireAuth, (req, res) => {
    const result = waClient.resumeBotForChat(req.params.phone);
    res.json(result);
  });

  app.post('/api/chat/:phone/pause', requireAuth, (req, res) => {
    const minutes = req.body.minutes || 300;
    const result = waClient.pauseBotForChat(req.params.phone, minutes);
    res.json(result);
  });

  // Reconnect / Logout (Authenticated)
  app.post('/api/whatsapp/reconnect', requireAuth, async (req, res) => {
    try {
      await waClient.start();
      res.json({ success: true, message: 'Reconnecting...' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/whatsapp/logout', requireAuth, async (req, res) => {
    try {
      await waClient.logout();
      res.json({ success: true, message: 'Logged out.' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Multi-Tenant Document Management API
  app.get('/api/documents', requireAuth, (req, res) => {
    try {
      res.json({
        activeDocumentId: req.user.activeDocumentId,
        documents: req.user.documents || []
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/documents', requireAuth, (req, res) => {
    try {
      const { title, content, makeActive } = req.body;
      const updatedUser = userManager.createUserDocument(req.user.apiKey, title, content, makeActive);
      broadcastSSE('documents_updated', {
        activeDocumentId: updatedUser.activeDocumentId,
        documents: updatedUser.documents
      });
      res.json({
        success: true,
        message: 'Sənəd uğurla yaradıldı!',
        documents: updatedUser.documents,
        activeDocumentId: updatedUser.activeDocumentId
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/documents/:id', requireAuth, (req, res) => {
    try {
      const { title, content, makeActive } = req.body;
      const updatedUser = userManager.saveUserDocument(req.user.apiKey, {
        id: req.params.id,
        title,
        content,
        makeActive
      });
      broadcastSSE('documents_updated', {
        activeDocumentId: updatedUser.activeDocumentId,
        documents: updatedUser.documents
      });
      res.json({
        success: true,
        message: 'Sənəd uğurla yadda saxlanıldı!',
        documents: updatedUser.documents,
        activeDocumentId: updatedUser.activeDocumentId
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/documents/:id/activate', requireAuth, (req, res) => {
    try {
      const ok = userManager.setUserActiveDocument(req.user.apiKey, req.params.id);
      if (ok) {
        const user = userManager.getUser(req.user.apiKey);
        broadcastSSE('documents_updated', {
          activeDocumentId: user.activeDocumentId,
          documents: user.documents
        });
        res.json({ success: true, message: 'Sənəd aktiv baza kimi təyin edildi!' });
      } else {
        res.status(404).json({ error: 'Sənəd tapılmadı' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/documents/:id', requireAuth, (req, res) => {
    try {
      const updatedUser = userManager.deleteUserDocument(req.user.apiKey, req.params.id);
      broadcastSSE('documents_updated', {
        activeDocumentId: updatedUser.activeDocumentId,
        documents: updatedUser.documents
      });
      res.json({
        success: true,
        message: 'Sənəd silindi',
        documents: updatedUser.documents,
        activeDocumentId: updatedUser.activeDocumentId
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Leads API (Profile-specific)
  app.get('/api/leads', requireAuth, (req, res) => {
    res.json(req.user.leads || []);
  });

  app.post('/api/leads/:id/status', requireAuth, (req, res) => {
    const { status, notes } = req.body;
    const updated = userManager.updateUserLeadStatus(req.user.apiKey, req.params.id, status, notes);
    if (updated) {
      broadcastSSE('leads_updated', {});
      res.json({ success: true, lead: updated });
    } else {
      res.status(404).json({ error: 'Lead not found' });
    }
  });

  // AI Sandbox / Test Simulator (Evaluated against User's Active Document)
  app.post('/api/test-ai', requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message text is required' });
      }
      const testContactId = 'test_simulation_' + req.user.id;
      const activeDoc = userManager.getUserActiveDocument(req.user);
      const result = await generateAIResponse(testContactId, message, activeDoc, req.user.apiKey);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

module.exports = { createServer };
