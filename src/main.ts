// ============================================================
// SecondMind – main.ts
// Datenspeicher: Supabase (Auth via Magic Link)
// ============================================================

import { supabase } from './lib/supabase'
import {
  fetchEntries, createEntry, updateEntry, deleteEntry,
  fetchPreferences, upsertPreferences,
  type Entry, type EntryType
} from './lib/db'

// ============================================================
// TYPEN & KONSTANTEN
// ============================================================

type Theme = 'midnight_void' | 'paper_light'

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  concept:    'Idee',
  todo:       'To-Do',
  quick_note: 'Gedanke',
  diary:      'Gefühl',
  bullets:    'Tagebuch',
}

function typeToClass(type: EntryType): string {
  return `tag-${type.replace('_', '-')}`
}

// ============================================================
// STATE
// ============================================================

let entries: Entry[] = []
let activeFilter: string = 'all'
let editingId: string | null = null

// ============================================================
// DOM-REFERENZEN
// ============================================================

const dashboard         = document.getElementById('dashboard')!
const emptyMsg          = document.getElementById('empty-msg')!
const modal             = document.getElementById('modal')!
const modalTitle        = document.getElementById('modal-title')!
const btnNew            = document.getElementById('btn-new')!
const btnSave           = document.getElementById('btn-save')!
const btnCancel         = document.getElementById('btn-cancel')!
const btnLogout         = document.getElementById('btn-logout')!
const btnThemeToggle    = document.getElementById('btn-theme-toggle')!
const categoryEl        = document.getElementById('entry-category') as HTMLSelectElement
const textEl            = document.getElementById('entry-text') as HTMLTextAreaElement
const reminderEl        = document.getElementById('entry-reminder') as HTMLInputElement
const toast             = document.getElementById('toast')!
const filterBtns        = document.querySelectorAll<HTMLElement>('.filter-btn')
const notifBanner       = document.getElementById('notif-banner')!
const btnNotifAllow     = document.getElementById('btn-notif-allow')!
const btnNotifDismiss   = document.getElementById('btn-notif-dismiss')!
const iosInstallHint    = document.getElementById('ios-install-hint')!
const btnInstallDismiss = document.getElementById('btn-install-dismiss')!

// Auth
const appShell        = document.getElementById('app-shell')!
const authOverlay     = document.getElementById('auth-overlay')!
const authForm        = document.getElementById('auth-form')!
const authSuccessMsg  = document.getElementById('auth-success')!
const authEmailEl     = document.getElementById('auth-email') as HTMLInputElement
const btnMagicLink    = document.getElementById('btn-magic-link')!
const authError       = document.getElementById('auth-error')!

// ============================================================
// AUTH UI
// ============================================================

function showAuthOverlay() {
  authOverlay.classList.remove('hidden')
  appShell.classList.add('app-shell-hidden')
  authForm.classList.remove('hidden')
  authSuccessMsg.classList.add('hidden')
  authEmailEl.value = ''
  clearAuthError()
  btnNew.setAttribute('disabled', '')
  btnLogout.classList.add('hidden')
}

function hideAuthOverlay() {
  authOverlay.classList.add('hidden')
  appShell.classList.remove('app-shell-hidden')
  btnNew.removeAttribute('disabled')
  btnLogout.classList.remove('hidden')
}

function showAuthError(msg: string) {
  authError.textContent = msg
  authError.classList.remove('hidden')
}

function clearAuthError() {
  authError.classList.add('hidden')
  authError.textContent = ''
}

btnMagicLink.addEventListener('click', async () => {
  clearAuthError()
  const email = authEmailEl.value.trim()
  if (!email) { showAuthError('Bitte E-Mail eingeben.'); return }

  btnMagicLink.setAttribute('disabled', '')
  const { error } = await supabase.auth.signInWithOtp({ email })
  btnMagicLink.removeAttribute('disabled')

  if (error) {
    showAuthError(error.message)
  } else {
    authForm.classList.add('hidden')
    authSuccessMsg.classList.remove('hidden')
  }
})

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut()
  entries = []
  renderDashboard()
  showAuthOverlay()
})

// URL-Hash auf Supabase-Fehler prüfen (z.B. abgelaufener Magic Link)
;(function checkHashError() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const error = hash.get('error')
  const desc  = hash.get('error_description')
  if (error) {
    const msg = desc
      ? decodeURIComponent(desc.replace(/\+/g, ' '))
      : error
    showAuthOverlay()
    showAuthError(msg)
    history.replaceState(null, '', window.location.pathname)
  }
})()

