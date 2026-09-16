require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

const KNOWLEDGE_BASE_PATH = path.join(__dirname, '..', 'config', 'knowledge_base.json');
const AGENT_SETTINGS_PATH = path.join(__dirname, '..', 'config', 'agent_settings.json');

// In-memory conversation history per contact
const conversationHistories = new Map();

function getKnowledgeBase() {
  try {
    if (!fs.existsSync(KNOWLEDGE_BASE_PATH)) {
      const initial = {
        activeDocumentId: "doc_1",
        documents: [
          {
            id: "doc_1",
            title: "Əsas Məlumat Sənədi",
            content: "Bura botun cavab verməsi üçün istədiyiniz məlumatları yaza bilərsiniz.",
            updatedAt: new Date().toISOString()
          }
        ]
      };
      fs.writeFileSync(KNOWLEDGE_BASE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(KNOWLEDGE_BASE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading knowledge base:', err);
    return { activeDocumentId: null, documents: [] };
  }
}

function saveKnowledgeBase(kb) {
  try {
    fs.writeFileSync(KNOWLEDGE_BASE_PATH, JSON.stringify(kb, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving knowledge base:', err);
    return false;
  }
}

function getActiveDocument() {
  const kb = getKnowledgeBase();
  const docs = kb.documents || [];
  if (docs.length === 0) {
    return { id: "default", title: "Ümumi Baza", content: "" };
  }
  const active = docs.find(d => d.id === kb.activeDocumentId);
  return active || docs[0];
}

function getDocuments() {
  const kb = getKnowledgeBase();
  return {
    activeDocumentId: kb.activeDocumentId,
    documents: kb.documents || []
  };
}

function saveDocument(doc) {
  const kb = getKnowledgeBase();
  kb.documents = kb.documents || [];
  const idx = kb.documents.findIndex(d => d.id === doc.id);
  const now = new Date().toISOString();
  
  if (idx !== -1) {
    kb.documents[idx] = { ...kb.documents[idx], ...doc, updatedAt: now };
  } else {
    const newDoc = {
      id: doc.id || 'doc_' + Date.now(),
      title: doc.title || 'Yeni Sənəd',
      content: doc.content || '',
      updatedAt: now
    };
    kb.documents.push(newDoc);
    if (!kb.activeDocumentId) {
      kb.activeDocumentId = newDoc.id;
    }
  }

  if (doc.makeActive) {
    kb.activeDocumentId = doc.id;
  }

  saveKnowledgeBase(kb);
  return kb;
}

function createDocument(title, content, makeActive = false) {
  const newDoc = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: title || 'Yeni Sənəd',
    content: content || '',
    makeActive: makeActive
  };
  return saveDocument(newDoc);
}

function setActiveDocument(id) {
  const kb = getKnowledgeBase();
  const exists = (kb.documents || []).some(d => d.id === id);
  if (exists) {
    kb.activeDocumentId = id;
    saveKnowledgeBase(kb);
    return true;
  }
  return false;
}

function deleteDocument(id) {
  const kb = getKnowledgeBase();
  kb.documents = kb.documents || [];
  if (kb.documents.length <= 1) {
    throw new Error("Ən azı 1 sənəd qalmalıdır. Yeganə sənədi silə bilməzsiniz.");
  }
  kb.documents = kb.documents.filter(d => d.id !== id);
  if (kb.activeDocumentId === id) {
    kb.activeDocumentId = kb.documents[0].id;
  }
  saveKnowledgeBase(kb);
  return kb;
}

function getAgentSettings() {
  try {
    const raw = fs.readFileSync(AGENT_SETTINGS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading agent settings:', err);
    return {};
  }
}

function normalizeContactKey(contactId) {
  if (!contactId) return 'unknown';
  const clean = String(contactId).replace(/@.+/, '').replace(/\D/g, '');
  return clean || String(contactId);
}

function getChatHistory(contactId) {
  const key = normalizeContactKey(contactId);
  if (!conversationHistories.has(key)) {
    conversationHistories.set(key, []);
  }
  return conversationHistories.get(key);
}

function appendToChatHistory(contactId, role, text) {
  const key = normalizeContactKey(contactId);
  const history = getChatHistory(key);
  history.push({ role, text, timestamp: new Date().toISOString() });
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

function buildSystemPrompt(activeDoc) {
  return `Sən WhatsApp üzərindən müştərilərin və ya istifadəçilərin suallarını cavablandıran ağıllı, nəzakətli, operativ və peşəkar AI Köməkçisisən.
Sənin vəzifən aşağıda verilmiş rəsmi BİLİK BAZASI (SƏNƏD) əsasında insanlara dəqiq, aydın və faydalı cavablar verməkdir.

### AKTİV BİLİK BAZASI VƏ SƏNƏD:
Sənədin Başlığı: ${activeDoc.title || 'Ümumi Baza'}
---
${activeDoc.content || 'Məlumat daxil edilməyib.'}
---

### SƏNİN QAYDALARIN VƏ TƏLİMATLARIN:
1. **DİL UYĞUNLUĞU:** Müştəri hansı dildə yazırsa (Azərbaycan dili, Rus dili və ya İngilis dili), həmin dildə də cavab ver.
2. **YALNIZ SƏNƏDƏ ƏSASLAN:** Yalnız yuxarıdakı sənəddə mövcud olan faktları söylə. Əgər sənəddə qeyd olunmayan bir detal soruşularsa, uydurma. "Bu barədə dəqiq məlumatı sahibindən / rəhbərlikdən dəqiqləşdirib sizə məlumat verərik" de.
3. **QİYMƏT VƏ RAZILAŞMA:** Əgər sənəddə qiymət və ya endirim siyasəti qeyd olunubsa, sənəddəki qaydalara tam əməl et.
4. **GÖRÜŞ / SİFARİŞ / BAXIŞ TƏYİNİ:** Əgər müştəri görüş təyin etmək, evə/məhsula baxmaq və ya sifariş vermək istədiyini bildirsə, ona uyğun vaxtı bildir və zəhmət olmasa **adını** və **dəqiq istədiyi gün/saatı** yazmasını xahiş et.
5. **TON VƏ FORMAT:** WhatsApp formatına uyğun olaraq çox uzun olmayan, oxunaqlı, zərurət olduqda emojili (✨, 📍, 📞) şəkildə yaz.
6. **BİRLƏŞDİRİLMİŞ VƏ ARDICIL MESAJLAR:** Müştəri ardıcıl bir neçə qısa mesaj göndərə bilər (bunlar sənə birgə sətirlərlə təqdim olunur). Mesajdakı bütün fikirləri, sualları və əvvəlki söhbət tarixçəsini bütöv şəkildə analiz et və hər bir sualı cavablandır (məsələn: istifadəçi "hansı mesajları yazmışam", "nə demişdim", "əvvəlki sualım" kimi suallar verərsə, söhbət tarixçəsinə istinad edərək dəqiq cavab ver).

### ÇIXIŞ FORMATI (JSON):
Sən hər bir sorğu üçün YALNIZ aşağıdakı JSON formatında cavab verməlisən (başqa heç nə yazma):
{
  "reply_text": "Müştəriyə göndəriləcək nəzakətli və dəqiq cavab mətni",
  "is_viewing_request": true/false (müştəri görüş/baxış/sifariş təyin etmək istəyirsə true),
  "detected_name": "müştərinin adı (əgər mesajda qeyd edibsə, yoxsa null)",
  "appointment_time": "istədiyi vaxt/gün (əgər qeyd edibsə, yoxsa null)",
  "language": "az" | "ru" | "en",
  "summary": "Müraciətin 1 cümləlik qısa xülasəsi"
}`;
}

// Fallback rule engine when external API keys are unavailable
function fallbackRuleEngine(incomingMessage, activeDoc, contactId = null) {
  const msg = incomingMessage.toLowerCase().trim();
  const docText = activeDoc.content || '';
  const lines = docText.split('\n').map(l => l.trim()).filter(Boolean);

  let isViewing = false;
  let reply = "";
  let lang = /[а-яё]/i.test(msg) ? "ru" : "az";

  // Check if asking about previous conversation history
  if (contactId && (msg.includes("hansı mesaj") || msg.includes("hansi mesaj") || msg.includes("nə yazmışam") || msg.includes("ne yazmisam") || msg.includes("əvvəlki mesaj") || msg.includes("son mesaj") || msg.includes("nə soruşmuşdum") || msg.includes("ne sorusmusdum"))) {
    const hist = getChatHistory(contactId);
    const userMsgs = hist.filter(h => h.role === 'user').map(h => `• ${h.text}`);
    if (userMsgs.length > 0) {
      if (lang === "ru") {
        reply = `Ваши предыдущие сообщения:\n${userMsgs.slice(-5).join('\n')}\n\nЧем я еще могу помочь?`;
      } else {
        reply = `Sizin əvvəlki müraciətləriniz:\n${userMsgs.slice(-5).join('\n')}\n\nSizə başqa necə kömək edə bilərəm?`;
      }
      return {
        reply_text: reply,
        is_viewing_request: false,
        detected_name: null,
        appointment_time: null,
        language: lang,
        summary: incomingMessage.substring(0, 80)
      };
    }
  }

  // Check viewing / appointment
  if (msg.includes("baxmaq") || msg.includes("baxis") || msg.includes("baxış") || msg.includes("görüş") || msg.includes("gorus") || msg.includes("посмотреть") || msg.includes("осмотр") || msg.includes("встреч")) {
    isViewing = true;
    const scheduleLine = lines.find(l => /baxış|saat|vaxt|həftə|gün|осмотр|время/i.test(l));
    if (lang === "ru") {
      reply = `Здравствуйте! ${scheduleLine || 'Осмотр / встреча возможна по предварительной договоренности'}. Пожалуйста, укажите Ваше имя и удобное время для встречи 🏡`;
    } else {
      reply = `Salam! ${scheduleLine || 'Görüş / baxış əvvəlcədən razılaşdırmaqla mümkündür'}. Zəhmət olmasa adınızı və gəlmək istədiyiniz dəqiq vaxtı qeyd edin 🏡`;
    }
  } else {
    // Search for keywords in the document text
    const keywords = msg.split(/\s+/).filter(w => w.length > 3);
    const matchedLines = lines.filter(l => {
      const lower = l.toLowerCase();
      return keywords.some(k => lower.includes(k));
    });

    if (matchedLines.length > 0) {
      reply = matchedLines.slice(0, 4).join('\n');
    } else {
      // Return document summary / first few lines
      const preview = lines.slice(0, 5).join('\n');
      if (lang === "ru") {
        reply = `Здравствуйте! Информация:\n\n${preview}\n\nКакой именно вопрос вас интересует?`;
      } else {
        reply = `Salam! Məlumat:\n\n${preview}\n\nHansı məlumatla maraqlanırsınız?`;
      }
    }
  }

  return {
    reply_text: reply,
    is_viewing_request: isViewing,
    detected_name: null,
    appointment_time: isViewing ? "Görüş / baxış istəyi qeydə alındı" : null,
    language: lang,
    summary: incomingMessage.substring(0, 80)
  };
}

async function discoverAvailableGeminiModels(cleanKey) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.models)) {
        const supported = data.models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''));

        if (supported.length > 0) {
          supported.sort((a, b) => {
            const score = (m) => {
              if (m.includes('3.1-pro')) return 10;
              if (m.includes('3.1-flash')) return 9;
              if (m.includes('3.1')) return 8;
              if (m.includes('2.5-flash')) return 7;
              if (m.includes('2.5-pro')) return 6;
              if (m.includes('2.5')) return 5;
              return 1;
            };
            return score(b) - score(a);
          });
          return supported;
        }
      }
    }
  } catch (err) {}
  return null;
}

