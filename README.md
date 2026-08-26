# 🏡 WhatsApp Real Estate AI Agent (tap.az Assistant)

[![Live Dashboard](https://img.shields.io/badge/Live_Dashboard-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://whatsappbot-8wk2.onrender.com/)
[![WhatsApp Bot](https://img.shields.io/badge/WhatsApp-Connected-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsappbot-8wk2.onrender.com/)

> 🌐 **Live Web Dashboard & QR Portal**: [https://whatsappbot-8wk2.onrender.com/](https://whatsappbot-8wk2.onrender.com/)

24/7 AI-powered WhatsApp Agent designed to automate buyer inquiries for property listings on **tap.az**.

---

## 🌟 Key Features

- **Multi-Device WhatsApp Connection:** Scan the QR code once with your phone (no Meta developer account or approval required).
- **Multilingual Understanding:** Speaks fluent **Azerbaijani**, **Russian**, and **English**.
- **Comprehensive Real Estate Knowledge Base (`config/house_profile.json`):**
  - Kupça (Çıxarış) & Mortgage eligibility
  - Exact pricing & polite negotiation defense (*"Qiymətdə yalnız evə real baxışdan sonra cüzi endirim mümkündür"*)
  - Room specs, total m², floor, living area, balcony
  - Renovation condition, kitchen furniture, heating (Kombi), utilities
  - Address, metro station proximity, landmark
  - Viewing hours & appointment rules
- **Serious Buyer Lead Qualification:** Identifies when someone wants to view the property (*"Evə baxmaq istəyirəm"*), records their phone number & time, and saves them to `data/leads.json`.
- **Instant Telegram Alert (Optional):** Sends real-time notification to your Telegram when an appointment request arrives.
- **Web Dashboard ([whatsappbot-8wk2.onrender.com](https://whatsappbot-8wk2.onrender.com/)):**
  - WhatsApp pairing QR code display
  - House Profile Editor (edit prices and specs anytime)
  - Qualified Leads & Viewing Appointments manager
  - Interactive AI Test Simulator (Sandbox)
  - Master Auto-Reply switch (ON/OFF)

---

## 🚀 Quick Start

### 1. Configure Environment (Optional LLM Key)
In `.env`:
```env
PORT=3000
AI_PROVIDER=gemini # 'gemini' | 'openai' | 'groq'
GEMINI_API_KEY=your_gemini_api_key
AUTO_REPLY_ENABLED=true
```
*(Note: If no API key is provided, the built-in Azerbaijani/Russian Rule Engine will handle all standard tap.az inquiries automatically!)*

### 2. Start the Agent
```bash
npm start
```

### 3. Scan QR Code
1. Open **WhatsApp** on your phone.
2. Go to **Settings** &rarr; **Linked Devices** &rarr; **Link a Device**.
3. Scan the QR code shown in your terminal or open `http://localhost:3000` in your browser.

---

## 🧪 Run Tests
```bash
npm test
```

---

## 📂 Project Structure
```
whatsappbot/
├── config/
│   ├── house_profile.json     # All house specifications & rules
│   └── agent_settings.json    # Bot settings & model configs
├── src/
│   ├── index.js               # Application launcher
│   ├── whatsapp_client.js     # Baileys WhatsApp client & QR logic
│   ├── ai_engine.js           # Multi-provider LLM & fallback NLP engine
│   ├── lead_manager.js        # Lead storage & appointment booker
│   └── server.js              # Express REST & SSE server
├── public/                    # Web Dashboard (HTML / CSS / JS)
├── data/                      # Persistent storage (leads.json)
└── test/                      # Automated test suite
```