// ============================================================
// AUTH STATE
// ============================================================

// appLoaded-Flag verhindert doppeltes loadApp() wenn
// SIGNED_IN und INITIAL_SESSION beide feuern
let appLoaded = false

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'INITIAL_SESSION') {
    if (session) {
      hideAuthOverlay()
      appLoaded = true
      await loadApp()
    } else {
      showAuthOverlay()
    }
  } else if (event === 'SIGNED_IN') {
    if (session && !appLoaded) {
      hideAuthOverlay()
      appLoaded = true
      await loadApp()
    } else if (session) {
      hideAuthOverlay()
    }
  } else if (event === 'SIGNED_OUT') {
    appLoaded = false
    entries = []
    renderDashboard()
    showAuthOverlay()
  }
})

// ============================================================
// APP INITIALISIEREN
// ============================================================

async function loadApp() {
  try {
    const [fetchedEntries, prefs] = await Promise.all([
      fetchEntries(),
      fetchPreferences(),
    ])

    entries = fetchedEntries

    if (prefs) {
      applyTheme(prefs.theme)
    } else {
      const defaultTheme = systemTheme()
      await upsertPreferences({ theme: defaultTheme, layout: 'grid' })
      applyTheme(defaultTheme)
    }

    rescheduleAllReminders()
    renderDashboard()
    initNotificationUI()
  } catch (err) {
    showToast('Fehler beim Laden der Daten.')
    console.error(err)
  }
}

// ============================================================
// THEME
// ============================================================

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'paper_light'
    : 'midnight_void'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  btnThemeToggle.textContent = theme === 'midnight_void' ? '☀️' : '🌙'
}

btnThemeToggle.addEventListener('click', async () => {
  const current = (document.documentElement.dataset.theme ?? 'midnight_void') as Theme
  const next: Theme = current === 'midnight_void' ? 'paper_light' : 'midnight_void'
  applyTheme(next)
  try {
    await upsertPreferences({ theme: next, layout: 'grid' })
  } catch (err) {
    console.error('Theme speichern fehlgeschlagen:', err)
  }
})

// ============================================================
// DASHBOARD RENDERN
// ============================================================

function renderDashboard() {
  document.querySelectorAll('.entry-card').forEach(el => el.remove())

  const filtered = activeFilter === 'all'
    ? entries
    : entries.filter(e => e.entry_type === activeFilter)

  emptyMsg.style.display = filtered.length === 0 ? 'block' : 'none'
  filtered.forEach(entry => dashboard.appendChild(buildCard(entry)))
}

function buildCard(entry: Entry): HTMLElement {
  const card = document.createElement('article')
  card.className = 'entry-card'
  card.dataset.id = entry.id

  const date = new Date(entry.created_at).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const reminderHTML = entry.remind_at
    ? `<div class="card-reminder">🔔 ${new Date(entry.remind_at).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>`
    : ''

  card.innerHTML = `
    <div class="card-top">
      <span class="category-tag ${typeToClass(entry.entry_type)}">${ENTRY_TYPE_LABELS[entry.entry_type]}</span>
      <span class="card-date">${date}</span>
    </div>
    <p class="card-body">${escapeHtml(entry.content)}</p>
    ${reminderHTML}
    <div class="card-actions">
      <button class="btn-edit" data-id="${entry.id}">Bearbeiten</button>
      <button class="btn-delete" data-id="${entry.id}">Löschen</button>
    </div>
  `

  card.querySelector('.btn-edit')!.addEventListener('click', () => openEdit(entry.id))
  card.querySelector('.btn-delete')!.addEventListener('click', () => handleDelete(entry.id))

  return card
}

// ============================================================
// MODAL
// ============================================================

function openNew() {
  editingId = null
  modalTitle.textContent = 'Neuer Eintrag'
  categoryEl.value = 'concept'
  textEl.value     = ''
  reminderEl.value = ''
  showModal()
}

function openEdit(id: string) {
  const entry = entries.find(e => e.id === id)
  if (!entry) return
  editingId = id
  modalTitle.textContent = 'Eintrag bearbeiten'
  categoryEl.value = entry.entry_type
  textEl.value     = entry.content
  reminderEl.value = entry.remind_at
    ? new Date(entry.remind_at).toISOString().slice(0, 16)
    : ''
  showModal()
}

