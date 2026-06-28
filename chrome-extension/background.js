// Nuro background service worker
// - Maintains focus mode preference
// - Detects distraction sites during active study windows and pings backend
// - Shows a notification nudge

const DISTRACTION_HOSTS = [
  "youtube.com", "facebook.com", "twitter.com", "x.com",
  "instagram.com", "tiktok.com", "reddit.com", "netflix.com"
];

async function getCfg() {
  return await chrome.storage.local.get(["backendUrl", "token", "activeSubjectId", "focusMode"]);
}

function isDistracting(url) {
  try {
    const u = new URL(url);
    return DISTRACTION_HOSTS.some((h) => u.hostname.endsWith(h));
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

function nudge(url) {
  chrome.notifications?.create?.({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Nuro · Stay in flow",
    message: "Distraction detected. Want to return to your study materials?",
    priority: 2,
  });
}

chrome.tabs?.onUpdated?.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete" || !tab?.url) return;
  const cfg = await getCfg();
  if (cfg.focusMode === false) return;
  const distracting = isDistracting(tab.url);
  await postEvent(!distracting, tab.url, tab.title);
  if (distracting) nudge(tab.url);
});

chrome.runtime?.onMessage?.addListener((msg) => {
  if (msg?.type === "FOCUS_TOGGLED") {
    // could schedule alarms here later
  }
});
