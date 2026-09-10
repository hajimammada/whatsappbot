const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const waClient = require('./whatsapp_client');
const { getLeads, updateLeadStatus } = require('./lead_manager');
const {
  generateAIResponse,
  getDocuments,
  saveDocument,
  createDocument,
  setActiveDocument,
  deleteDocument,
  getActiveDocument,
  getAgentSettings
} = require('./ai_engine');

const HOUSE_PROFILE_PATH = path.join(__dirname, '..', 'config', 'house_profile.json');

function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

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

  // SSE stream endpoint
  app.get('/api/events', (req, res) => {
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

  // Get status
  app.get('/api/status', (req, res) => {
    res.json(waClient.getStatus());
  });

  // Toggle Auto-Reply
  app.post('/api/auto-reply', (req, res) => {
    const { enabled } = req.body;
    waClient.setAutoReply(enabled);
    res.json({ success: true, autoReplyEnabled: waClient.autoReplyEnabled });
  });

  // Per-Chat Human Takeover & Resume endpoints
  app.get('/api/chat-statuses', (req, res) => {
    res.json(waClient.getAllChatStatuses());
  });

  app.post('/api/chat/:phone/resume', (req, res) => {
    const result = waClient.resumeBotForChat(req.params.phone);
    res.json(result);
  });

  app.post('/api/chat/:phone/pause', (req, res) => {
    const minutes = req.body.minutes || 300;
    const result = waClient.pauseBotForChat(req.params.phone, minutes);
    res.json(result);
  });

  // Reconnect / Logout
  app.post('/api/whatsapp/reconnect', async (req, res) => {
    try {
      await waClient.start();
      res.json({ success: true, message: 'Reconnecting...' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/whatsapp/logout', async (req, res) => {
    try {
      await waClient.logout();
      res.json({ success: true, message: 'Logged out.' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

// Document Management API (Universal Knowledge Base)
  app.get('/api/documents', (req, res) => {
    try {
      res.json(getDocuments());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/documents', (req, res) => {
    try {
      const { title, content, makeActive } = req.body;
      const kb = createDocument(title, content, makeActive);
      broadcastSSE('documents_updated', getDocuments());
      res.json({ success: true, message: 'Sənəd uğurla yaradıldı!', knowledgeBase: kb });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/documents/:id', (req, res) => {
    try {
      const { title, content, makeActive } = req.body;
      const kb = saveDocument({ id: req.params.id, title, content, makeActive });
      broadcastSSE('documents_updated', getDocuments());
      res.json({ success: true, message: 'Sənəd uğurla yadda saxlanıldı!', knowledgeBase: kb });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/documents/:id/activate', (req, res) => {
    try {
      const ok = setActiveDocument(req.params.id);
      if (ok) {
        broadcastSSE('documents_updated', getDocuments());
        res.json({ success: true, message: 'Sənəd aktiv baza kimi təyin edildi!' });
      } else {
        res.status(404).json({ error: 'Sənəd tapılmadı' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/documents/:id', (req, res) => {
    try {
      const kb = deleteDocument(req.params.id);
      broadcastSSE('documents_updated', getDocuments());
      res.json({ success: true, message: 'Sənəd silindi', knowledgeBase: kb });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Backward compatibility endpoint
  app.get('/api/house-profile', (req, res) => {
    res.json(getActiveDocument());
  });

  // Leads API
  app.get('/api/leads', (req, res) => {
    res.json(getLeads());
  });

  app.post('/api/leads/:id/status', (req, res) => {
    const { status, notes } = req.body;
    const updated = updateLeadStatus(req.params.id, status, notes);
    if (updated) {
      broadcastSSE('leads_updated', {});
      res.json({ success: true, lead: updated });
    } else {
      res.status(404).json({ error: 'Lead not found' });
    }
  });

  // AI Sandbox / Test Simulator
  app.post('/api/test-ai', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message text is required' });
      }
      const testContactId = 'test_simulation_user';
      const aiResponse = await generateAIResponse(testContactId, message);
      res.json(aiResponse);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

module.exports = { createServer };
