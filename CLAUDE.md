# SecondMind – Projektkontext & Entwicklungsregeln

## Was ist SecondMind?
Eine persönliche Progressive Web App (PWA), die als digitales "Second Brain" fungiert. 
Ziel: externe Gedächtniserweiterung, nutzbar im Browser und als installierte App auf dem Handy.

## Tech-Stack (verbindlich)
- **PWA** (Service Worker + Web App Manifest) für Offline-Fähigkeit & Push-Benachrichtigungen
- **Vanilla JS oder leichtgewichtiges Framework** (kein unnötiger Overhead)
- **localStorage** als primärer Datenspeicher (keine Datenbank, keine Backend-Kosten)
- **Hosting:** Vercel oder Netlify (kostenloser Tier)
- **Keine laufenden Kosten** – jede Entscheidung muss dieses Kriterium erfüllen

## Core Features v1.0 (MVP – nur diese, kein Scope Creep)
1. **Eintrag erstellen** – Freitextfeld + Kategorie-Tag (Idee / To-Do / Gedanke / Gefühl / Tagebuch)
2. **Dashboard** – Übersicht aller Einträge, filterbar nach Kategorie
3. **Erinnerungen** – Pro Eintrag optional eine Benachrichtigung setzen (Web Notifications API)

## Entwicklungsprinzipien
- **MVP first**: Keine neuen Features einbauen, solange die Core Features nicht stabil laufen
- **Kein Scope Creep**: Wenn eine Idee außerhalb der v1.0-Liste liegt → als Kommentar oder TODO markieren, aber nicht implementieren
- **Einfachheit vor Eleganz**: Lesbarer, wartbarer Code schlägt clevere Abstraktion
- **Offline-first**: App muss ohne Internetverbindung nutzbar sein
- **Mobile-first**: UI zuerst für kleine Bildschirme designen

## Projektstruktur (Ziel)secondmind/
├── index.html
├── app.js
├── style.css
├── manifest.json
└── sw.js          ← Service Worker
## Kommunikationsregeln für diesen Raum
- Fragen zur Architektur oder Technik → immer mit Begründung und Trade-offs antworten
- Code-Vorschläge → vollständig, direkt einsetzbar, kommentiert
- Bei Unsicherheit lieber nachfragen als annehmen
- Neue Ideen werden gesammelt und als "v2.0 Backlog" markiert, nicht direkt umgesetzt