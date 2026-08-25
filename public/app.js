// Client-side Application Logic for WhatsApp Real Estate Agent

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
  const btnLogout = document.getElementById('btn-logout');

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

  const profileForm = document.getElementById('profile-form');
  const btnSaveProfile = document.getElementById('btn-save-profile');

  const simChatWindow = document.getElementById('sim-chat-window');
  const simInput = document.getElementById('sim-input');
  const btnSimSend = document.getElementById('btn-sim-send');
  const simDebugPanel = document.getElementById('sim-debug-panel');
  const simDebugJson = document.getElementById('sim-debug-json');
  const quickButtons = document.querySelectorAll('.quick-btn');

  let currentProfile = {};
  let totalMessagesCount = 0;
  let chatStatuses = {}; // phone -> { isPaused, remainingMinutes }

  // 1. Initialize Server-Sent Events (SSE)
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
      loadLeads(); // re-render table with updated status
    } else if (type === 'qr_generated') {
      renderQR(data.qrCodeDataUrl);
    } else if (type === 'new_message') {
      appendMessageToFeed(data);
    } else if (type === 'leads_updated') {
      loadLeads();
    } else if (type === 'profile_updated') {
      currentProfile = data;
      populateProfileForm(data);
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
    } else {
      statusText.textContent = 'Qoşulmayıb';
      waStateBadge.textContent = 'Bağlantı kəsildi';
      waStateBadge.className = 'badge';
      qrContainer.classList.remove('hidden');
      connectedInfo.classList.add('hidden');
    }

    if (data.autoReplyEnabled !== undefined) {
      autoReplyToggle.checked = data.autoReplyEnabled;
      updateAutoReplyLabel(data.autoReplyEnabled);
    }
  }

  function renderQR(dataUrl) {
    if (!dataUrl) return;
    qrImageWrapper.innerHTML = `<img src="${dataUrl}" alt="WhatsApp QR Code">`;
  }

  function updateAutoReplyLabel(enabled) {
    autoReplyLabel.textContent = enabled ? 'Avto-Cavab: Aktiv' : 'Avto-Cavab: Dayandırılıb';
  }

  // 2. Fetch Initial Data
  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      updateConnectionStatus(data);
      if (data.recentMessages) {
        messagesFeed.innerHTML = '';
        data.recentMessages.forEach(appendMessageToFeed);
      }
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
  }

  function appendMessageToFeed(msg) {
    totalMessagesCount++;
    statTotalMessages.textContent = totalMessagesCount;

    // Remove placeholder if present
    const emptyPlaceholder = messagesFeed.querySelector('.empty-feed-placeholder');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    const div = document.createElement('div');
    const isIncoming = msg.direction === 'incoming';
    div.className = `feed-item ${isIncoming ? 'incoming' : 'outgoing'}`;

    const timeStr = new Date(msg.timestamp || Date.now()).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
    const headerTitle = isIncoming
      ? `📩 +${msg.from} (${msg.name || 'tap.az'})`
      : `🤖 AI Cavab ➔ +${msg.to}`;

    div.innerHTML = `
      <div class="feed-meta">
        <strong>${headerTitle}</strong>
        <span>${timeStr}</span>
      </div>
      <div class="feed-text">${escapeHtml(msg.text)}</div>
    `;

    messagesFeed.appendChild(div);
    messagesFeed.scrollTop = messagesFeed.scrollHeight;
  }

  // 3. House Profile
  async function loadHouseProfile() {
    try {
      const res = await fetch('/api/house-profile');
      currentProfile = await res.json();
      populateProfileForm(currentProfile);
    } catch (err) {
      console.error('Error loading house profile:', err);
    }
  }

  function populateProfileForm(p) {
    const info = p.property_info || {};
    const specs = p.specifications || {};
    const reno = p.renovation_and_utilities || {};
    const docs = p.documents_and_mortgage || p.documents_and_legal || {};
    const fin = p.financial_details || p.pricing_and_negotiation || {};
    const schedule = p.viewing_schedule || {};

    document.getElementById('prop-title').value = info.title || '';
    document.getElementById('prop-district').value = info.city || info.district || '';
    document.getElementById('prop-metro').value = info.complex_name || info.metro_proximity || '';
    document.getElementById('prop-landmark').value = info.landmark || '';
    document.getElementById('prop-address').value = info.location_details || info.address || '';

    document.getElementById('prop-rooms').value = specs.rooms || '';
    document.getElementById('prop-area').value = specs.area_sqm || '';
    document.getElementById('prop-floor').value = specs.floor || '';
    document.getElementById('prop-total-floors').value = specs.total_floors || '';
    document.getElementById('prop-balcony').value = specs.balcony || '';

    document.getElementById('prop-initial-payment').value = fin.initial_payment_azn || '';
    document.getElementById('prop-monthly-payment').value = fin.monthly_payment_azn || '';
    document.getElementById('prop-interest-rate').value = fin.interest_rate || '4%';
    document.getElementById('prop-remaining-period').value = fin.remaining_period || '23 il';

    document.getElementById('prop-doc').value = docs.document_type || '';
    document.getElementById('prop-mortgage').value = docs.mortgage_transfer || docs.mortgage_type || '';
    document.getElementById('prop-discount-policy').value = fin.discount_policy || '';

    document.getElementById('prop-reno').value = reno.renovation_status || '';
    document.getElementById('prop-furnished').value = reno.furnished_status || '';
    document.getElementById('prop-heating').value = reno.heating_system || '';
    document.getElementById('prop-viewing-hours').value = schedule.availability_hours || '';
  }

  btnSaveProfile.addEventListener('click', async (e) => {
    e.preventDefault();
    btnSaveProfile.textContent = 'Yadda saxlanılır...';

    const updated = {
      property_info: {
        ...currentProfile.property_info,
        title: document.getElementById('prop-title').value,
        city: document.getElementById('prop-district').value,
        complex_name: document.getElementById('prop-metro').value,
        landmark: document.getElementById('prop-landmark').value,
        location_details: document.getElementById('prop-address').value
      },
      specifications: {
        ...currentProfile.specifications,
        rooms: document.getElementById('prop-rooms').value,
        area_sqm: Number(document.getElementById('prop-area').value),
        floor: Number(document.getElementById('prop-floor').value),
        balcony: document.getElementById('prop-balcony').value
      },
      documents_and_mortgage: {
        ...currentProfile.documents_and_mortgage,
        document_type: document.getElementById('prop-doc').value,
        mortgage_type: 'Hazır 4%-li güzəştli dövlət ipotekası',
        mortgage_transfer: document.getElementById('prop-mortgage').value
      },
      financial_details: {
        ...currentProfile.financial_details,
        initial_payment_azn: Number(document.getElementById('prop-initial-payment').value),
        monthly_payment_azn: Number(document.getElementById('prop-monthly-payment').value),
        interest_rate: document.getElementById('prop-interest-rate').value,
        remaining_period: document.getElementById('prop-remaining-period').value,
        discount_policy: document.getElementById('prop-discount-policy').value
      },
      renovation_and_utilities: {
        ...currentProfile.renovation_and_utilities,
        renovation_status: document.getElementById('prop-reno').value,
        furnished_status: document.getElementById('prop-furnished').value,
        heating_system: document.getElementById('prop-heating').value
      },
      viewing_schedule: {
        ...currentProfile.viewing_schedule,
        availability_hours: document.getElementById('prop-viewing-hours').value
      },
      rules_for_brokers: currentProfile.rules_for_brokers || {}
    };

    try {
      const res = await fetch('/api/house-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      btnSaveProfile.textContent = '✅ Yadda Saxlanıldı!';
      setTimeout(() => { btnSaveProfile.textContent = '💾 Yadda Saxla'; }, 2000);
    } catch (err) {
      alert('Xəta baş verdi: ' + err.message);
      btnSaveProfile.textContent = '💾 Yadda Saxla';
    }
  });

  // 4. Leads Management
  async function loadLeads() {
    try {
      const [leadsRes, statusRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/chat-statuses')
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
          await fetch(`/api/chat/${phone}/resume`, { method: 'POST' });
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
          await fetch(`/api/chat/${phone}/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutes: 300 })
          });
          await loadLeads();
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  btnRefreshLeads.addEventListener('click', loadLeads);

  // 5. Controls
  autoReplyToggle.addEventListener('change', async () => {
    const isChecked = autoReplyToggle.checked;
    updateAutoReplyLabel(isChecked);
    try {
      await fetch('/api/auto-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: isChecked })
      });
    } catch (e) {
      console.error('Error toggling auto-reply:', e);
    }
  });

  btnReconnect.addEventListener('click', async () => {
    btnReconnect.textContent = 'Qoşulur...';
    try {
      await fetch('/api/whatsapp/reconnect', { method: 'POST' });
    } finally {
      setTimeout(() => { btnReconnect.textContent = '🔄 Yenilə'; }, 1500);
    }
  });

  btnLogout.addEventListener('click', async () => {
    if (confirm('WhatsApp hesabından çıxış etmək istədiyinizə əminsiniz?')) {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
    }
  });

  // 6. AI Simulator Sandbox
  async function sendSimMessage(text) {
    const msg = text.trim();
    if (!msg) return;

    // Append user bubble
    appendSimBubble('user', msg);
    simInput.value = '';
    btnSimSend.disabled = true;
    btnSimSend.textContent = '...';

    try {
      const res = await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Initial Boot
  initSSE();
  fetchStatus();
  loadHouseProfile();
  loadLeads();
});
