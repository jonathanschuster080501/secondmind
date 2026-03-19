// ============================================================
// SecondMind – Service Worker
// Strategie: Cache-first für App-Shell, Network-first für alles andere
// ============================================================

const CACHE_NAME = 'secondmind-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json'
  // JS wird von Vite gebündelt und dynamisch gecacht (kein statischer Pfad)
];

// --- Install: App-Shell in Cache legen ---
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// --- Activate: Alten Cache löschen ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// --- Push: Benachrichtigung anzeigen (für zukünftigen Push-Server) ---
self.addEventListener('push', event => {
  const data = event.data
    ? event.data.json()
    : { title: 'SecondMind', body: 'Neue Erinnerung' };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SecondMind – Erinnerung', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'secondmind-push'
    })
  );
});

// --- Notification Click: App öffnen oder fokussieren ---
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Offenes Fenster vorhanden? Fokussieren.
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        // Sonst neues Fenster öffnen
        return clients.openWindow('/');
      })
  );
});

// --- Fetch: Cache-first für App-Shell ---
self.addEventListener('fetch', event => {
  // Nur GET-Requests behandeln
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Valide Responses in Cache aufnehmen
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline-Fallback für Navigation
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
