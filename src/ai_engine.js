require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

const HOUSE_PROFILE_PATH = path.join(__dirname, '..', 'config', 'house_profile.json');
const AGENT_SETTINGS_PATH = path.join(__dirname, '..', 'config', 'agent_settings.json');

// In-memory conversation history per contact
const conversationHistories = new Map();

function getHouseProfile() {
  try {
    const raw = fs.readFileSync(HOUSE_PROFILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading house profile:', err);
    return {};
  }
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

function getChatHistory(contactId) {
  if (!conversationHistories.has(contactId)) {
    conversationHistories.set(contactId, []);
  }
  return conversationHistories.get(contactId);
}

function appendToChatHistory(contactId, role, text) {
  const history = getChatHistory(contactId);
  history.push({ role, text, timestamp: new Date().toISOString() });
  // Keep last 12 messages to avoid context overflow
  if (history.length > 12) {
    history.splice(0, history.length - 12);
  }
}

function buildSystemPrompt(houseProfile, agentSettings) {
  return `Sən tap.az elanı üzrə mənzil satan ev sahibinin şəxsi WhatsApp köməkçisisən (AI Real Estate Assistant).
Sənin vəzifən potensial alıcıların suallarına verilmiş məlumatlar əsasında dəqiq, nəzakətli, qısa və peşəkar cavab verməkdir.

### MƏNZİL VƏ SATIŞ HAQQINDA BÜTÜN MƏLUMATLAR:
${JSON.stringify(houseProfile, null, 2)}

### SƏNİN QAYDALARIN VƏ TƏLİMATLARIN:
1. **DİL UYĞUNLUĞU:** Alıcı hansı dildə yazırsa (Azərbaycan dili, Rus dili və ya İngilis dili), həmin dildə də cavab ver.
2. **SON QİYMƏT VƏ ENDİRİM:** Telefonda və ya mesajda əsla son qiymət və böyük endirim müzakirə etmə. Cavab: "Qiymət elanda qeyd olunandır. Yalnız mənzilə real baxışdan sonra cüzi endirim müzakirə edilə bilər."
3. **KUPÇA VƏ İPOTEKA:** Əgər sənədlərdə Kupça (Çıxarış) və ipoteka yararlılığı varsa, bunu fəxrlə və aydın vurğula: "Bəli, mənzilin Çıxarışı (Kupçası) var və həm dövlət, həm də kommersiya ipotekasına tam yararlıdır."
4. **TƏMİR VƏ ƏŞYALAR:** Yalnız profildə qeyd olunan detalları de. Əgər mətbəx mebeli qalırsa qeyd et.
5. **BAXIŞ VƏ GÖRÜŞ TƏYİNİ:** Əgər alıcı evə baxmaq istədiyini bildirsə ("Baxmaq istəyirəm", "Nə vaxt gələ bilərəm?", "Hansı gün baxmaq olar?"), ona uyğun saatları bildir və zəhmət olmasa **adını** və **dəqiq gəlmək istədiyi gün/saatı** yazmasını xahiş et.
6. **MAKLERLƏR VƏ VASİTƏÇİLƏR:** Maklerlərə nəzakətlə bildir ki, yalnız real alıcı ilə birlikdə müraciət edə bilərlər və şəkilləri başqa saytlarda paylaşmaq qadağandır.
7. **BİLMƏDİYİN MƏLUMATLAR:** Əgər mənzil haqqında profildə olmayan spesifik bir sual verilsə, yalandan uydurma. "Bu detalı dəqiqləşdirib sizə məlumat verərik" de.
8. **FORMAT:** Cavabları WhatsApp-a uyğun olaraq çox uzun olmayan, oxunaqlı, zərurət olduqda emojili (🏡, 📍, 🔑) şəkildə yaz.

### ÇIXIŞ FORMATI (JSON):
Sən hər bir sorğu üçün YALNIZ aşağıdakı JSON formatında cavab verməlisən (başqa heç nə yazma):
{
  "reply_text": "Alıcıya göndəriləcək nəzakətli və dəqiq cavab mətni",
  "is_viewing_request": true/false (alıcı evə baxmaq/gəlmək istəyirsə true),
  "detected_name": "alıcının adı (əgər mesajda qeyd edibsə, yoxsa null)",
  "appointment_time": "istədiyi vaxt/gün (əgər qeyd edibsə, yoxsa null)",
  "language": "az" | "ru" | "en",
  "summary": "Müraciətin 1 cümləlik qısa xülasəsi"
}`;
}

// Fallback rule engine when no API keys are provided
function fallbackRuleEngine(incomingMessage, houseProfile) {
  const msg = incomingMessage.toLowerCase().trim();
  const info = houseProfile.property_info || {};
  const specs = houseProfile.specifications || {};
  const reno = houseProfile.renovation_and_utilities || {};
  const docs = houseProfile.documents_and_legal || {};
  const pricing = houseProfile.pricing_and_negotiation || {};
  const schedule = houseProfile.viewing_schedule || {};

  let isViewing = false;
  let reply = "";
  let lang = "az";

  // Check language
  if (/[а-яё]/i.test(msg)) {
    lang = "ru";
  }

  if (lang === "ru") {
    if (msg.includes("цена") || msg.includes("стоимость") || msg.includes("последняя цена") || msg.includes("скидк") || msg.includes("окончательно")) {
      reply = `Здравствуйте! Стоимость квартиры: ${pricing.price_azn ? pricing.price_azn.toLocaleString() : '245,000'} AZN. ${pricing.discount_policy || 'Небольшая скидка возможна только после реального осмотра квартиры.'}`;
    } else if (msg.includes("купчая") || msg.includes("документ") || msg.includes("чыхарыш") || msg.includes("ипотек")) {
      reply = `Здравствуйте! Документы: ${docs.document_type || 'Купчая (Çıxarış) есть'}. ${docs.mortgage_eligible || 'Подходит под государственную и коммерческую ипотеку.'}`;
    } else if (msg.includes("адрес") || msg.includes("где") || msg.includes("локация") || msg.includes("метро") || msg.includes("ориентир")) {
      reply = `Квартира находится по адресу: ${info.district || 'Насиминский р.'}, ${info.landmark || 'ориентир м. 28 Мая / Низами'}. Точная локация: ${info.address || ''}`;
    } else if (msg.includes("посмотреть") || msg.includes("осмотр") || msg.includes("когда можно") || msg.includes("приехать") || msg.includes("время")) {
      isViewing = true;
      reply = `Здравствуйте! Осмотр возможен: ${schedule.availability_hours || 'в будние дни 17:00-21:00, в выходные 11:00-20:00'}. Пожалуйста, укажите Ваше имя и удобное для Вас время, чтобы согласовать визит 🏡`;
    } else if (msg.includes("ремонт") || msg.includes("мебель") || msg.includes("комби") || msg.includes("комнат") || msg.includes("этаж")) {
      reply = `Квартира: ${specs.rooms || '3 комнаты'}, площадь: ${specs.area_sqm || 115} м², этаж: ${specs.floor}/${specs.total_floors}. ${reno.renovation_status || 'Отличный ремонт'}. Отопление: ${reno.heating_system || 'Комби'}.`;
    } else {
      reply = `Здравствуйте! Спасибо за интерес к объявлению. Квартира: ${specs.rooms || '3-комнатная'}, ${specs.area_sqm || 115} м², ${info.district || 'Насиминский р.'}. Цена: ${pricing.price_azn ? pricing.price_azn.toLocaleString() : '245,000'} AZN. Купчая есть, подходит под ипотеку. Чем могу помочь?`;
    }
  } else {
    // Azerbaijani responses
    if (msg.includes("qiymət") || msg.includes("neçəyə") || msg.includes("son qiymət") || msg.includes("endirim") || msg.includes("asagi") || msg.includes("aşağı")) {
      reply = `Salam! Mənzilin qiyməti: ${pricing.price_azn ? pricing.price_azn.toLocaleString() : '245 000'} AZN. ${pricing.discount_policy || 'Qiymətdə yalnız evə real baxışdan sonra cüzi endirim mümkündür.'}`;
    } else if (msg.includes("kupca") || msg.includes("kupça") || msg.includes("cixaris") || msg.includes("çıxarış") || msg.includes("ipoteka") || msg.includes("sened") || msg.includes("sənəd")) {
      reply = `Salam! Sənəd: ${docs.document_type || 'Kupça (Çıxarış) var'}. ${docs.mortgage_eligible || 'İpotekaya tam yararlıdır.'} ${docs.registration_status || 'Qeydiyyatda heç kim yoxdur.'}`;
    } else if (msg.includes("unvan") || msg.includes("ünvan") || msg.includes("harada") || msg.includes("yerlesir") || msg.includes("yerləşir") || msg.includes("metro") || msg.includes("oriyentir")) {
      reply = `Mənzil ${info.district || 'Nəsimi r.'}, ${info.metro_proximity || '28 May və Nizami m/s yaxınlığı'}, ${info.landmark || 'Koroğlu parkı ətrafı'} ünvanında yerləşir. 📍`;
    } else if (msg.includes("baxmaq") || msg.includes("baxis") || msg.includes("baxış") || msg.includes("ne vaxt") || msg.includes("nə vaxt") || msg.includes("gelmek") || msg.includes("gəlmək") || msg.includes("gorus") || msg.includes("görüş")) {
      isViewing = true;
      reply = `Salam! Mənzilə baxış vaxtları: ${schedule.availability_hours || 'Həftə içi 17:00 - 21:00, Həftə sonu 11:00 - 20:00'}. Baxış üçün zəhmət olmasa adınızı və gəlmək istədiyiniz dəqiq gün/saatı qeyd edin 🏡`;
    } else if (msg.includes("temir") || msg.includes("təmir") || msg.includes("esya") || msg.includes("əşya") || msg.includes("kombi") || msg.includes("otaq") || msg.includes("mertebe") || msg.includes("mərtəbə") || msg.includes("kvadrat") || msg.includes("sahe") || msg.includes("sahə")) {
      reply = `Mənzil: ${specs.rooms || '3 otaqlı'}, sahəsi: ${specs.area_sqm || 115} m², mərtəbə: ${specs.floor}/${specs.total_floors}. ${reno.renovation_status || 'Əla təmirli'}. İstilik sistemi: ${reno.heating_system || 'Kombi'}. ${reno.furnished_status || ''}`;
    } else if (msg.includes("makler") || msg.includes("vasiteci") || msg.includes("vasitəçi") || msg.includes("faiz") || msg.includes("komissiya")) {
      reply = `Mənzil birbaşa mülkiyyətçi tərəfindən satılır. Maklerlər yalnız real alıcıları olduğu halda müraciət edə bilərlər. Şəkillərin icazəsiz paylaşılması qadağandır.`;
    } else {
      reply = `Salam! Elanla maraqlandığınız üçün təşəkkür edirik. Mənzil: ${specs.rooms || '3 otaq'}, ${specs.area_sqm || 115} m², ${info.district || 'Nəsimi r.'}. Qiymət: ${pricing.price_azn ? pricing.price_azn.toLocaleString() : '245 000'} AZN. Kupçası var, ipotekaya yararlıdır. Hansı məlumatla maraqlanırsınız? 🏡`;
    }
  }

  return {
    reply_text: reply,
    is_viewing_request: isViewing,
    detected_name: null,
    appointment_time: isViewing ? "Baxış istəyi qeydə alındı" : null,
    language: lang,
    summary: incomingMessage.substring(0, 80)
  };
}

async function generateAIResponse(contactId, incomingMessage) {
  const houseProfile = getHouseProfile();
  const agentSettings = getAgentSettings();
  const history = getChatHistory(contactId);

  const provider = process.env.AI_PROVIDER || 'gemini';
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // Build context messages for LLM
  const systemPrompt = buildSystemPrompt(houseProfile, agentSettings);

  // If Gemini API Key is configured
  if ((provider === 'gemini' || !openaiKey && !groqKey) && geminiKey && geminiKey !== 'your_gemini_api_key_here') {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = (agentSettings.models && agentSettings.models.gemini && agentSettings.models.gemini.model_name) || "gemini-3.6-flash";
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: (agentSettings.models && agentSettings.models.gemini && agentSettings.models.gemini.temperature) || 0.3
        }
      });

      const conversationText = history.map(h => `${h.role === 'user' ? 'Alıcı' : 'Köməkçi'}: ${h.text}`).join('\n');
      const prompt = `${systemPrompt}\n\n### SÖHBƏT TARİXÇƏSİ:\n${conversationText}\n\nAlıcı: ${incomingMessage}\n\nJSON Cavab:`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      appendToChatHistory(contactId, 'user', incomingMessage);
      appendToChatHistory(contactId, 'assistant', parsed.reply_text);
      return parsed;
    } catch (err) {
      console.warn('Gemini API call failed, falling back to rule engine or secondary provider:', err.message);
    }
  }

  // If OpenAI or Groq is configured
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

  // Fallback Rule Engine (Zero external API dependencies, 100% reliable)
  const fallbackResult = fallbackRuleEngine(incomingMessage, houseProfile);
  appendToChatHistory(contactId, 'user', incomingMessage);
  appendToChatHistory(contactId, 'assistant', fallbackResult.reply_text);
  return fallbackResult;
}

module.exports = {
  generateAIResponse,
  getHouseProfile,
  getAgentSettings,
  getChatHistory
};
