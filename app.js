// ============================================================
// SecondMind – app.js
// Verantwortlich für: Einträge (CRUD), Dashboard, Erinnerungen
// Datenspeicher: localStorage
// ============================================================

const STORAGE_KEY = 'secondmind_entries';

// --- State ---
let entries = loadEntries();
let activeFilter = 'all';
let editingId = null;       // null = neuer Eintrag, sonst ID des bearbeiteten Eintrags

// --- DOM-Referenzen ---
const dashboard    = document.getElementById('dashboard');
const emptyMsg     = document.getElementById('empty-msg');
const modal        = document.getElementById('modal');
const modalTitle   = document.getElementById('modal-title');
const btnNew       = document.getElementById('btn-new');
const btnSave      = document.getElementById('btn-save');
const btnCancel    = document.getElementById('btn-cancel');
const categoryEl   = document.getElementById('entry-category');
const textEl       = document.getElementById('entry-text');
const reminderEl   = document.getElementById('entry-reminder');
const toast        = document.getElementById('toast');
const filterBtns   = document.querySelectorAll('.filter-btn');

// ============================================================
// PERSISTENZ
// ============================================================
function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ============================================================
// DASHBOARD RENDERN
// ============================================================
function renderDashboard() {
  // Alte Karten entfernen (nicht den empty-msg-Knoten)
  document.querySelectorAll('.entry-card').forEach(el => el.remove());

  const filtered = activeFilter === 'all'
    ? entries
    : entries.filter(e => e.category === activeFilter);

  // Neueste zuerst
  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

  emptyMsg.style.display = sorted.length === 0 ? 'block' : 'none';

  sorted.forEach(entry => {
    const card = buildCard(entry);
    dashboard.appendChild(card);
  });
}

