// Client-side Application Logic for WhatsApp AI Agent
// Features: Multilingual (AZ, RU, EN), Clean Minimal Tabs (Connect, Messages, Data, Test), BYOK Gemini Auth

document.addEventListener('DOMContentLoaded', () => {
  // -----------------------------------------------------------------
  // 1. Multilingual (i18n) Dictionary & Switcher
  // -----------------------------------------------------------------
  const I18N = {
    az: {
      brand_title: "whatsappbot.hajimammad.com",
      tab_connect: "Connect",
      tab_messages: "Messages",
      tab_data: "Data",
      tab_test: "Test",
      status_connecting: "Qoşulur...",
      status_connected: "Qoşuldu ✅",
      status_waiting_qr: "QR Skan Edin",
      status_disconnected: "Bağlantı kəsildi",
      auto_reply_on: "Avto-Cavab: Aktiv",
      auto_reply_off: "Avto-Cavab: Deaktiv",
      logout: "Çıxış",
      reconnect: "Yenilə",
      wa_header: "WhatsApp Qoşulması",
      qr_hint: "WhatsApp ilə QR kodu skan edin",
      live_feed: "Canlı Mesajlar",
      empty_feed: "Hələ yeni mesaj yoxdur",
      stat_questions: "Suallar",
      stat_leads: "Müştərilər",
      stat_appointments: "Görüşlər",
      tbl_contact: "Alıcı / Nömrə",
      tbl_type: "Müraciət",
      tbl_interest: "Maraq",
      tbl_time: "İstədiyi Vaxt",
      tbl_status: "Bot Statusu",
      tbl_last_msg: "Son Mesaj",
      tbl_date: "Tarix",
      tbl_action: "Əlaqə",
      no_leads: "Hələ qeydə alınmış alıcı yoxdur.",
      btn_resume: "▶️ Aktivləşdir",
      btn_pause: "⏸️ Dayandır (5s)",
      bot_active: "🟢 Aktivdir",
      bot_paused: "⏸️ Dayandırılıb",
      docs_header: "Sənədlər",
      btn_new_doc: "➕ Yeni Sənəd",
      btn_save_doc: "💾 Yadda Saxla",
      btn_delete_doc: "🗑️ Sil",
      doc_title_label: "Sənədin Başlığı:",
      doc_title_ph: "Məs: Ev Satışı, Avtomobil, Xidmət...",
      doc_content_label: "Məlumat Mətni:",
      doc_content_ph: "Bura botun bilməsini istədiyiniz bütün məlumatları sərbəst şəkildə yazın...",
      doc_active_toggle: "⭐ Bu sənədi WhatsApp üçün Aktiv Baza təyin et",
      sim_header: "AI Test Simulyatoru",
      sim_input_ph: "Bota sual verin...",
      sim_send: "Göndər 🚀",
      modal_title: "Google Gemini API Açarınızla Giriş",
      modal_desc: "Bot sizin şəxsi Google Gemini kvotanız üzərindən işləyir.",
      modal_key_label: "Google Gemini API Key:",
      modal_submit: "Daxil Ol 🚀"
    },
    ru: {
      brand_title: "whatsappbot.hajimammad.com",
      tab_connect: "Connect",
      tab_messages: "Messages",
      tab_data: "Data",
      tab_test: "Test",
      status_connecting: "Подключение...",
      status_connected: "Подключено ✅",
      status_waiting_qr: "Сканируйте QR",
      status_disconnected: "Отключено",
      auto_reply_on: "Авто-ответ: Вкл",
      auto_reply_off: "Авто-ответ: Выкл",
      logout: "Выход",
      reconnect: "Обновить",
      wa_header: "Подключение WhatsApp",
      qr_hint: "Отсканируйте QR-код через WhatsApp",
      live_feed: "Живой чат",
      empty_feed: "Сообщений пока нет",
      stat_questions: "Вопросы",
      stat_leads: "Клиенты",
      stat_appointments: "Встречи",
      tbl_contact: "Клиент / Номер",
      tbl_type: "Тип",
      tbl_interest: "Интерес",
      tbl_time: "Желаемое время",
      tbl_status: "Статус бота",
      tbl_last_msg: "Последнее сообщение",
      tbl_date: "Дата",
      tbl_action: "Действие",
      no_leads: "Пока нет зафиксированных клиентов.",
      btn_resume: "▶️ Включить",
      btn_pause: "⏸️ Пауза (5ч)",
      bot_active: "🟢 Активен",
      bot_paused: "⏸️ Приостановлен",
      docs_header: "Документы",
      btn_new_doc: "➕ Новый документ",
      btn_save_doc: "💾 Сохранить",
      btn_delete_doc: "🗑️ Удалить",
      doc_title_label: "Название документа:",
      doc_title_ph: "Например: Продажа квартиры, Автомобиль...",
      doc_content_label: "Текст базы знаний:",
      doc_content_ph: "Введите всю информацию, которую бот должен использовать для ответов...",
      doc_active_toggle: "⭐ Сделать этот документ активной базой",
      sim_header: "AI Тестовый симулятор",
      sim_input_ph: "Задайте вопрос боту...",
      sim_send: "Отправить 🚀",
      modal_title: "Вход с Google Gemini API Key",
      modal_desc: "Бот работает на вашей личной квоте Google Gemini.",
      modal_key_label: "Google Gemini API Key:",
      modal_submit: "Войти 🚀"
    },
    en: {
      brand_title: "whatsappbot.hajimammad.com",
      tab_connect: "Connect",
      tab_messages: "Messages",
      tab_data: "Data",
      tab_test: "Test",
      status_connecting: "Connecting...",
      status_connected: "Connected ✅",
      status_waiting_qr: "Scan QR",
      status_disconnected: "Disconnected",
      auto_reply_on: "Auto-Reply: ON",
      auto_reply_off: "Auto-Reply: OFF",
      logout: "Logout",
      reconnect: "Refresh",
      wa_header: "WhatsApp Connection",
      qr_hint: "Scan QR code with WhatsApp",
      live_feed: "Live Messages",
      empty_feed: "No messages yet",
      stat_questions: "Questions",
      stat_leads: "Clients",
      stat_appointments: "Meetings",
      tbl_contact: "Contact / Phone",
      tbl_type: "Type",
      tbl_interest: "Interest",
      tbl_time: "Preferred Time",
      tbl_status: "Bot Status",
      tbl_last_msg: "Last Message",
      tbl_date: "Date",
      tbl_action: "Action",
      no_leads: "No customer leads recorded yet.",
      btn_resume: "▶️ Resume Bot",
      btn_pause: "⏸️ Pause (5h)",
      bot_active: "🟢 Active",
      bot_paused: "⏸️ Paused",
      docs_header: "Documents",
      btn_new_doc: "➕ New Document",
      btn_save_doc: "💾 Save",
      btn_delete_doc: "🗑️ Delete",
      doc_title_label: "Document Title:",
      doc_title_ph: "e.g., Apartment Sale, Car, Services...",
      doc_content_label: "Knowledge Base Content:",
      doc_content_ph: "Enter all information the bot should use to answer customers...",
      doc_active_toggle: "⭐ Set as Active Knowledge Base for WhatsApp",
      sim_header: "AI Test Simulator",
      sim_input_ph: "Ask the bot a question...",
      sim_send: "Send 🚀",
      modal_title: "Sign In with Google Gemini API Key",
      modal_desc: "The bot operates under your personal Google Gemini quota.",
      modal_key_label: "Google Gemini API Key:",
      modal_submit: "Enter 🚀"
    }
  };

  let currentLang = localStorage.getItem('app_lang') || 'az';

  function setLanguage(lang) {
    if (!I18N[lang]) lang = 'az';
    currentLang = lang;
    localStorage.setItem('app_lang', lang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    const dict = I18N[lang];

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (dict[key]) el.placeholder = dict[key];
    });

    if (autoReplyToggle) {
      updateAutoReplyLabel(autoReplyToggle.checked);
    }
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      setLanguage(lang);
      if (currentApiKey) {
        loadLeads();
      }
    });
  });

  // -----------------------------------------------------------------
  // 2. Navigation Tabs (Connect, Messages, Data, Test)
  // -----------------------------------------------------------------
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // UI Elements
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const autoReplyToggle = document.getElementById('auto-reply-toggle');
  const autoReplyLabel = document.getElementById('auto-reply-label');
  const btnReconnect = document.getElementById('btn-reconnect');

  const qrContainer = document.getElementById('qr-container');
  const qrImageWrapper = document.getElementById('qr-image-wrapper');
  const connectedInfo = document.getElementById('connected-info');
  const userDisplayName = document.getElementById('user-display-name');
  const userDisplayJid = document.getElementById('user-display-jid');
  const waStateBadge = document.getElementById('wa-state-badge');

  const statTotalMessages = document.getElementById('stat-total-messages');
  const statLeadsCount = document.getElementById('stat-leads-count');
  const statViewingsCount = document.getElementById('stat-viewings-count');
  const messagesFeed = document.getElementById('messages-feed');

  const leadsTbody = document.getElementById('leads-tbody');
  const leadsBadgeCount = document.getElementById('leads-count');
  const btnRefreshLeads = document.getElementById('btn-refresh-leads');

  const btnNewDoc = document.getElementById('btn-new-doc');
  const btnSaveDoc = document.getElementById('btn-save-doc');
  const btnDeleteDoc = document.getElementById('btn-delete-doc');
  const docList = document.getElementById('doc-list');
  const docsCountBadge = document.getElementById('docs-count-badge');
  const docTitleInput = document.getElementById('doc-title-input');
  const docContentTextarea = document.getElementById('doc-content-textarea');
  const docIsActiveCheckbox = document.getElementById('doc-is-active-checkbox');
  const docCharCount = document.getElementById('doc-char-count');
  const docWordCount = document.getElementById('doc-word-count');

  const simChatWindow = document.getElementById('sim-chat-window');
  const simInput = document.getElementById('sim-input');
  const btnSimSend = document.getElementById('btn-sim-send');
  const simDebugPanel = document.getElementById('sim-debug-panel');
  const simDebugJson = document.getElementById('sim-debug-json');

  // Auth UI Elements
  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const inputApiKey = document.getElementById('input-api-key');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const activeApiKeyDisplay = document.getElementById('active-api-key-display');
  const btnSwitchKey = document.getElementById('btn-switch-key');

  let currentApiKey = localStorage.getItem('wa_api_key') || null;
  let documents = [];
  let activeDocumentId = null;
  let selectedDocumentId = null;
  let totalMessagesCount = 0;
  let chatStatuses = {}; // phone -> { isPaused, remainingMinutes }

  // -----------------------------------------------------------------
  // 3. Authentication & BYOK Session
  // -----------------------------------------------------------------
  function showAuthModal(errMsg = '') {
    if (authModal) authModal.classList.remove('hidden');
    if (authErrorMsg) {
      if (errMsg) {
        authErrorMsg.textContent = errMsg;
        authErrorMsg.classList.remove('hidden');
      } else {
        authErrorMsg.classList.add('hidden');
      }
    }
    if (inputApiKey) {
      inputApiKey.value = currentApiKey || '';
      setTimeout(() => inputApiKey.focus(), 100);
    }
  }

  function hideAuthModal() {
    if (authModal) authModal.classList.add('hidden');
    if (authErrorMsg) authErrorMsg.classList.add('hidden');
  }

  function updateSessionDisplay(key) {
    if (activeApiKeyDisplay && key) {
      const masked = key.length > 8 ? key.substring(0, 4) + '...' + key.substring(key.length - 3) : key;
      activeApiKeyDisplay.textContent = masked;
      activeApiKeyDisplay.title = 'API Key: ' + key;
    }
  }

  async function authFetch(url, options = {}) {
    if (!currentApiKey) {
      showAuthModal();
      throw new Error('Google Gemini API Key required');
    }
    options.headers = options.headers || {};
    if (options.body && typeof options.body === 'string' && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
    options.headers['X-API-Key'] = currentApiKey;

    const res = await fetch(url, options);
    if (res.status === 401) {
      showAuthModal('Google Gemini API Key etibarsızdır və ya tapılmadı.');
      throw new Error('Unauthorized');
    }
    return res;
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = inputApiKey.value.trim();
      if (!key) return;

      const btn = document.getElementById('btn-auth-submit');
      btn.disabled = true;
      btn.textContent = 'Yoxlanılır...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Giriş uğursuz oldu');

        currentApiKey = key;
        localStorage.setItem('wa_api_key', key);
        updateSessionDisplay(key);
        hideAuthModal();

        // Load profile data
        await loadDocuments();
        await loadLeads();
        await fetchStatus();
      } catch (err) {
        if (authErrorMsg) {
          authErrorMsg.textContent = err.message;
          authErrorMsg.classList.remove('hidden');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = I18N[currentLang].modal_submit;
      }
    });
  }

  function handleLogout() {
    localStorage.removeItem('wa_api_key');
    currentApiKey = null;
    if (inputApiKey) inputApiKey.value = '';
    if (activeApiKeyDisplay) {
      activeApiKeyDisplay.textContent = '---';
      activeApiKeyDisplay.title = '';
    }
    documents = [];
    activeDocumentId = null;
    selectedDocumentId = null;
    if (docList) docList.innerHTML = '';
    if (docTitleInput) docTitleInput.value = '';
    if (docContentTextarea) docContentTextarea.value = '';
    if (docsCountBadge) docsCountBadge.textContent = '0';
    if (docCharCount) docCharCount.textContent = '0';
    if (docWordCount) docWordCount.textContent = '0';
    const leadsTableBody = document.getElementById('leads-table-body');
    if (leadsTableBody) leadsTableBody.innerHTML = '';
    const leadsEmptyState = document.getElementById('leads-empty');
    if (leadsEmptyState) leadsEmptyState.classList.remove('hidden');
    const leadsCount = document.getElementById('leads-count');
    if (leadsCount) leadsCount.textContent = '0';
    const statTotalLeads = document.getElementById('stat-total-leads');
    if (statTotalLeads) statTotalLeads.textContent = '0';
    const statAppointments = document.getElementById('stat-appointments');
    if (statAppointments) statAppointments.textContent = '0';
    showAuthModal();
  }

  if (btnSwitchKey) {
    btnSwitchKey.addEventListener('click', handleLogout);
  }

  // -----------------------------------------------------------------
  // 4. Server-Sent Events (SSE)
  // -----------------------------------------------------------------
  function initSSE() {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        handleEvent(payload.type, payload.data);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('SSE connection lost, reconnecting in 3s...', err);
      setTimeout(initSSE, 3000);
      eventSource.close();
    };
  }

  function handleEvent(type, data) {
    if (type === 'status_change') {
      if (data.chatStatuses) chatStatuses = data.chatStatuses;
      updateConnectionStatus(data);
    } else if (type === 'chat_status_updated') {
      chatStatuses[data.phone] = data;
      if (currentApiKey) loadLeads();
    } else if (type === 'qr_generated') {
      renderQR(data.qrCodeDataUrl);
    } else if (type === 'new_message') {
      appendMessageToFeed(data);
    } else if (type === 'leads_updated') {
      if (currentApiKey) loadLeads();
    } else if (type === 'documents_updated') {
      if (data.documents) {
        documents = data.documents;
        activeDocumentId = data.activeDocumentId;
        renderDocumentList();
        if (selectedDocumentId) populateEditor(selectedDocumentId);
      }
    } else if (type === 'settings_updated') {
      if (data.autoReplyEnabled !== undefined) {
        autoReplyToggle.checked = data.autoReplyEnabled;
        updateAutoReplyLabel(data.autoReplyEnabled);
      }
    }
  }

  function updateConnectionStatus(data) {
    const status = data.status || 'disconnected';
    statusDot.className = 'status-dot ' + status;
    const dict = I18N[currentLang];

    if (data.version) {
      updateVersionDisplay(data.version);
    }

    if (status === 'connected') {
      statusText.textContent = dict.status_connected;
      waStateBadge.textContent = 'Active';
      waStateBadge.className = 'badge badge-high';
      qrContainer.classList.add('hidden');
      connectedInfo.classList.remove('hidden');

      const user = data.userInfo || {};
      userDisplayName.textContent = user.name || 'WhatsApp';
      userDisplayJid.textContent = user.id ? `+${user.id.replace(/@.+/, '')}` : 'Connected';
    } else if (status === 'waiting_qr') {
      statusText.textContent = dict.status_waiting_qr;
      waStateBadge.textContent = 'QR';
      waStateBadge.className = 'badge';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      if (data.qrCodeDataUrl) {
        renderQR(data.qrCodeDataUrl);
      }
    } else if (status === 'connecting') {
      statusText.textContent = dict.status_connecting;
      waStateBadge.textContent = '...';
      waStateBadge.className = 'badge';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      qrImageWrapper.innerHTML = `<div class="spinner"></div><p class="qr-hint">${dict.status_connecting}</p>`;
    } else {
      statusText.textContent = dict.status_disconnected;
      waStateBadge.textContent = 'Offline';
      waStateBadge.className = 'badge badge-danger';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      qrImageWrapper.innerHTML = `<p style="color: var(--danger-color); padding: 20px;">${dict.status_disconnected}.</p>`;
    }
  }

  function renderQR(dataUrl) {
    qrImageWrapper.innerHTML = `
      <img src="${dataUrl}" alt="WhatsApp QR Code">
      <p class="qr-hint">${I18N[currentLang].qr_hint}</p>
    `;
  }

  function appendMessageToFeed(msg) {
    totalMessagesCount++;
    statTotalMessages.textContent = totalMessagesCount;

    const div = document.createElement('div');
    div.className = `feed-item ${msg.direction}`;
    const timeStr = new Date(msg.timestamp).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
      <div class="feed-meta">
        <strong>${escapeHtml(msg.direction === 'incoming' ? (msg.name || msg.from) : 'AI Bot')}</strong>
        <span>${timeStr}</span>
      </div>
      <div class="feed-text">${escapeHtml(msg.text)}</div>
    `;

    messagesFeed.appendChild(div);
    messagesFeed.scrollTop = messagesFeed.scrollHeight;
  }

  // -----------------------------------------------------------------
  // 5. Document Management (Data Tab)
  // -----------------------------------------------------------------
  async function loadDocuments() {
    if (!currentApiKey) return;
    try {
      const res = await authFetch('/api/documents');
      const data = await res.json();
      documents = data.documents || [];
      activeDocumentId = data.activeDocumentId;

      if (!selectedDocumentId || !documents.some(d => d.id === selectedDocumentId)) {
        selectedDocumentId = activeDocumentId || (documents[0] && documents[0].id) || null;
      }

      renderDocumentList();
      if (selectedDocumentId) {
        populateEditor(selectedDocumentId);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  }

  function renderDocumentList() {
    if (!docList) return;
    if (docsCountBadge) docsCountBadge.textContent = `${documents.length}`;

    if (documents.length === 0) {
      docList.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 12px;">---</div>`;
      return;
    }

    docList.innerHTML = documents.map(d => {
      const isActive = d.id === activeDocumentId;
      const isSelected = d.id === selectedDocumentId;
      const updatedDate = d.updatedAt ? new Date(d.updatedAt).toLocaleDateString(currentLang === 'en' ? 'en-US' : (currentLang === 'ru' ? 'ru-RU' : 'az-AZ'), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div class="doc-item ${isActive ? 'active-kb' : ''} ${isSelected ? 'selected' : ''}" data-id="${d.id}">
          <div class="doc-item-title">${escapeHtml(d.title || 'Document')}</div>
          <div class="doc-item-meta">
            <span>${updatedDate}</span>
            ${isActive ? '<span class="badge-active-kb">⭐ ACTIVE</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    docList.querySelectorAll('.doc-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        selectedDocumentId = id;
        renderDocumentList();
        populateEditor(id);
      });
    });
  }

  function populateEditor(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    if (docTitleInput) docTitleInput.value = doc.title || '';
    if (docContentTextarea) docContentTextarea.value = doc.content || '';
    if (docIsActiveCheckbox) docIsActiveCheckbox.checked = (doc.id === activeDocumentId);
    updateWordStats();
  }

  function updateWordStats() {
    if (!docContentTextarea) return;
    const text = docContentTextarea.value || '';
    const charLen = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const charUnit = currentLang === 'en' ? 'chars' : (currentLang === 'ru' ? 'символов' : 'simvol');
    const wordUnit = currentLang === 'en' ? 'words' : (currentLang === 'ru' ? 'слов' : 'söz');
    if (docCharCount) docCharCount.textContent = `${charLen.toLocaleString()} ${charUnit}`;
    if (docWordCount) docWordCount.textContent = `${words.toLocaleString()} ${wordUnit}`;
  }

  if (docContentTextarea) {
    docContentTextarea.addEventListener('input', updateWordStats);
  }

  if (btnSaveDoc) {
    btnSaveDoc.addEventListener('click', async () => {
      if (!selectedDocumentId) return;
      btnSaveDoc.textContent = '...';

      const payload = {
        title: docTitleInput.value.trim() || 'Document',
        content: docContentTextarea.value,
        makeActive: docIsActiveCheckbox.checked
      };

      try {
        const res = await authFetch(`/api/documents/${selectedDocumentId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        btnSaveDoc.textContent = '✅';
        await loadDocuments();
        setTimeout(() => { btnSaveDoc.textContent = I18N[currentLang].btn_save_doc; }, 1500);
      } catch (err) {
        alert('Error: ' + err.message);
        btnSaveDoc.textContent = I18N[currentLang].btn_save_doc;
      }
    });
  }

  if (btnNewDoc) {
    btnNewDoc.addEventListener('click', async () => {
      btnNewDoc.textContent = '...';
      try {
        const res = await authFetch('/api/documents', {
          method: 'POST',
          body: JSON.stringify({
            title: (currentLang === 'en' ? 'New Document ' : (currentLang === 'ru' ? 'Новый документ ' : 'Yeni Sənəd ')) + (documents.length + 1),
            content: '',
            makeActive: false
          })
        });
        const data = await res.json();
        await loadDocuments();
        const lastDoc = documents[documents.length - 1];
        if (lastDoc) {
          selectedDocumentId = lastDoc.id;
          renderDocumentList();
          populateEditor(lastDoc.id);
          if (docTitleInput) docTitleInput.focus();
        }
      } finally {
        btnNewDoc.textContent = I18N[currentLang].btn_new_doc;
      }
    });
  }

  if (btnDeleteDoc) {
    btnDeleteDoc.addEventListener('click', async () => {
      if (!selectedDocumentId) return;
      if (documents.length <= 1) {
        alert(currentLang === 'en' ? 'Cannot delete the only document.' : 'Yeganə sənədi silə bilməzsiniz.');
        return;
      }
      const doc = documents.find(d => d.id === selectedDocumentId);
      if (!confirm(`"${doc?.title || ''}" delete?`)) return;

      try {
        await authFetch(`/api/documents/${selectedDocumentId}`, { method: 'DELETE' });
        selectedDocumentId = null;
        await loadDocuments();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    });
  }

  // -----------------------------------------------------------------
  // 6. Messages Management (Messages Tab)
  // -----------------------------------------------------------------
  async function loadLeads() {
    if (!currentApiKey) return;
    try {
      const [leadsRes, statusRes] = await Promise.all([
        authFetch('/api/leads'),
        authFetch('/api/chat-statuses')
      ]);
      const leads = await leadsRes.json();
      chatStatuses = await statusRes.json();
      renderLeadsTable(leads);
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  }

  function renderLeadsTable(leads) {
    statLeadsCount.textContent = leads.length;
    leadsBadgeCount.textContent = leads.length;

    let viewingsCount = 0;
    leads.forEach(l => {
      if (l.status === 'viewing_requested' || (l.viewingAppointments && l.viewingAppointments.length > 0)) {
        viewingsCount++;
      }
    });
    statViewingsCount.textContent = viewingsCount;

    const dict = I18N[currentLang];

    if (!leads || leads.length === 0) {
      leadsTbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: var(--text-muted)">${dict.no_leads}</td></tr>`;
      return;
    }

    function formatRemainingTime(mins) {
      if (!mins || mins <= 0) return '0m';
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }

    leadsTbody.innerHTML = leads.map(l => {
      const isHigh = l.interestLevel === 'high';
      const isViewing = l.status === 'viewing_requested';
      const aptTime = (l.viewingAppointments && l.viewingAppointments[0]?.preferred_time) || '-';
      const dateFormatted = new Date(l.lastContact).toLocaleString(currentLang === 'en' ? 'en-US' : (currentLang === 'ru' ? 'ru-RU' : 'az-AZ'), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      const chatStatus = chatStatuses[l.phoneNumber];
      const isPaused = chatStatus && chatStatus.isPaused;
      const remainingMins = chatStatus?.remainingMinutes || 300;
      const remainingFormatted = formatRemainingTime(remainingMins);

      const botControlHtml = isPaused
        ? `<div class="bot-control-cell">
             <span class="badge-lead badge-paused">${dict.bot_paused} (${remainingFormatted})</span>
             <button class="btn btn-primary btn-xs btn-resume-bot" data-phone="${l.phoneNumber}">${dict.btn_resume}</button>
           </div>`
        : `<div class="bot-control-cell">
             <span class="badge-lead badge-bot-active">${dict.bot_active}</span>
             <button class="btn btn-secondary btn-xs btn-pause-bot" data-phone="${l.phoneNumber}">${dict.btn_pause}</button>
           </div>`;

      return `
        <tr>
          <td>
            <strong>${escapeHtml(l.name || 'User')}</strong><br>
            <span style="font-family: var(--font-mono); color: var(--accent-blue);">+${l.phoneNumber}</span>
          </td>
          <td>
            <span class="badge-lead ${isViewing ? 'badge-status-viewing' : ''}">
              ${isViewing ? '🏡 Viewing' : '💬 Lead'}
            </span>
          </td>
          <td>
            <span class="badge-lead ${isHigh ? 'badge-high' : 'badge-medium'}">
              ${isHigh ? '🔥 High' : 'Normal'}
            </span>
          </td>
          <td><strong>${escapeHtml(aptTime)}</strong></td>
          <td>${botControlHtml}</td>
          <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            "${escapeHtml(l.lastMessage || '')}"
          </td>
          <td style="font-size: 11px; color: var(--text-muted);">${dateFormatted}</td>
          <td>
            <a href="https://wa.me/${l.phoneNumber}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration: none;">WhatsApp</a>
          </td>
        </tr>
      `;
    }).join('');

    // Click handlers for Resume & Pause
    document.querySelectorAll('.btn-resume-bot').forEach(btn => {
      btn.addEventListener('click', async () => {
        const phone = btn.getAttribute('data-phone');
        btn.textContent = '...';
        try {
          await authFetch(`/api/chat/${phone}/resume`, { method: 'POST' });
          await loadLeads();
        } catch (e) {
          console.error(e);
        }
      });
    });

    document.querySelectorAll('.btn-pause-bot').forEach(btn => {
      btn.addEventListener('click', async () => {
        const phone = btn.getAttribute('data-phone');
        btn.textContent = '...';
        try {
          await authFetch(`/api/chat/${phone}/pause`, {
            method: 'POST',
            body: JSON.stringify({ minutes: 300 })
          });
          await loadLeads();
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  if (btnRefreshLeads) {
    btnRefreshLeads.addEventListener('click', loadLeads);
  }

  // -----------------------------------------------------------------
  // 7. Controls
  // -----------------------------------------------------------------
  autoReplyToggle.addEventListener('change', async () => {
    const isChecked = autoReplyToggle.checked;
    updateAutoReplyLabel(isChecked);
    try {
      await authFetch('/api/auto-reply', {
        method: 'POST',
        body: JSON.stringify({ enabled: isChecked })
      });
    } catch (e) {
      console.error('Error toggling auto-reply:', e);
    }
  });

  function updateAutoReplyLabel(enabled) {
    const dict = I18N[currentLang];
    autoReplyLabel.textContent = enabled ? dict.auto_reply_on : dict.auto_reply_off;
    autoReplyLabel.style.color = enabled ? 'var(--primary-color)' : 'var(--text-muted)';
  }

  btnReconnect.addEventListener('click', async () => {
    btnReconnect.disabled = true;
    btnReconnect.textContent = '...';
    try {
      await authFetch('/api/whatsapp/reconnect', { method: 'POST' });
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setTimeout(() => {
        btnReconnect.disabled = false;
        btnReconnect.textContent = '🔄 ' + I18N[currentLang].reconnect;
      }, 3000);
    }
  });

  async function fetchStatus() {
    try {
      const res = await authFetch('/api/status');
      const data = await res.json();
      updateConnectionStatus(data);
      if (data.autoReplyEnabled !== undefined) {
        autoReplyToggle.checked = data.autoReplyEnabled;
        updateAutoReplyLabel(data.autoReplyEnabled);
      }
    } catch (err) {
      console.error('Error fetching initial status:', err);
    }
  }

  // -----------------------------------------------------------------
  // 8. Test Sandbox
  // -----------------------------------------------------------------
  async function sendSimMessage(text) {
    const msg = text || simInput.value.trim();
    if (!msg) return;

    appendSimBubble('user', msg);
    simInput.value = '';
    btnSimSend.disabled = true;
    btnSimSend.textContent = '...';

    try {
      const res = await authFetch('/api/test-ai', {
        method: 'POST',
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();

      appendSimBubble('bot', data.reply_text);

      simDebugPanel.classList.remove('hidden');
      simDebugJson.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      appendSimBubble('bot', '⚠️ Error: ' + err.message);
    } finally {
      btnSimSend.disabled = false;
      btnSimSend.textContent = I18N[currentLang].sim_send;
    }
  }

  function appendSimBubble(role, text) {
    const div = document.createElement('div');
    div.className = `sim-message ${role}`;
    div.innerHTML = `
      <div class="sim-avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="sim-bubble">${escapeHtml(text)}</div>
    `;
    simChatWindow.appendChild(div);
    simChatWindow.scrollTop = simChatWindow.scrollHeight;
  }

  btnSimSend.addEventListener('click', () => sendSimMessage(simInput.value));
  simInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendSimMessage(simInput.value);
  });

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // -----------------------------------------------------------------
  // 9. Dynamic App Version & Status
  // -----------------------------------------------------------------
  function updateVersionDisplay(version) {
    const el = document.getElementById('app-version');
    if (el && version) {
      const clean = String(version).trim().replace(/^[@()]+|[@()]+$/g, '');
      const formatted = clean.startsWith('v') ? clean : `v${clean}`;
      el.textContent = formatted;
    }
  }

  async function fetchVersion() {
    try {
      const res = await fetch(`/api/version?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.version) {
          updateVersionDisplay(data.version);
        }
      }
    } catch (err) {
      console.warn('Could not fetch app version:', err);
    }
  }

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/status?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          updateConnectionStatus(data);
          if (data.version) {
            updateVersionDisplay(data.version);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch status:', err);
    }
  }

  // -----------------------------------------------------------------
  // 10. Initial Boot
  // -----------------------------------------------------------------
  setLanguage(currentLang);
  initSSE();
  fetchVersion();
  fetchStatus();

  if (currentApiKey) {
    updateSessionDisplay(currentApiKey);
    hideAuthModal();
    loadDocuments();
    loadLeads();
  } else {
    showAuthModal();
  }
});