async function validateGeminiApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 15) {
    return { valid: false, error: 'Daxil edilən API Key formatı yanlışdır. Zəhmət olmasa real Google Gemini API açarı daxil edin.' };
  }
  const cleanKey = apiKey.trim();
  // Allow mock keys in test mode
  if (process.env.NODE_ENV === 'test' || cleanKey.startsWith('mock_')) {
    return { valid: true };
  }

  const discovered = await discoverAvailableGeminiModels(cleanKey);
  const validationModels = (discovered && discovered.length > 0)
    ? discovered
    : ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];

  let lastErr = null;

  for (const modelName of validationModels) {
    try {
      const genAI = new GoogleGenerativeAI(cleanKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      await model.generateContent("ping");
      return { valid: true, activeModel: modelName };
    } catch (err) {
      lastErr = err;
      const msg = err.message || '';
      if (msg.includes('API_KEY_INVALID') || msg.includes('400') || msg.includes('API key not valid') || msg.includes('403') || msg.includes('UNAUTHENTICATED')) {
        return { valid: false, error: 'Daxil edilən Google Gemini API Key etibarsızdır. Google AI Studio-dan düzgün açar əldə edin (aistudio.google.com).' };
      }
      if (msg.includes('429') || msg.includes('quota') || msg.includes('ResourceExhausted')) {
        // Key is valid, just quota was reached on free tier
        return { valid: true, warning: 'Açar etibarlıdır, lakin Google kvotası tükənib.' };
      }
      // If 404 on this model or 503, try next candidate model
      continue;
    }
  }

  const errorMsg = lastErr ? (lastErr.message || '') : 'Unknown error';
  return { valid: false, error: 'Google Gemini API ilə əlaqə qurula bilmədi: ' + errorMsg };
}