function buildCard(entry) {
  const card = document.createElement('article');
  card.className = 'entry-card';
  card.dataset.id = entry.id;

  const date = new Date(entry.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const reminderHTML = entry.reminder
    ? `<div class="card-reminder">🔔 ${new Date(entry.reminder).toLocaleString('de-DE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</div>`
    : '';

  card.innerHTML = `
    <div class="card-top">
      <span class="category-tag tag-${entry.category}">${capitalize(entry.category)}</span>
      <span class="card-date">${date}</span>
    </div>
    <p class="card-body">${escapeHtml(entry.text)}</p>
    ${reminderHTML}
    <div class="card-actions">
      <button class="btn-edit" data-id="${entry.id}">Bearbeiten</button>
      <button class="btn-delete" data-id="${entry.id}">Löschen</button>
    </div>
  `;

  card.querySelector('.btn-edit').addEventListener('click', () => openEdit(entry.id));
  card.querySelector('.btn-delete').addEventListener('click', () => deleteEntry(entry.id));

  return card;
}

// ============================================================
// MODAL ÖFFNEN / SCHLIESSEN
// ============================================================
function openNew() {
  editingId = null;
  modalTitle.textContent = 'Neuer Eintrag';
  categoryEl.value = 'idee';
  textEl.value = '';
  reminderEl.value = '';
  showModal();
}

function openEdit(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  editingId = id;
  modalTitle.textContent = 'Eintrag bearbeiten';
  categoryEl.value = entry.category;
  textEl.value = entry.text;
  reminderEl.value = entry.reminder
    ? new Date(entry.reminder).toISOString().slice(0, 16)
    : '';
  showModal();
}

function showModal() {
  modal.classList.remove('hidden');
  textEl.focus();
}

function closeModal() {
  modal.classList.add('hidden');
}

// ============================================================
// EINTRAG SPEICHERN
// ============================================================
function saveEntry() {
  const text = textEl.value.trim();
  if (!text) {
    showToast('Bitte gib etwas ein.');
    textEl.focus();
    return;
  }

  const reminderValue = reminderEl.value
    ? new Date(reminderEl.value).getTime()
    : null;

  if (editingId) {
    // Bearbeiten
    const idx = entries.findIndex(e => e.id === editingId);
    if (idx !== -1) {
      entries[idx] = {
        ...entries[idx],
        category: categoryEl.value,
        text,
        reminder: reminderValue,
        updatedAt: Date.now()
      };
      scheduleReminder(entries[idx]);
      showToast('Eintrag aktualisiert.');
    }
  } else {
    // Neu
    const entry = {
      id: crypto.randomUUID(),
      category: categoryEl.value,
      text,
      reminder: reminderValue,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    entries.push(entry);
    scheduleReminder(entry);
    showToast('Eintrag gespeichert.');
  }

  saveEntries();
  renderDashboard();
  closeModal();
}

// ============================================================
// EINTRAG LÖSCHEN
// ============================================================
function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  saveEntries();
  renderDashboard();
  showToast('Eintrag gelöscht.');
}

// ============================================================
// IOS & STANDALONE DETECTION
// ============================================================
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
// standalone = true wenn als installierte PWA geöffnet (Home Screen)
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

// ============================================================
// ERINNERUNGEN – Banner-UI & Permission-Flow
// ============================================================
const notifBanner      = document.getElementById('notif-banner');
const btnNotifAllow    = document.getElementById('btn-notif-allow');
const btnNotifDismiss  = document.getElementById('btn-notif-dismiss');
const iosInstallHint   = document.getElementById('ios-install-hint');
const btnInstallDismiss = document.getElementById('btn-install-dismiss');

/**
 * Zeigt den passenden Hinweis an:
 * - iOS + nicht installiert → Install-Hint ("Zum Home-Bildschirm hinzufügen")
 * - Notifications supported + permission 'default' → Banner mit Erlauben-Button
 */
function initNotificationUI() {
  // iOS aber App nicht als PWA installiert → Notifications funktionieren nicht
  if (isIOS && !isStandalone) {
    if (!localStorage.getItem('sm_install_hint_dismissed')) {
      iosInstallHint.classList.remove('hidden');
    }
    return;
  }

  // Browser unterstützt keine Notifications
  if (!('Notification' in window)) return;

  // Bereits erlaubt oder dauerhaft abgelehnt → kein Banner
  if (Notification.permission !== 'default') return;

  // Nutzer hat Banner bereits weggeklickt
  if (localStorage.getItem('sm_notif_banner_dismissed')) return;

  notifBanner.classList.remove('hidden');
}

/**
 * Permission anfragen – MUSS durch User-Geste ausgelöst werden.
 * iOS Safari blockiert Notification.requestPermission() bei Auto-Aufruf still.
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Dein Browser unterstützt keine Benachrichtigungen.');
    return;
  }

  const permission = await Notification.requestPermission();
  notifBanner.classList.add('hidden');

  if (permission === 'granted') {
    showToast('Erinnerungen aktiviert! ✅');
    rescheduleAllReminders();
  } else {
    showToast('Benachrichtigungen wurden nicht erlaubt.');
  }
}

/**
 * Erinnerung einplanen.
 * WICHTIG: Auf iOS muss showNotification() über den Service Worker laufen –
 * new Notification() funktioniert dort auch als installierte PWA NICHT.
 */
function scheduleReminder(entry) {
  if (!entry.reminder) return;
  const delay = entry.reminder - Date.now();
  if (delay <= 0) return;
  if (delay > 2_147_483_647) return; // setTimeout max ~24 Tage

  setTimeout(async () => {
    if (Notification.permission !== 'granted') return;

    // Bevorzugt: Service Worker showNotification (funktioniert auf iOS + Android)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('SecondMind – Erinnerung', {
          body: entry.text.slice(0, 100),
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          tag: entry.id,
          renotify: true
        });
        return;
      } catch (err) {
        console.warn('SW showNotification fehlgeschlagen:', err);
      }
    }

    // Fallback: Direkte Notification API (Desktop-Browser)
    new Notification('SecondMind – Erinnerung', {
      body: entry.text.slice(0, 100),
      icon: 'icons/icon-192.png',
      tag: entry.id
    });
  }, delay);
}

function rescheduleAllReminders() {
  entries.forEach(scheduleReminder);
}

// ============================================================
// SERVICE WORKER REGISTRIEREN
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW-Registrierung fehlgeschlagen:', err);
    });
  });
}

// ============================================================
// TOAST
// ============================================================
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// EVENT LISTENER
// ============================================================
btnNew.addEventListener('click', openNew);
btnSave.addEventListener('click', saveEntry);
btnCancel.addEventListener('click', closeModal);

// Notification-Banner: Erlauben-Button löst User-Gesture-konform die Permission aus
btnNotifAllow.addEventListener('click', requestNotificationPermission);
btnNotifDismiss.addEventListener('click', () => {
  notifBanner.classList.add('hidden');
  localStorage.setItem('sm_notif_banner_dismissed', '1');
});

// iOS Install-Hint schließen
btnInstallDismiss.addEventListener('click', () => {
  iosInstallHint.classList.add('hidden');
  localStorage.setItem('sm_install_hint_dismissed', '1');
});

// Modal schließen bei Klick auf Backdrop
modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});

// Keyboard: Escape schließt Modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// Filter
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderDashboard();
  });
});

// ============================================================
// INIT
// ============================================================
// Notification-UI initialisieren (Banner oder iOS-Hint anzeigen wenn nötig)
// NICHT automatisch Permission anfragen – das muss per User-Geste passieren!
initNotificationUI();
rescheduleAllReminders();
renderDashboard();
