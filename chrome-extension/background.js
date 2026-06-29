// Nuro background service worker
// - Watches tab navigation
// - When user visits a distracting site during Focus Mode, posts a focus event AND
//   injects a full-screen red "Back to learning" overlay into the page

const DISTRACTION_HOSTS = [
  "youtube.com", "facebook.com", "twitter.com", "x.com",
  "instagram.com", "tiktok.com", "reddit.com", "netflix.com",
  "twitch.tv", "9gag.com", "pinterest.com"
];

async function getCfg() {
  return await chrome.storage.local.get(["backendUrl", "token", "activeSubjectId", "focusMode"]);
}

function isDistracting(url) {
  try {
    const u = new URL(url);
    return DISTRACTION_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch { return false; }
}

async function postEvent(onTask, url, title) {
  const cfg = await getCfg();
  if (!cfg.backendUrl || !cfg.token) return;
  try {
    await fetch(`${cfg.backendUrl}/api/focus/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ url, title, on_task: onTask }),
    });
  } catch {}
}

async function injectBlocker(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (document.getElementById("__nuro_blocker__")) return;
        const overlay = document.createElement("div");
        overlay.id = "__nuro_blocker__";
        overlay.setAttribute("data-nuro", "blocker");
        Object.assign(overlay.style, {
          position: "fixed", inset: "0", zIndex: "2147483647",
          background: "linear-gradient(180deg, rgba(220,38,38,0.97) 0%, rgba(153,27,27,0.99) 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          textAlign: "center", padding: "32px", backdropFilter: "blur(8px)",
        });
        overlay.innerHTML = `
          <div style="width:120px;height:120px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:32px;box-shadow:0 20px 50px rgba(0,0,0,0.3);">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 9v4"></path>
              <path d="M12 17h.01"></path>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            </svg>
          </div>
          <h1 style="font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:56px;font-weight:800;letter-spacing:-0.02em;margin:0 0 12px;line-height:1;">Stop. Focus.</h1>
          <p style="font-size:20px;font-weight:600;max-width:540px;margin:0 0 8px;opacity:0.95;">This site is blocked during your study session.</p>
          <p style="font-size:16px;max-width:480px;margin:0 0 32px;opacity:0.8;">Go back to your learning materials — your future self will thank you.</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
            <button id="__nuro_back__" style="padding:14px 28px;border-radius:9999px;background:#E4F222;color:#0F172A;font-weight:800;font-size:16px;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.2);">← Back to learning</button>
            <button id="__nuro_dismiss__" style="padding:14px 28px;border-radius:9999px;background:rgba(255,255,255,0.15);color:white;font-weight:700;font-size:16px;border:1.5px solid rgba(255,255,255,0.3);cursor:pointer;">Dismiss for this tab</button>
          </div>
          <p style="margin-top:32px;font-size:12px;opacity:0.6;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">Nuro Focus Mode · You got this 💪</p>
        `;
        document.documentElement.appendChild(overlay);
        document.body && (document.body.style.overflow = "hidden");
        document.getElementById("__nuro_back__").onclick = () => history.back();
        document.getElementById("__nuro_dismiss__").onclick = () => {
          overlay.remove();
          if (document.body) document.body.style.overflow = "";
        };
      },
    });
  } catch (e) {
    // chrome:// pages can't be scripted — fallback to notification
    chrome.notifications?.create?.({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Nuro · Stay in flow",
      message: "Distraction detected. Get back to your study materials!",
      priority: 2,
    });
  }
}

chrome.tabs?.onUpdated?.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete" || !tab?.url) return;
  const cfg = await getCfg();
  const distracting = isDistracting(tab.url);
  await postEvent(!distracting, tab.url, tab.title);
  if (distracting && cfg.focusMode !== false) {
    injectBlocker(tabId);
  }
});

chrome.runtime?.onMessage?.addListener((msg) => {
  if (msg?.type === "FOCUS_TOGGLED") { /* no-op */ }
});