async function generateAIResponse(contactId, incomingMessage, customActiveDoc = null, userGeminiKey = null) {
  const activeDoc = customActiveDoc || getActiveDocument();
  const agentSettings = getAgentSettings();
  const history = getChatHistory(contactId);

  // Use user's own Gemini API key
  const geminiKey = userGeminiKey || process.env.GEMINI_API_KEY || '';

  const systemPrompt = buildSystemPrompt(activeDoc);

  if (geminiKey && geminiKey !== 'your_gemini_api_key_here' && !geminiKey.startsWith('mock_')) {
    const discovered = await discoverAvailableGeminiModels(geminiKey);
    const configuredModel = agentSettings.models?.gemini?.model_name;
    const baseList = (discovered && discovered.length > 0) ? discovered : [
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash'
    ];
    const candidateModels = [
      configuredModel && !configuredModel.includes('1.5') && !configuredModel.includes('3.6') && !configuredModel.includes('2.0') ? configuredModel : baseList[0],
      ...baseList
    ];
    const uniqueModels = [...new Set(candidateModels)];

    let lastError = null;

    for (const modelName of uniqueModels) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: (agentSettings.models && agentSettings.models.gemini && agentSettings.models.gemini.temperature) || 0.3
          }
        });

        const conversationText = history.map(h => `${h.role === 'user' ? 'İstifadəçi' : 'Köməkçi'}: ${h.text}`).join('\n');
        const prompt = `${systemPrompt}\n\n### SÖHBƏT TARİXÇƏSİ:\n${conversationText}\n\nİstifadəçi: ${incomingMessage}\n\nJSON Cavab:`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        appendToChatHistory(contactId, 'user', incomingMessage);
        appendToChatHistory(contactId, 'assistant', parsed.reply_text);
        return parsed;
      } catch (err) {
        lastError = err;
        console.warn(`Gemini model ${modelName} call failed:`, err.message);

        // If invalid key, fail immediately
        if (err.message.includes('API_KEY_INVALID') || err.message.includes('400') || err.message.includes('403') || err.message.includes('API key not valid')) {
          throw new Error('Google Gemini API açarınız etibarsızdır və ya bloklanıb.');
        }

        // Otherwise (503 high demand, 429 quota, model unavailable), try next candidate model
        continue;
      }
    }

    // If all models failed with 503 or 429, log and fall through to resilient fallback engine
    if (lastError) {
      console.warn('All Gemini candidate models temporarily unavailable, falling back to internal rule engine.');
    }
  }

  // OpenAI or Groq (if configured)
  const provider = process.env.AI_PROVIDER || 'gemini';
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if ((provider === 'openai' || provider === 'groq') && (openaiKey || groqKey)) {
    try {
      const isGroq = provider === 'groq';
      const client = new OpenAI({
        apiKey: isGroq ? groqKey : openaiKey,
        baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
      });

      const modelName = isGroq
        ? ((agentSettings.models && agentSettings.models.groq && agentSettings.models.groq.model_name) || 'llama-3.3-70b-versatile')
        : ((agentSettings.models && agentSettings.models.openai && agentSettings.models.openai.model_name) || 'gpt-4o-mini');

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role, content: h.text })),
        { role: 'user', content: incomingMessage }
      ];

      const response = await client.chat.completions.create({
        model: modelName,
        messages: messages,
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      appendToChatHistory(contactId, 'user', incomingMessage);
      appendToChatHistory(contactId, 'assistant', parsed.reply_text);
      return parsed;
    } catch (err) {
      console.warn('OpenAI/Groq API call failed:', err.message);
    }
  }

  // Resilient Fallback Engine
  const fallbackResult = fallbackRuleEngine(incomingMessage, activeDoc, contactId);
  appendToChatHistory(contactId, 'user', incomingMessage);
  appendToChatHistory(contactId, 'assistant', fallbackResult.reply_text);
  return fallbackResult;
}

module.exports = {
  validateGeminiApiKey,
  generateAIResponse,
  getKnowledgeBase,
  saveKnowledgeBase,
  getActiveDocument,
  getDocuments,
  saveDocument,
  createDocument,
  setActiveDocument,
  deleteDocument,
  getAgentSettings,
  getChatHistory
};
