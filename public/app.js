// Client-side Application Logic for WhatsApp AI Agent with Multi-Tenant API Key Auth

document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs
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
  const quickButtons = document.querySelectorAll('.quick-btn');

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
  // 1. Authentication & Session Handling
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
      activeApiKeyDisplay.title = 'Açar: ' + key;
    }
  }

  async function authFetch(url, options = {}) {
    if (!currentApiKey) {
      showAuthModal();
      throw new Error('API Key tələb olunur');
    }
    options.headers = options.headers || {};
    if (options.body && typeof options.body === 'string' && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
    options.headers['X-API-Key'] = currentApiKey;

    const res = await fetch(url, options);
    if (res.status === 401) {
      showAuthModal('Sessiya xətası: API Key yanlışdır və ya tapılmadı.');
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

        // Boot user profile data
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
        btn.textContent = 'Daxil Ol 🚀';
      }
    });
  }

  if (btnSwitchKey) {
    btnSwitchKey.addEventListener('click', () => {
      showAuthModal();
    });
  }

  // -----------------------------------------------------------------
  // 2. Initialize Server-Sent Events (SSE)
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

    if (status === 'connected') {
      statusText.textContent = 'Qoşuldu ✅';
      waStateBadge.textContent = 'Aktiv / Qoşulub';
      waStateBadge.className = 'badge badge-high';
      qrContainer.classList.add('hidden');
      connectedInfo.classList.remove('hidden');

      const user = data.userInfo || {};
      userDisplayName.textContent = user.name || 'WhatsApp Hesabı';
      userDisplayJid.textContent = user.id ? `+${user.id.replace(/@.+/, '')}` : 'Qoşulub';
    } else if (status === 'waiting_qr') {
      statusText.textContent = 'QR Kod Gözlənilir';
      waStateBadge.textContent = 'QR Skan edin';
      waStateBadge.className = 'badge';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      if (data.qrCodeDataUrl) {
        renderQR(data.qrCodeDataUrl);
      }
    } else if (status === 'connecting') {
      statusText.textContent = 'Qoşulur...';
      waStateBadge.textContent = 'Qoşulur...';
      waStateBadge.className = 'badge';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      qrImageWrapper.innerHTML = `<div class="spinner"></div><p class="qr-hint">WhatsApp serverinə bağlanır...</p>`;
    } else {
      statusText.textContent = 'Bağlantı kəsildi';
      waStateBadge.textContent = 'Offline';
      waStateBadge.className = 'badge badge-danger';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
      qrImageWrapper.innerHTML = `<p style="color: var(--danger-color); padding: 20px;">Bağlantı kəsildi. "🔄 Yenilə" düyməsini sıxın.</p>`;
    }
  }

  function renderQR(dataUrl) {
    qrImageWrapper.innerHTML = `
      <img src="${dataUrl}" alt="WhatsApp QR Code">
      <p class="qr-hint">QR kodu skan edin</p>
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
  // 3. Document Management (Universal Knowledge Base)
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
    if (docsCountBadge) docsCountBadge.textContent = `${documents.length} sənəd`;

    if (documents.length === 0) {
      docList.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 12px;">Hələ heç bir sənəd yoxdur.</div>`;
      return;
    }

    docList.innerHTML = documents.map(d => {
      const isActive = d.id === activeDocumentId;
      const isSelected = d.id === selectedDocumentId;
      const updatedDate = d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('az-AZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div class="doc-item ${isActive ? 'active-kb' : ''} ${isSelected ? 'selected' : ''}" data-id="${d.id}">
          <div class="doc-item-title">${escapeHtml(d.title || 'Başlıqsız Sənəd')}</div>
          <div class="doc-item-meta">
            <span>${updatedDate}</span>
            ${isActive ? '<span class="badge-active-kb">⭐ AKTİV BAZA</span>' : ''}
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
    if (docCharCount) docCharCount.textContent = `${charLen.toLocaleString()} simvol`;
    if (docWordCount) docWordCount.textContent = `${words.toLocaleString()} söz`;
  }

  if (docContentTextarea) {
    docContentTextarea.addEventListener('input', updateWordStats);
  }

  if (btnSaveDoc) {
    btnSaveDoc.addEventListener('click', async () => {
      if (!selectedDocumentId) return;
      btnSaveDoc.textContent = 'Yadda saxlanılır...';

      const payload = {
        title: docTitleInput.value.trim() || 'Başlıqsız Sənəd',
        content: docContentTextarea.value,
        makeActive: docIsActiveCheckbox.checked
      };

      try {
        const res = await authFetch(`/api/documents/${selectedDocumentId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        btnSaveDoc.textContent = '✅ Yadda Saxlanıldı!';
        await loadDocuments();
        setTimeout(() => { btnSaveDoc.textContent = '💾 Yadda Saxla'; }, 2000);
      } catch (err) {
        alert('Xəta baş verdi: ' + err.message);
        btnSaveDoc.textContent = '💾 Yadda Saxla';
      }
    });
  }

  if (btnNewDoc) {
    btnNewDoc.addEventListener('click', async () => {
      btnNewDoc.textContent = 'Yaradılır...';
      try {
        const res = await authFetch('/api/documents', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Yeni Sənəd ' + (documents.length + 1),
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
        btnNewDoc.textContent = '➕ Yeni Sənəd Yarat';
      }
    });
  }

  if (btnDeleteDoc) {
    btnDeleteDoc.addEventListener('click', async () => {
      if (!selectedDocumentId) return;
      if (documents.length <= 1) {
        alert('Yeganə mövcud sənədi silə bilməzsiniz. Əvvəlcə yeni sənəd yaradın.');
        return;
      }
      const doc = documents.find(d => d.id === selectedDocumentId);
      if (!confirm(`"${doc?.title || 'Bu sənədi'}" silmək istədiyinizə əminsiniz?`)) return;

      try {
        await authFetch(`/api/documents/${selectedDocumentId}`, { method: 'DELETE' });
        selectedDocumentId = null;
        await loadDocuments();
      } catch (e) {
        alert('Xəta: ' + e.message);
      }
    });
  }

  // -----------------------------------------------------------------
  // 4. Leads Management
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

    if (!leads || leads.length === 0) {
      leadsTbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: var(--text-muted)">Hələ qeydə alınmış alıcı yoxdur. WhatsApp-da ilk sual daxil olduqda burada görünəcək.</td></tr>`;
      return;
    }

    function formatRemainingTime(mins) {
      if (!mins || mins <= 0) return '0 dəq';
      if (mins < 60) return `${mins} dəq`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h} saat ${m} dəq` : `${h} saat`;
    }

    leadsTbody.innerHTML = leads.map(l => {
      const isHigh = l.interestLevel === 'high';
      const isViewing = l.status === 'viewing_requested';
      const aptTime = (l.viewingAppointments && l.viewingAppointments[0]?.preferred_time) || '-';
      const dateFormatted = new Date(l.lastContact).toLocaleString('az-AZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      const chatStatus = chatStatuses[l.phoneNumber];
      const isPaused = chatStatus && chatStatus.isPaused;
      const remainingMins = chatStatus?.remainingMinutes || 300;
      const remainingFormatted = formatRemainingTime(remainingMins);

      const botControlHtml = isPaused
        ? `<div class="bot-control-cell">
             <span class="badge-lead badge-paused" title="Siz müdaxilə etdiyiniz üçün bot 5 saatlıq dayanıb">⏸️ Dayandırılıb (${remainingFormatted})</span>
             <button class="btn btn-primary btn-xs btn-resume-bot" data-phone="${l.phoneNumber}">▶️ Botu Aktivləşdir</button>
           </div>`
        : `<div class="bot-control-cell">
             <span class="badge-lead badge-bot-active">🟢 Aktivdir</span>
             <button class="btn btn-secondary btn-xs btn-pause-bot" data-phone="${l.phoneNumber}">⏸️ Dayandır (5 saat)</button>
           </div>`;

      return `
        <tr>
          <td>
            <strong>${escapeHtml(l.name || 'Alıcı')}</strong><br>
            <span style="font-family: var(--font-mono); color: var(--accent-blue);">+${l.phoneNumber}</span>
          </td>
          <td>
            <span class="badge-lead ${isViewing ? 'badge-status-viewing' : ''}">
              ${isViewing ? '🏡 Baxış İstəyi' : '💬 Maraqlanan'}
            </span>
          </td>
          <td>
            <span class="badge-lead ${isHigh ? 'badge-high' : 'badge-medium'}">
              ${isHigh ? '🔥 Yüksək' : 'Orta'}
            </span>
          </td>
          <td><strong>${escapeHtml(aptTime)}</strong></td>
          <td>${botControlHtml}</td>
          <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            "${escapeHtml(l.lastMessage || '')}"
          </td>
          <td style="font-size: 11px; color: var(--text-muted);">${dateFormatted}</td>
          <td>
            <a href="https://wa.me/${l.phoneNumber}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration: none;">💬 WhatsApp</a>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click handlers to Resume & Pause buttons
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
  // 5. Controls
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
    autoReplyLabel.textContent = enabled ? 'Avto-Cavab: Aktiv' : 'Avto-Cavab: Deaktiv';
    autoReplyLabel.style.color = enabled ? 'var(--primary-color)' : 'var(--text-muted)';
  }

  btnReconnect.addEventListener('click', async () => {
    btnReconnect.disabled = true;
    btnReconnect.textContent = 'Qoşulur...';
    try {
      await authFetch('/api/whatsapp/reconnect', { method: 'POST' });
    } catch (e) {
      alert('Yenidən qoşulma xətası: ' + e.message);
    } finally {
      setTimeout(() => {
        btnReconnect.disabled = false;
        btnReconnect.textContent = '🔄 Yenilə';
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
  // 6. AI Simulator Sandbox
  // -----------------------------------------------------------------
  async function sendSimMessage(text) {
    const msg = text || simInput.value.trim();
    if (!msg) return;

    appendSimBubble('user', msg);
    simInput.value = '';
    btnSimSend.disabled = true;
    btnSimSend.textContent = 'Düşünür... ⏳';

    try {
      const res = await authFetch('/api/test-ai', {
        method: 'POST',
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();

      appendSimBubble('bot', data.reply_text);

      // Show debug JSON
      simDebugPanel.classList.remove('hidden');
      simDebugJson.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      appendSimBubble('bot', '⚠️ Xəta baş verdi: ' + err.message);
    } finally {
      btnSimSend.disabled = false;
      btnSimSend.textContent = 'Göndər 🚀';
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

  quickButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.getAttribute('data-msg');
      simInput.value = msg;
      sendSimMessage(msg);
    });
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
  // 7. Initial Boot Flow
  // -----------------------------------------------------------------
  initSSE();

  if (currentApiKey) {
    updateSessionDisplay(currentApiKey);
    hideAuthModal();
    loadDocuments();
    loadLeads();
    fetchStatus();
  } else {
    showAuthModal();
  }
});
