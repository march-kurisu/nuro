# Nuro — Chrome Extension

A companion extension for the Nuro AI study app.

## Features
- **Active Subject picker** — bound to your Nuro account
- **Focus Mode** — detects when you visit distracting sites and posts a focus event to your backend + shows a desktop nudge
- **RAG Chat** — quick chat tied to your active subject, grounded in your uploaded materials (streams from `/api/subjects/:id/chat/stream`)

## Install (developer mode)
1. Open `chrome://extensions`
2. Toggle **Developer mode**
3. Click **Load unpacked**
4. Select this `/app/chrome-extension` folder
5. Click the Nuro icon in your toolbar

## Connect
On first open you'll be prompted for two values:
- **Backend URL** — your Nuro backend (e.g. `https://web-extension-6.preview.emergentagent.com`)
- **Session token** — open Nuro web app → DevTools → run `localStorage.getItem('lle_token')` → paste it

After connecting, pick an active subject and start chatting.

## Files
- `manifest.json` — Manifest V3 config
- `popup.html` / `popup.css` / `popup.js` — the action popup UI
- `background.js` — service worker handling focus mode tab events
- `icons/` — extension icons (PNG)
