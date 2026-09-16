// Client-side Application Logic for WhatsApp AI Agent
// Features: Multilingual (AZ, RU, EN), Clean Minimal Tabs (Connect, Messages, Data, Test), BYOK Gemini Auth

document.addEventListener('DOMContentLoaded', () => {
  // -----------------------------------------------------------------
  // 1. Multilingual (i18n) Dictionary & Switcher
  // -----------------------------------------------------------------
  const I18N = {
    az: {
      brand_title: "whatsappbot.hajimammad.com",
      tab_connect: "Qoşulma",
      tab_messages: "Mesajlar",
      tab_data: "Məlumatlar",
      tab_test: "Test",
      status_connecting: "Qoşulur...",
      status_connected: "Qoşuldu",
      status_waiting_qr: "QR Skan Edin",
      status_disconnected: "Bağlantı kəsildi",
      wa_state_connected: "Aktiv",
      wa_state_waiting_qr: "QR Gözlənilir",
      wa_state_connecting: "Qoşulur...",
      wa_state_disconnected: "Qoşulmayıb",
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
      btn_pause: "⏸️ Dayandır",
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
      modal_title: "Admin Parolu ilə Giriş",
      modal_desc: "Şəxsi kabinetə daxil olmaq üçün təhlükəsiz parolunuzu daxil edin.",
      modal_key_label: "Parol:",
      modal_submit: "Daxil Ol 🚀",
      lbl_cabinet_api_key: "Google Gemini API Açarınız:",
      btn_update_api_key: "💾 Yenilə",
      link_ai_studio: "Google AI Studio ↗",
      msg_key_updated: "✅ API açarınız uğurla yeniləndi və saxlanıldı!",
      msg_key_updating: "⏳ Açar yoxlanılır və yenilənir...",
      msg_key_required: "⚠️ Zəhmət olmasa yeni API açarı daxil edin.",
      show_key: "👁️ Göstər",
      hide_key: "🙈 Gizlət",
      logout_wa: "🚪 WhatsApp-dan Çıxış",
      confirm_wa_logout: "Bu WhatsApp nömrəsinin əlaqəsini kəsmək və çıxış etmək istədiyinizdən əminsiniz?",
      btn_get_new_qr: "🔄 Yeni QR Kod Əldə Et",
      wa_disconnected_hint: "Bağlantı kəsilib və ya telefon üzərindən əlaqə silinib.",
      btn_mongo_sync: "Bulud Sinxronizasiya",
      mongo_sync_connected: "MongoDB: Aktiv 🟢",
      mongo_sync_unconfigured: "MongoDB: Qoşulmayıb ⚠️",
      mongo_sync_now_success: "✅ Məlumatlar MongoDB Atlas-a uğurla sinxron edildi!",
      mongo_sync_now_loading: "⏳ MongoDB Atlas-a sinxron edilir...",
      inbox_select_prompt: "Söhbət seçin",
      inbox_select_sub: "Sol siyahıdan bir alıcı seçərək mesajlaşmanı canlı izləyə və birbaşa cavab yaza bilərsiniz.",
      inbox_send_btn: "Göndər 🚀",
      inbox_reply_ph: "Mesajınızı bura yazın... (Enter göndərir, Shift+Enter yeni sətir)"
    },
    ru: {
      brand_title: "whatsappbot.hajimammad.com",
      tab_connect: "Подключение",
      tab_messages: "Сообщения",
      tab_data: "Данные",
      tab_test: "Тест",
      status_connecting: "Подключение...",
      status_connected: "Подключено",
      status_waiting_qr: "Сканируйте QR",
      status_disconnected: "Отключено",
      wa_state_connected: "Активен",
      wa_state_waiting_qr: "Ожидание QR",
      wa_state_connecting: "Подключение...",
      wa_state_disconnected: "Отключено",
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
      btn_pause: "⏸️ Пауза",
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
      modal_title: "Вход по паролю администратора",
      modal_desc: "Введите безопасный пароль для входа в панель управления.",
      modal_key_label: "Пароль:",
      modal_submit: "Войти 🚀",
      lbl_cabinet_api_key: "Ваш Google Gemini API Ключ:",
      btn_update_api_key: "💾 Обновить",
      link_ai_studio: "Google AI Studio ↗",
      msg_key_updated: "✅ Ваш API ключ успешно обновлен и сохранен!",
      msg_key_updating: "⏳ Проверка и обновление ключа...",
      msg_key_required: "⚠️ Пожалуйста, введите новый API ключ.",
      show_key: "👁️ Показать",
      hide_key: "🙈 Скрыть",
      logout_wa: "🚪 Отключить WhatsApp",
      confirm_wa_logout: "Вы уверены, что хотите отключить этот номер WhatsApp?",
      btn_get_new_qr: "🔄 Получить новый QR-код",
      wa_disconnected_hint: "Подключение прервано или удалено на телефоне.",
      btn_mongo_sync: "Синхронизация",
      mongo_sync_connected: "MongoDB: Активен 🟢",
      mongo_sync_unconfigured: "MongoDB: Не подключен ⚠️",
      mongo_sync_now_success: "✅ Данные успешно синхронизированы с MongoDB Atlas!",
      mongo_sync_now_loading: "⏳ Синхронизация с MongoDB Atlas...",
      inbox_select_prompt: "Выберите диалог",
      inbox_select_sub: "Выберите контакт из списка слева, чтобы просмотреть переписку и ответить напрямую.",
      inbox_send_btn: "Отправить 🚀",
      inbox_reply_ph: "Введите сообщение... (Enter для отправки, Shift+Enter новая строка)"
    },
    en: {
      brand_title: "whatsappbot.hajimammad.com",
      tab_connect: "Connect",
      tab_messages: "Messages",
      tab_data: "Data",
      tab_test: "Test",
      status_connecting: "Connecting...",
      status_connected: "Connected",
      status_waiting_qr: "Scan QR",
      status_disconnected: "Disconnected",
      wa_state_connected: "Active",
      wa_state_waiting_qr: "Scan QR",
      wa_state_connecting: "Connecting...",
      wa_state_disconnected: "Offline",
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
      btn_pause: "⏸️ Pause",
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
      modal_title: "Sign In with Admin Password",
      modal_desc: "Enter your secure password to access your dashboard.",
      modal_key_label: "Password:",
      modal_submit: "Sign In 🚀",
      lbl_cabinet_api_key: "Your Google Gemini API Key:",
      btn_update_api_key: "💾 Update",
      link_ai_studio: "Google AI Studio ↗",
      msg_key_updated: "✅ API Key successfully updated and saved!",
      msg_key_updating: "⏳ Validating and updating key...",
      msg_key_required: "⚠️ Please enter a new API key.",
      show_key: "👁️ Show",
      hide_key: "🙈 Hide",
      logout_wa: "🚪 Disconnect WhatsApp",
      confirm_wa_logout: "Are you sure you want to disconnect this WhatsApp account?",
      btn_get_new_qr: "🔄 Get New QR Code",
      wa_disconnected_hint: "Connection disconnected or unlinked from phone.",
      btn_mongo_sync: "Cloud Sync",
      mongo_sync_connected: "MongoDB: Active 🟢",
      mongo_sync_unconfigured: "MongoDB: Offline ⚠️",
      mongo_sync_now_success: "✅ Data successfully synced to MongoDB Atlas!",
      mongo_sync_now_loading: "⏳ Syncing to MongoDB Atlas...",
      inbox_select_prompt: "Select a conversation",
      inbox_select_sub: "Choose a contact from the left list to view live history and reply directly.",
      inbox_send_btn: "Send 🚀",
      inbox_reply_ph: "Type your message... (Enter to send, Shift+Enter for new line)"
    }
  };

  const MONTH_NAMES = {
    az: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'],
    ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  };

  function formatDateTime(dateInput, lang = currentLang) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';

    const day = d.getDate();
    const monthIdx = d.getMonth();
    const months = MONTH_NAMES[lang] || MONTH_NAMES.az;
    const monthStr = months[monthIdx] || (monthIdx + 1);

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day} ${monthStr} ${hours}:${minutes}`;
  }

  let currentLang = localStorage.getItem('app_lang') || 'az';

  function setLanguage(lang) {
    if (!I18N[lang]) lang = 'az';
    currentLang = lang;
    localStorage.setItem('app_lang', lang);
    document.documentElement.lang = lang;

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
    if (typeof updateToggleKeyLabels === 'function') {
      updateToggleKeyLabels();
    }
    if (typeof lastConnectionStatusData !== 'undefined' && lastConnectionStatusData) {
      updateConnectionStatus(lastConnectionStatusData);
    }
    if (typeof checkMongoSyncStatus === 'function') {
      checkMongoSyncStatus();
    }
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      setLanguage(lang);
      if (currentAuthToken) {
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

      if (targetId === 'tab-leads' && currentAuthToken) {
        loadLeads();
      }
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
  const btnLogout = document.getElementById('btn-logout');

  const statTotalMessages = document.getElementById('stat-total-messages');
  const statLeadsCount = document.getElementById('stat-leads-count');
  const statViewingsCount = document.getElementById('stat-viewings-count');
  const messagesFeed = document.getElementById('messages-feed');

  const leadsBadgeCount = document.getElementById('leads-count');
  const btnRefreshLeads = document.getElementById('btn-refresh-leads');

  // Omnichannel Live Chat Inbox Elements
  const inboxContainer = document.getElementById('inbox-container');
  const btnBackToConvList = document.getElementById('btn-back-to-conv-list');
  const inboxSearchInput = document.getElementById('inbox-search-input');
  const inboxChannelTabs = document.querySelectorAll('.channel-tab');
  const inboxConvList = document.getElementById('inbox-conv-list');
  const inboxNoSelected = document.getElementById('inbox-no-selected');
  const inboxActiveChat = document.getElementById('inbox-active-chat');
  const activeChatAvatar = document.getElementById('active-chat-avatar');
  const activeChatName = document.getElementById('active-chat-name');
  const activeChatPlatformBadge = document.getElementById('active-chat-platform-badge');
  const activeChatPhone = document.getElementById('active-chat-phone');
  const btnEditActivePhone = document.getElementById('btn-edit-active-phone');
  const activeChatBotControl = document.getElementById('active-chat-bot-control');
  const activeChatExternalLink = document.getElementById('active-chat-external-link');
  const inboxMessagesStream = document.getElementById('inbox-messages-stream');
  const inboxReplyForm = document.getElementById('inbox-reply-form');
  const inboxReplyInput = document.getElementById('inbox-reply-input');
  const btnInboxSend = document.getElementById('btn-inbox-send');

  // Inbox State Variables
  let currentLeads = [];
  let selectedInboxLeadId = null;
  let activeChannelFilter = 'all';
  let inboxSearchQuery = '';

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
  const btnSwitchKey = document.getElementById('btn-switch-key');

  // Cabinet API Key Elements (in Connect Tab above QR)
  const cabinetApiKeyInput = document.getElementById('cabinet-api-key-input');
  const btnUpdateCabinetApiKey = document.getElementById('btn-update-cabinet-api-key');
  const btnToggleCabinetKeyVis = document.getElementById('btn-toggle-cabinet-key-vis');
  const cabinetKeyStatusMsg = document.getElementById('cabinet-key-status-msg');

  let currentAuthToken = localStorage.getItem('wa_admin_pass') || localStorage.getItem('wa_api_key') || null;
  let activeGeminiApiKey = null;
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
      inputApiKey.value = '';
      setTimeout(() => inputApiKey.focus(), 100);
    }
  }

  function hideAuthModal() {
    if (authModal) authModal.classList.add('hidden');
    if (authErrorMsg) authErrorMsg.classList.add('hidden');
  }

  function updateSessionDisplay(key) {
    if (cabinetApiKeyInput && key && key !== 'Protected') {
      cabinetApiKeyInput.value = key;
    }
  }

  async function authFetch(url, options = {}) {
    if (!currentAuthToken) {
      showAuthModal();
      throw new Error('Admin parolu tələb olunur / Admin password required');
    }
    options.headers = options.headers || {};
    if (options.body && typeof options.body === 'string' && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
    options.headers['X-API-Key'] = currentAuthToken;
    options.headers['X-Admin-Password'] = currentAuthToken;

    const res = await fetch(url, options);
    if (res.status === 401) {
      showAuthModal('Sessiyanın vaxtı bitdi və ya parol yanlışdır. Zəhmət olmasa yenidən daxil olun.');
      throw new Error('Unauthorized');
    }
    return res;
  }

  // Password visibility toggle
  const btnToggleKey = document.getElementById('btn-toggle-key-visibility');
  if (btnToggleKey && inputApiKey) {
    btnToggleKey.addEventListener('click', () => {
      inputApiKey.type = inputApiKey.type === 'password' ? 'text' : 'password';
      updateToggleKeyLabels();
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = inputApiKey.value.trim();
      if (!pass) return;

      const btn = document.getElementById('btn-auth-submit');
      btn.disabled = true;
      btn.textContent = '...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
        const contentType = res.headers.get('content-type') || '';
        let data = {};
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          if (res.status === 502 || res.status === 504) {
            throw new Error(currentLang === 'en' ? 'Server is waking up (502/504). Please try again in a few seconds.' : 'Server oyanır / yuxudan qalxır (502/504). Zəhmət olmasa bir neçə saniyə sonra yenidən cəhd edin.');
          }
          throw new Error(data.error || `Server xətası (${res.status}). Zəhmət olmasa yenidən yoxlayın.`);
        }
        if (!res.ok) throw new Error(data.error || 'Giriş uğursuz oldu');

        currentAuthToken = pass;
        localStorage.setItem('wa_admin_pass', currentAuthToken);
        localStorage.setItem('wa_api_key', currentAuthToken);

        activeGeminiApiKey = data.user?.apiKey || '';
        updateSessionDisplay(activeGeminiApiKey || 'Protected');
        if (cabinetApiKeyInput && activeGeminiApiKey) {
          cabinetApiKeyInput.value = activeGeminiApiKey;
        }

        hideAuthModal();

        // Boot live services for this authenticated admin
        initSSE();
        await fetchStatus();
        await loadDocuments();
        await loadLeads();
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
    localStorage.removeItem('wa_admin_pass');
    localStorage.removeItem('wa_api_key');
    currentAuthToken = null;
    activeGeminiApiKey = null;
    if (sseInstance) {
      sseInstance.close();
      sseInstance = null;
    }
    if (inputApiKey) inputApiKey.value = '';
    if (cabinetApiKeyInput) cabinetApiKeyInput.value = '';
    if (cabinetKeyStatusMsg) {
      cabinetKeyStatusMsg.textContent = '';
      cabinetKeyStatusMsg.classList.add('hidden');
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
  // 3.1 Cabinet In-Page API Key Management (Above QR Code)
  // -----------------------------------------------------------------
  function showCabinetKeyStatus(msg, type = 'info') {
    if (!cabinetKeyStatusMsg) return;
    cabinetKeyStatusMsg.textContent = msg;
    cabinetKeyStatusMsg.classList.remove('hidden');
    if (type === 'error') {
      cabinetKeyStatusMsg.style.color = '#f87171';
    } else if (type === 'success') {
      cabinetKeyStatusMsg.style.color = '#34d399';
    } else {
      cabinetKeyStatusMsg.style.color = '#93c5fd';
    }
  }

  function updateToggleKeyLabels() {
    const dict = I18N[currentLang] || I18N.az;
    if (btnToggleKey && inputApiKey) {
      btnToggleKey.textContent = inputApiKey.type === 'password' ? dict.show_key : dict.hide_key;
    }
    if (btnToggleCabinetKeyVis && cabinetApiKeyInput) {
      btnToggleCabinetKeyVis.textContent = cabinetApiKeyInput.type === 'password' ? dict.show_key : dict.hide_key;
    }
  }

  if (btnToggleCabinetKeyVis && cabinetApiKeyInput) {
    btnToggleCabinetKeyVis.addEventListener('click', () => {
      cabinetApiKeyInput.type = cabinetApiKeyInput.type === 'password' ? 'text' : 'password';
      updateToggleKeyLabels();
    });
  }

  async function handleCabinetKeyUpdate() {
    if (!cabinetApiKeyInput) return;
    const newKey = cabinetApiKeyInput.value.trim();
    const dict = I18N[currentLang] || I18N.az;

    if (!newKey) {
      showCabinetKeyStatus(dict.msg_key_required || 'API açarı daxil edilməlidir.', 'error');
      return;
    }

    if (newKey === activeGeminiApiKey) {
      showCabinetKeyStatus(dict.msg_key_updated || 'API açarı artıq cari açardır.', 'success');
      return;
    }

    if (btnUpdateCabinetApiKey) {
      btnUpdateCabinetApiKey.disabled = true;
      btnUpdateCabinetApiKey.textContent = '...';
    }
    showCabinetKeyStatus(dict.msg_key_updating || 'Yoxlanılır...', 'info');

    try {
      const res = await authFetch('/api/auth/update-key', {
        method: 'POST',
        body: JSON.stringify({ newApiKey: newKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Açar yenilənmədi');
      }

      activeGeminiApiKey = (data.user && data.user.apiKey) ? data.user.apiKey : newKey;
      updateSessionDisplay(activeGeminiApiKey);
      if (cabinetApiKeyInput) cabinetApiKeyInput.value = activeGeminiApiKey;

      showCabinetKeyStatus(data.message || dict.msg_key_updated || 'API açarınız uğurla yeniləndi!', 'success');

      // Refresh connection status and documents under the re-keyed user
      initSSE();
      await fetchStatus();
      await loadDocuments();
      await loadLeads();
    } catch (err) {
      showCabinetKeyStatus(err.message, 'error');
    } finally {
      if (btnUpdateCabinetApiKey) {
        btnUpdateCabinetApiKey.disabled = false;
        btnUpdateCabinetApiKey.textContent = dict.btn_update_api_key || '💾 Yenilə';
      }
    }
  }

  if (btnUpdateCabinetApiKey) {
    btnUpdateCabinetApiKey.addEventListener('click', handleCabinetKeyUpdate);
  }
  if (cabinetApiKeyInput) {
    cabinetApiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCabinetKeyUpdate();
      }
    });
  }

  // -----------------------------------------------------------------
  // 4. Server-Sent Events (SSE) (Authenticated)
  // -----------------------------------------------------------------
  let sseInstance = null;

  function initSSE() {
    if (!currentAuthToken) return;
    if (sseInstance) {
      sseInstance.close();
      sseInstance = null;
    }

    sseInstance = new EventSource('/api/events?api_key=' + encodeURIComponent(currentAuthToken));

    sseInstance.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        handleEvent(payload.type, payload.data);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    sseInstance.onerror = (err) => {
      console.warn('SSE connection closed or lost, will reconnect if logged in...', err);
      if (sseInstance) {
        sseInstance.close();
        sseInstance = null;
      }
      if (currentAuthToken) {
        setTimeout(initSSE, 4000);
      }
    };
  }

  function handleEvent(type, data) {
    if (type === 'status_change') {
      if (data.chatStatuses) chatStatuses = data.chatStatuses;
      updateConnectionStatus(data);
    } else if (type === 'chat_status_updated') {
      chatStatuses[data.phone] = data;
      if (currentAuthToken) loadLeads();
    } else if (type === 'qr_generated') {
      renderQR(data.qrCodeDataUrl);
    } else if (type === 'new_message') {
      appendMessageToFeed(data);
      if (currentAuthToken) loadLeads();
    } else if (type === 'leads_updated') {
      if (currentAuthToken) loadLeads();
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

  let lastConnectionStatusData = null;

  function updateConnectionStatus(data) {
    if (!data) return;
    lastConnectionStatusData = data;
    const status = data.status || 'disconnected';
    statusDot.className = 'status-dot ' + status;
    const dict = I18N[currentLang];

    if (data.version) {
      updateVersionDisplay(data.version);
    }

    if (status === 'connected') {
      statusText.textContent = dict.status_connected;
      waStateBadge.textContent = dict.wa_state_connected || 'Aktiv';
      waStateBadge.className = 'badge badge-connected';
      qrContainer.classList.add('hidden');
      connectedInfo.classList.remove('hidden');

      const user = data.userInfo || {};
      userDisplayName.textContent = user.name || 'WhatsApp';
      userDisplayJid.textContent = user.id ? `+${user.id.replace(/@.+/, '')}` : 'Connected';
    } else if (status === 'waiting_qr') {
      statusText.textContent = dict.status_waiting_qr;
      waStateBadge.textContent = dict.wa_state_waiting_qr || 'QR';
      waStateBadge.className = 'badge badge-waiting-qr';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      if (data.qrCodeDataUrl) {
        renderQR(data.qrCodeDataUrl);
      }
    } else if (status === 'connecting') {
      statusText.textContent = dict.status_connecting;
      waStateBadge.textContent = dict.wa_state_connecting || '...';
      waStateBadge.className = 'badge badge-connecting';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      qrImageWrapper.innerHTML = `<div class="spinner"></div><p class="qr-hint">${dict.status_connecting}</p>`;
    } else {
      statusText.textContent = dict.status_disconnected;
      waStateBadge.textContent = dict.wa_state_disconnected || 'Offline';
      waStateBadge.className = 'badge badge-disconnected';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      qrImageWrapper.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 100%; padding: 12px; text-align: center;">
          <div style="font-size: 24px;">⚠️</div>
          <p style="color: var(--danger-color); font-weight: 700; font-size: 14px; margin: 0;">${dict.status_disconnected}</p>
          <p style="color: #64748b; font-size: 11px; margin: 0; line-height: 1.3;">${dict.wa_disconnected_hint || 'Bağlantı kəsilib və ya telefon üzərindən əlaqə silinib.'}</p>
          <button type="button" class="btn btn-primary btn-sm" id="btn-fresh-qr" style="font-size: 11px; padding: 7px 12px; font-weight: 600; width: 100%; margin-top: 6px;">
            ${dict.btn_get_new_qr || '🔄 Yeni QR Kod Əldə Et'}
          </button>
        </div>
      `;
      const btnFreshQr = document.getElementById('btn-fresh-qr');
      if (btnFreshQr) {
        btnFreshQr.addEventListener('click', async () => {
          btnFreshQr.disabled = true;
          btnFreshQr.textContent = '...';
          qrImageWrapper.innerHTML = `<div class="spinner"></div><p class="qr-hint">${dict.status_connecting}</p>`;
          try {
            await authFetch('/api/whatsapp/reset', { method: 'POST' });
          } catch (e) {
            console.error('Error resetting WhatsApp session:', e);
            btnFreshQr.disabled = false;
            btnFreshQr.textContent = dict.btn_get_new_qr || '🔄 Yeni QR Kod Əldə Et';
          }
        });
      }
    }

    // Populate live messages feed from recent messages if currently empty
    if (data.recentMessages && data.recentMessages.length > 0 && messagesFeed) {
      const placeholder = messagesFeed.querySelector('.empty-feed-placeholder');
      if (placeholder) {
        messagesFeed.innerHTML = '';
        totalMessagesCount = 0;
        data.recentMessages.forEach(msg => appendMessageToFeed(msg));
      }
    }
  }

  function renderQR(dataUrl) {
    qrImageWrapper.innerHTML = `
      <img src="${dataUrl}" alt="WhatsApp QR Code">
      <p class="qr-hint">${I18N[currentLang].qr_hint}</p>
    `;
  }

  function appendMessageToFeed(msg) {
    if (!messagesFeed) return;
    const placeholder = messagesFeed.querySelector('.empty-feed-placeholder');
    if (placeholder) {
      messagesFeed.innerHTML = '';
    }

    totalMessagesCount++;
    statTotalMessages.textContent = totalMessagesCount;

    const div = document.createElement('div');
    div.className = `feed-item ${msg.direction}`;
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }) : '';
    const senderTitle = msg.direction === 'incoming' ? (msg.name || msg.from) : (msg.name || 'Siz (Bot)');

    div.innerHTML = `
      <div class="feed-meta">
        <strong>${escapeHtml(senderTitle)}</strong>
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
    if (!currentAuthToken) return;
    try {
      const res = await authFetch('/api/documents');
      const data = await res.json();
      documents = data.documents || [];
      activeDocumentId = data.activeDocumentId;

      if (!selectedDocumentId || !documents.some(d => d.id === selectedDocumentId)) {
        selectedDocumentId = activeDocumentId || (documents[0] && documents[0].id) || null;
      }

      renderDocumentList();
      checkMongoSyncStatus();
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

    const dict = I18N[currentLang] || I18N.az;
    docList.innerHTML = documents.map(d => {
      const isActive = d.id === activeDocumentId;
      const isSelected = d.id === selectedDocumentId;
      const updatedDate = d.updatedAt ? formatDateTime(d.updatedAt, currentLang) : '';

      return `
        <div class="doc-item ${isActive ? 'active-kb' : ''} ${isSelected ? 'selected' : ''}" data-id="${d.id}">
          <div class="doc-item-title">${escapeHtml(d.title || 'Document')}</div>
          <div class="doc-item-meta">
            <span>${updatedDate}</span>
            ${isActive ? `<span class="badge-active-kb">⭐ ${dict.wa_state_connected || 'Active'}</span>` : ''}
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
  // MongoDB Atlas Cloud Persistence Sync
  // -----------------------------------------------------------------
  const mongoSyncBadge = document.getElementById('mongo-sync-badge');
  const btnMongoSyncNow = document.getElementById('btn-mongo-sync-now');

  async function checkMongoSyncStatus() {
    if (!currentAuthToken || !mongoSyncBadge) return;
    try {
      const res = await authFetch('/api/backup/status');
      if (!res.ok) return;
      const data = await res.json();
      const dict = I18N[currentLang] || I18N.az;

      if (data.connected) {
        mongoSyncBadge.textContent = dict.mongo_sync_connected || 'MongoDB: Aktiv 🟢';
        mongoSyncBadge.className = 'mongo-sync-badge connected';
        let tip = `Baza: MongoDB Atlas (Bulud)\nStatus: Əlaqə aktivdir`;
        if (data.lastSyncAt) {
          tip += `\nSon Sinxronizasiya: ${new Date(data.lastSyncAt).toLocaleString()}`;
        }
        mongoSyncBadge.title = tip;
        if (btnMongoSyncNow) btnMongoSyncNow.style.display = 'inline-flex';
      } else {
        mongoSyncBadge.textContent = dict.mongo_sync_unconfigured || 'MongoDB: Qoşulmayıb ⚠️';
        mongoSyncBadge.className = 'mongo-sync-badge disconnected';
        mongoSyncBadge.title = data.lastSyncError ? `Xəta: ${data.lastSyncError}` : 'MongoDB Atlas bağlantısı qurulmayıb.';
        if (btnMongoSyncNow) btnMongoSyncNow.style.display = 'none';
      }
    } catch (e) {
      console.warn('MongoDB sync status check error:', e);
    }
  }

  if (btnMongoSyncNow) {
    btnMongoSyncNow.addEventListener('click', async () => {
      const dict = I18N[currentLang] || I18N.az;
      btnMongoSyncNow.disabled = true;
      const origHtml = btnMongoSyncNow.innerHTML;
      btnMongoSyncNow.textContent = dict.mongo_sync_now_loading || '⏳ Sinxron edilir...';

      try {
        const res = await authFetch('/api/backup/now', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
          alert(dict.mongo_sync_now_success || '✅ Məlumatlar MongoDB Atlas-a uğurla sinxron edildi!');
          await checkMongoSyncStatus();
        } else {
          alert('❌ Xəta: ' + (data.error || 'Sync failed'));
        }
      } catch (err) {
        alert('❌ Xəta: ' + err.message);
      } finally {
        btnMongoSyncNow.disabled = false;
        btnMongoSyncNow.innerHTML = origHtml;
      }
    });
  }

  // -----------------------------------------------------------------
  // 6. Messages Management (Messages Tab)
  // -----------------------------------------------------------------
  async function loadLeads() {
    if (!currentAuthToken) return;
    try {
      const [leadsRes, statusRes] = await Promise.all([
        authFetch('/api/leads'),
        authFetch('/api/chat-statuses')
      ]);
      const leads = await leadsRes.json();
      chatStatuses = await statusRes.json();
      currentLeads = Array.isArray(leads) ? leads : [];
      updateLeadStats();
      renderInboxConversations();
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  }

  function updateLeadStats() {
    const leads = currentLeads || [];
    if (statLeadsCount) statLeadsCount.textContent = leads.length;
    if (leadsBadgeCount) leadsBadgeCount.textContent = leads.length;

    let viewingsCount = 0;
    leads.forEach(l => {
      if (l.status === 'viewing_requested' || (l.viewingAppointments && l.viewingAppointments.length > 0)) {
        viewingsCount++;
      }
    });
    if (statViewingsCount) statViewingsCount.textContent = viewingsCount;
  }

  // -----------------------------------------------------------------
  // 6b. Omnichannel Live Chat Inbox
  // -----------------------------------------------------------------
  function getPlatformMeta(platform) {
    switch ((platform || '').toLowerCase()) {
      case 'instagram':
        return { name: 'Instagram', badge: '📸 Instagram', icon: '📸', color: '#e1306c' };
      case 'facebook':
        return { name: 'Facebook', badge: '🔵 Facebook', icon: '🔵', color: '#1877f2' };
      case 'whatsapp':
      default:
        return { name: 'WhatsApp', badge: '🟢 WhatsApp', icon: '🟢', color: '#25d366' };
    }
  }

  function formatRelativeTime(dateStr) {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return currentLang === 'en' ? 'now' : (currentLang === 'ru' ? 'сейчас' : 'indi');
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      return `${Math.floor(diffHours / 24)}d`;
    } catch (e) {
      return '';
    }
  }

  function renderInboxConversations() {
    if (!inboxConvList) return;

    let filtered = currentLeads || [];
    if (activeChannelFilter && activeChannelFilter !== 'all') {
      filtered = filtered.filter(l => (l.platform || 'whatsapp').toLowerCase() === activeChannelFilter);
    }

    if (inboxSearchQuery) {
      const q = inboxSearchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.phoneNumber && l.phoneNumber.toLowerCase().includes(q)) ||
        (l.lastMessage && l.lastMessage.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      inboxConvList.innerHTML = `<div class="empty-inbox-placeholder">${currentLang === 'en' ? 'No conversations found' : (currentLang === 'ru' ? 'Диалоги не найдены' : 'Heç bir söhbət tapılmadı')}</div>`;
      if (!selectedInboxLeadId) {
        if (inboxNoSelected) inboxNoSelected.classList.remove('hidden');
        if (inboxActiveChat) inboxActiveChat.classList.add('hidden');
      }
      return;
    }

    // If no lead selected yet or current selection is not in list, auto-select first
    if (!selectedInboxLeadId || !filtered.some(l => l.id === selectedInboxLeadId)) {
      selectedInboxLeadId = filtered[0].id;
    }

    inboxConvList.innerHTML = filtered.map(l => {
      const isSelected = l.id === selectedInboxLeadId;
      const plat = getPlatformMeta(l.platform);
      const chatStatus = chatStatuses[l.phoneNumber] || (l.lid && chatStatuses[l.lid]);
      const isPaused = chatStatus && chatStatus.isPaused;
      const initial = (l.name && l.name.charAt(0)) ? l.name.charAt(0).toUpperCase() : '👤';
      const timeStr = l.lastContact ? formatRelativeTime(l.lastContact) : '';
      const isHigh = l.interestLevel === 'high';
      const isViewing = l.status === 'viewing_requested' || (l.viewingAppointments && l.viewingAppointments.length > 0);
      const aptTime = (l.viewingAppointments && l.viewingAppointments[0]?.preferred_time) || '';
      const msgCount = (l.messages && l.messages.length) || 0;
      const targetPhone = l.phoneNumber || l.lid || l.platformId || '';
      const formattedPhone = targetPhone ? (targetPhone.startsWith('+') ? targetPhone : '+' + targetPhone) : '';

      const viewingBadge = isViewing
        ? `<span class="conv-tag conv-tag-viewing" title="Görüş: ${escapeHtml(aptTime || '')}">🏡 ${escapeHtml(aptTime || 'Görüş')}</span>`
        : '';
      const highBadge = isHigh
        ? `<span class="conv-tag conv-tag-high" title="Yüksək Maraq">🔥 Yüksək</span>`
        : '';
      const msgCountBadge = msgCount > 1
        ? `<span class="conv-msg-count">${msgCount}</span>`
        : '';

      return `
        <div class="inbox-conv-item ${isSelected ? 'active' : ''}" data-lead-id="${l.id}">
          <div class="conv-avatar-wrapper">
            <div class="conv-avatar">${escapeHtml(initial)}</div>
            <span class="conv-platform-badge">${plat.icon}</span>
          </div>
          <div class="conv-content">
            <div class="conv-top-row">
              <span class="conv-name" title="${escapeHtml(l.name || 'Alıcı')}">${escapeHtml(l.name || 'Alıcı')}</span>
              <span class="conv-time">${timeStr}</span>
            </div>
            <div class="conv-sub-row">
              <span class="conv-phone font-mono">${escapeHtml(formattedPhone)}</span>
              <div class="conv-tags">
                ${viewingBadge}
                ${highBadge}
                ${msgCountBadge}
              </div>
            </div>
            <div class="conv-bot-row">
              <span class="conv-preview" title="${escapeHtml(l.lastMessage || '')}">${escapeHtml(l.lastMessage || '...')}</span>
              <span class="conv-bot-pill ${isPaused ? 'conv-bot-paused' : 'conv-bot-active'}" title="${isPaused ? 'Bot dayandırılıb' : 'Bot aktivdir'}">
                ${isPaused ? '⏸️' : '🤖'}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    inboxConvList.querySelectorAll('.inbox-conv-item').forEach(item => {
      item.addEventListener('click', () => {
        const leadId = item.getAttribute('data-lead-id');
        selectConversation(leadId);
      });
    });

    if (selectedInboxLeadId) {
      renderActiveChat();
    }
  }

  function selectConversation(leadId) {
    selectedInboxLeadId = leadId;
    renderInboxConversations();
    renderActiveChat();
    if (inboxContainer) {
      inboxContainer.classList.add('mobile-chat-open');
    }
    if (inboxReplyInput) {
      inboxReplyInput.focus();
    }
  }

  function renderActiveChat() {
    const lead = currentLeads.find(l => l.id === selectedInboxLeadId);
    if (!lead) {
      if (inboxNoSelected) inboxNoSelected.classList.remove('hidden');
      if (inboxActiveChat) inboxActiveChat.classList.add('hidden');
      return;
    }

    if (inboxNoSelected) inboxNoSelected.classList.add('hidden');
    if (inboxActiveChat) inboxActiveChat.classList.remove('hidden');

    const plat = getPlatformMeta(lead.platform);
    const targetPhone = lead.phoneNumber || lead.lid || lead.platformId || '';

    if (activeChatAvatar) activeChatAvatar.textContent = (lead.name && lead.name.charAt(0)) ? lead.name.charAt(0).toUpperCase() : '👤';
    if (activeChatName) activeChatName.textContent = lead.name || 'Alıcı';
    if (activeChatPlatformBadge) activeChatPlatformBadge.textContent = plat.badge;
    if (activeChatPhone) activeChatPhone.textContent = targetPhone ? (targetPhone.startsWith('+') ? targetPhone : `+${targetPhone}`) : '';

    const activeChatTags = document.getElementById('active-chat-tags');
    if (activeChatTags) {
      const isHigh = lead.interestLevel === 'high';
      const isViewing = lead.status === 'viewing_requested' || (lead.viewingAppointments && lead.viewingAppointments.length > 0);
      const aptTime = (lead.viewingAppointments && lead.viewingAppointments[0]?.preferred_time) || '';
      let tagsHtml = '';
      if (isViewing) {
        tagsHtml += `<span class="conv-tag conv-tag-viewing" title="Baxış Görüşü">🏡 ${escapeHtml(aptTime || 'Görüş')}</span> `;
      }
      if (isHigh) {
        tagsHtml += `<span class="conv-tag conv-tag-high" title="Yüksək Maraq">🔥 Yüksək</span> `;
      }
      activeChatTags.innerHTML = tagsHtml;
    }

    if (btnEditActivePhone) {
      btnEditActivePhone.setAttribute('data-id', lead.id);
      btnEditActivePhone.setAttribute('data-phone', lead.phoneNumber || '');
    }

    if (activeChatExternalLink) {
      if ((lead.platform || 'whatsapp') === 'whatsapp') {
        activeChatExternalLink.href = `https://wa.me/${lead.phoneNumber}`;
        activeChatExternalLink.style.display = 'inline-flex';
      } else {
        activeChatExternalLink.style.display = 'none';
      }
    }

    // Bot control button
    const chatStatus = chatStatuses[lead.phoneNumber] || (lead.lid && chatStatuses[lead.lid]);
    const isPaused = chatStatus && chatStatus.isPaused;
    const dict = I18N[currentLang];

    if (activeChatBotControl) {
      activeChatBotControl.innerHTML = isPaused
        ? `<button type="button" class="btn btn-primary btn-xs" id="btn-inbox-resume-bot">🤖 ${dict.btn_resume}</button>`
        : `<button type="button" class="btn btn-secondary btn-xs" id="btn-inbox-pause-bot">⏸️ ${dict.btn_pause}</button>`;

      const btnResume = document.getElementById('btn-inbox-resume-bot');
      if (btnResume) {
        btnResume.addEventListener('click', async () => {
          btnResume.disabled = true;
          btnResume.textContent = '...';
          await authFetch(`/api/chat/${encodeURIComponent(targetPhone)}/resume`, { method: 'POST' });
          if (chatStatuses[targetPhone]) chatStatuses[targetPhone] = { isPaused: false, remainingMinutes: 0 };
          await loadLeads();
        });
      }
      const btnPause = document.getElementById('btn-inbox-pause-bot');
      if (btnPause) {
        btnPause.addEventListener('click', async () => {
          btnPause.disabled = true;
          btnPause.textContent = '...';
          await authFetch(`/api/chat/${encodeURIComponent(targetPhone)}/pause`, {
            method: 'POST',
            body: JSON.stringify({ isManual: true })
          });
          if (!chatStatuses[targetPhone]) chatStatuses[targetPhone] = {};
          chatStatuses[targetPhone].isPaused = true;
          chatStatuses[targetPhone].isManual = true;
          await loadLeads();
        });
      }
    }

    // Render Messages Stream
    if (inboxMessagesStream) {
      const messages = lead.messages || [];
      if (messages.length === 0) {
        inboxMessagesStream.innerHTML = `<div class="empty-inbox-placeholder">${currentLang === 'en' ? 'No messages yet' : (currentLang === 'ru' ? 'Нет сообщений' : 'Hələ heç bir mesaj yoxdur')}</div>`;
      } else {
        inboxMessagesStream.innerHTML = messages.map(m => {
          const isMe = m.from === 'me';
          const isOperator = m.operator || (isMe && m.text && m.text.startsWith('Siz: '));
          const cleanText = m.text ? m.text.replace(/^Siz:\s*/, '') : '';
          const bubbleClass = !isMe ? 'incoming' : (isOperator ? 'outgoing operator' : 'outgoing bot');
          const senderLabel = !isMe 
            ? escapeHtml(lead.name || 'Müştəri') 
            : (isOperator ? (currentLang === 'en' ? '👤 You (Operator)' : '👤 Siz (Operator)') : '🤖 AI Bot');
          const time = m.timestamp ? formatDateTime(m.timestamp, currentLang) : '';

          return `
            <div class="chat-bubble ${bubbleClass}">
              <span class="bubble-sender-badge">${senderLabel}</span>
              <div class="bubble-body">${escapeHtml(cleanText)}</div>
              <div class="chat-bubble-meta">${time}</div>
            </div>
          `;
        }).join('');

        inboxMessagesStream.scrollTop = inboxMessagesStream.scrollHeight;
      }
    }
  }

  async function sendOperatorReply() {
    if (!selectedInboxLeadId || !inboxReplyInput) return;
    const text = inboxReplyInput.value.trim();
    if (!text) return;

    const lead = currentLeads.find(l => l.id === selectedInboxLeadId);
    if (!lead) return;

    btnInboxSend.disabled = true;
    const origText = btnInboxSend.innerHTML;
    btnInboxSend.innerHTML = '⏳ ...';

    try {
      const payload = {
        leadId: lead.id,
        text: text,
        platform: lead.platform || 'whatsapp',
        targetId: lead.phoneNumber || lead.lid || lead.platformId
      };

      const res = await authFetch('/api/inbox/reply', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Mesaj göndərilə bilmədi');
      }

      inboxReplyInput.value = '';

      // Optimistically append message to local lead history
      lead.messages = lead.messages || [];
      lead.messages.push({
        text: 'Siz: ' + text,
        from: 'me',
        operator: true,
        timestamp: new Date().toISOString(),
        platform: lead.platform || 'whatsapp'
      });
      lead.lastMessage = 'Siz: ' + text;
      lead.lastContact = new Date().toISOString();

      renderActiveChat();
      renderInboxConversations();

      loadLeads();
    } catch (err) {
      alert((currentLang === 'en' ? 'Failed to send message: ' : 'Mesaj göndərilə bilmədi: ') + err.message);
    } finally {
      btnInboxSend.disabled = false;
      btnInboxSend.innerHTML = origText;
      if (inboxReplyInput) inboxReplyInput.focus();
    }
  }

  if (btnInboxSend) {
    btnInboxSend.addEventListener('click', sendOperatorReply);
  }

  if (inboxReplyInput) {
    inboxReplyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendOperatorReply();
      }
    });
  }

  if (inboxSearchInput) {
    inboxSearchInput.addEventListener('input', (e) => {
      inboxSearchQuery = e.target.value.trim();
      renderInboxConversations();
    });
  }

  inboxChannelTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      inboxChannelTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeChannelFilter = tab.getAttribute('data-channel') || 'all';
      renderInboxConversations();
    });
  });

  if (btnBackToConvList) {
    btnBackToConvList.addEventListener('click', () => {
      if (inboxContainer) {
        inboxContainer.classList.remove('mobile-chat-open');
      }
    });
  }

  if (btnEditActivePhone) {
    btnEditActivePhone.addEventListener('click', () => {
      const leadId = btnEditActivePhone.getAttribute('data-id');
      const lead = currentLeads.find(l => l.id === leadId);
      if (!lead) return;
      const currentPhone = lead.phoneNumber || '';
      const promptText = currentLang === 'en'
        ? 'Enter real international phone number (e.g. 994501234567):'
        : 'Müştərinin real beynəlxalq telefon nömrəsini daxil edin (məs: 994501234567):';
      const input = prompt(promptText, currentPhone);
      if (!input || !input.trim()) return;
      const cleanPhone = input.trim().replace(/\D/g, '');
      if (cleanPhone.length < 8) return;

      authFetch(`/api/leads/${encodeURIComponent(leadId)}/phone`, {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: cleanPhone })
      }).then(() => loadLeads()).catch(err => alert(err.message));
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
    if (autoReplyLabel) {
      autoReplyLabel.textContent = enabled ? dict.auto_reply_on : dict.auto_reply_off;
      autoReplyLabel.style.color = enabled ? 'var(--primary-color)' : 'var(--text-muted)';
    }
    const tip = enabled ? dict.auto_reply_on : dict.auto_reply_off;
    if (autoReplyToggle) {
      autoReplyToggle.title = tip;
    }
    const wrapper = document.querySelector('.toggle-wrapper');
    if (wrapper) {
      wrapper.title = tip;
    }
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const dict = I18N[currentLang] || I18N.az;
      if (!confirm(dict.confirm_wa_logout || 'WhatsApp nömrəsinin əlaqəsini kəsmək istəyirsiniz?')) {
        return;
      }
      btnLogout.disabled = true;
      btnLogout.textContent = '...';
      try {
        const res = await authFetch('/api/whatsapp/logout', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Çıxış xətası');
        await fetchStatus();
      } catch (err) {
        alert('Xəta: ' + err.message);
      } finally {
        setTimeout(() => {
          if (btnLogout) {
            btnLogout.disabled = false;
            btnLogout.textContent = dict.logout_wa || '🚪 WhatsApp-dan Çıxış';
          }
        }, 3000);
      }
    });
  }

  btnReconnect.addEventListener('click', async () => {
    btnReconnect.disabled = true;
    btnReconnect.textContent = '...';
    try {
      await authFetch('/api/whatsapp/reconnect', { method: 'POST' });
      await fetchStatus();
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
    if (!currentAuthToken) return;
    try {
      const res = await authFetch(`/api/status?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          updateConnectionStatus(data);
          if (data.version) {
            updateVersionDisplay(data.version);
          }
          if (data.geminiApiKey !== undefined) {
            activeGeminiApiKey = data.geminiApiKey;
            if (cabinetApiKeyInput) cabinetApiKeyInput.value = data.geminiApiKey;
            if (data.geminiApiKey) updateSessionDisplay(data.geminiApiKey);
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
  fetchVersion();

  if (currentAuthToken) {
    hideAuthModal();
    initSSE();
    fetchStatus();
    loadDocuments();
    loadLeads();
  } else {
    showAuthModal();
  }
});