function showModal() {
  modal.classList.remove('hidden')
  textEl.focus()
}

function closeModal() {
  modal.classList.add('hidden')
}

// ============================================================
// EINTRAG SPEICHERN
// ============================================================

async function saveEntry() {
  const content = textEl.value.trim()
  if (!content) {
    showToast('Bitte gib etwas ein.')
    textEl.focus()
    return
  }

  const entry_type = categoryEl.value as EntryType
  const remind_at  = reminderEl.value
    ? new Date(reminderEl.value).toISOString()
    : null

  btnSave.setAttribute('disabled', '')

  try {
    if (editingId) {
      const updated = await updateEntry(editingId, { content, entry_type, remind_at })
      entries = entries.map(e => e.id === editingId ? updated : e)
      scheduleReminder(updated)
      showToast('Eintrag aktualisiert.')
    } else {
      const created = await createEntry({ content, entry_type, remind_at })
      entries.unshift(created)
      scheduleReminder(created)
      showToast('Eintrag gespeichert.')
    }

    renderDashboard()
    closeModal()
  } catch (err) {
    showToast('Speichern fehlgeschlagen.')
    console.error('saveEntry error:', err)
  } finally {
    btnSave.removeAttribute('disabled')
  }
}

// ============================================================
// EINTRAG LÖSCHEN
// ============================================================

async function handleDelete(id: string) {
  try {
    await deleteEntry(id)
    entries = entries.filter(e => e.id !== id)
    renderDashboard()
    showToast('Eintrag gelöscht.')
  } catch (err) {
    showToast('Löschen fehlgeschlagen.')
    console.error(err)
  }
}

// ============================================================
// FILTER
// ============================================================

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    activeFilter = btn.dataset.filter ?? 'all'
    renderDashboard()
  })
})

// ============================================================
// EVENT LISTENER
// ============================================================

btnNew.addEventListener('click', openNew)
btnSave.addEventListener('click', saveEntry)
btnCancel.addEventListener('click', closeModal)

btnNotifAllow.addEventListener('click', requestNotificationPermission)
btnNotifDismiss.addEventListener('click', () => {
  notifBanner.classList.add('hidden')
  localStorage.setItem('sm_notif_banner_dismissed', '1')
})
btnInstallDismiss.addEventListener('click', () => {
  iosInstallHint.classList.add('hidden')
  localStorage.setItem('sm_install_hint_dismissed', '1')
})

modal.addEventListener('click', e => { if (e.target === modal) closeModal() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

// ============================================================
// IOS & STANDALONE
// ============================================================

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

// ============================================================
// ERINNERUNGEN
// ============================================================

function initNotificationUI() {
  if (isIOS && !isStandalone) {
    if (!localStorage.getItem('sm_install_hint_dismissed')) {
      iosInstallHint.classList.remove('hidden')
    }
    return
  }
  if (!('Notification' in window)) return
  if (Notification.permission !== 'default') return
  if (localStorage.getItem('sm_notif_banner_dismissed')) return
  notifBanner.classList.remove('hidden')
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Dein Browser unterstützt keine Benachrichtigungen.')
    return
  }
  const permission = await Notification.requestPermission()
  notifBanner.classList.add('hidden')
  if (permission === 'granted') {
    showToast('Erinnerungen aktiviert! ✅')
    rescheduleAllReminders()
  } else {
    showToast('Benachrichtigungen wurden nicht erlaubt.')
  }
}

function scheduleReminder(entry: Entry) {
  if (!entry.remind_at) return
  const delay = new Date(entry.remind_at).getTime() - Date.now()
  if (delay <= 0 || delay > 2_147_483_647) return

  setTimeout(() => {
    if (Notification.permission !== 'granted') return
    new Notification('SecondMind – Erinnerung', {
      body: entry.content.slice(0, 100),
      icon: 'icons/icon-192.png',
      tag: entry.id
    })
  }, delay)
}

function rescheduleAllReminders() {
  entries.forEach(scheduleReminder)
}

// ============================================================
// SERVICE WORKER (alte SWs entfernen)
// ============================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const reg of registrations) await reg.unregister()
  })
}

// ============================================================
// TOAST
// ============================================================

let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toast.textContent = msg
  toast.classList.remove('hidden')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500)
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
