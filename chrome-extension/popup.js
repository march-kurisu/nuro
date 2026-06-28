// Nuro Chrome Extension - Popup script
// Minimal vanilla JS popup: setup (backend URL + token) → subject picker → focus toggle → RAG chat

const $root = document.getElementById("root");

let state = {
  backendUrl: "",
  token: "",
  subjects: [],
  activeSubjectId: null,
  focusMode: true,
  messages: [],
  sessionId: null,
  busy: false,
  error: "",
};

// Load from chrome.storage
async function loadState() {
  const s = await chrome.storage.local.get([
    "backendUrl", "token", "activeSubjectId", "focusMode"
  ]);
  state.backendUrl = s.backendUrl || "";
  state.token = s.token || "";
  state.activeSubjectId = s.activeSubjectId || null;
  state.focusMode = s.focusMode !== false;
}

async function saveState(patch) {
  Object.assign(state, patch);
  await chrome.storage.local.set(patch);
}

function api(path, opts = {}) {
  return fetch(`${state.backendUrl}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
      ...(opts.headers || {}),
    },
  });
}

async function fetchSubjects() {
  try {
    const r = await api("/subjects");
    if (!r.ok) throw new Error("Auth failed. Check your token.");
    state.subjects = await r.json();
    if (!state.activeSubjectId && state.subjects[0]) {
      await saveState({ activeSubjectId: state.subjects[0].subject_id });
    }
    state.error = "";
  } catch (e) {
    state.error = e.message;
    state.subjects = [];
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderSetup() {
  $root.innerHTML = `
    <div class="header">
      <div class="logo">✦</div>
      <div class="brand">
        <div class="name">Nuro</div>
        <div class="sub">Set up your extension</div>
      </div>
    </div>
    <div class="setup">
      <h2>Connect to Nuro</h2>
      <p>Paste your backend URL and a session token from the web app (Settings → Show extension token).</p>
      ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ""}
      <label class="label">Backend URL</label>
      <input id="backendUrl" placeholder="https://your-app.preview.emergentagent.com" value="${escapeHtml(state.backendUrl)}" />
      <label class="label">Session token</label>
      <input id="token" placeholder="sess_..." value="${escapeHtml(state.token)}" />
      <button class="btn" id="connect">Connect</button>
      <p class="muted">Tip: Open the Nuro web app → DevTools → <span class="kbd">localStorage.getItem('lle_token')</span> to grab your token.</p>
    </div>
  `;
  document.getElementById("connect").onclick = async () => {
    const url = document.getElementById("backendUrl").value.trim().replace(/\/$/, "");
    const tk = document.getElementById("token").value.trim();
    if (!url || !tk) { state.error = "Both fields required"; renderSetup(); return; }
    await saveState({ backendUrl: url, token: tk });
    await fetchSubjects();
    if (state.error) renderSetup(); else render();
  };
}

function renderMain() {
  const active = state.subjects.find((s) => s.subject_id === state.activeSubjectId);
  $root.innerHTML = `
    <div class="header">
      <div class="logo">✦</div>
      <div class="brand">
        <div class="name">Nuro</div>
        <div class="sub">${escapeHtml(active?.title || "No active subject")}</div>
      </div>
      <div class="dot" title="Connected"></div>
    </div>

    <div class="section">
      <div class="label">Active subject</div>
      <select class="select" id="subjectSelect">
        ${state.subjects.length === 0 ? `<option value="">— No subjects —</option>` : ""}
        ${state.subjects.map((s) => `<option value="${s.subject_id}" ${s.subject_id === state.activeSubjectId ? "selected" : ""}>${escapeHtml(s.title)}</option>`).join("")}
      </select>
    </div>

    <div class="section">
      <div class="row">
        <div>
          <div class="title-bold">⚡ Focus Mode</div>
          <div class="muted">${state.focusMode ? "Nudging on distractions" : "Off"}</div>
        </div>
        <button class="toggle ${state.focusMode ? "on" : "off"}" id="focusToggle"><span class="knob"></span></button>
      </div>
    </div>

    <div class="chat" id="chat">
      ${state.messages.length === 0 ? `<div class="msg"><div class="bubble ai">Hi! Ask me anything about <b>${escapeHtml(active?.title || "your subject")}</b>. I'll ground my answer in your uploaded materials.</div></div>` : ""}
      ${state.messages.map((m) => `
        <div class="msg ${m.role}">
          <div class="bubble ${m.role}">
            ${escapeHtml(m.content || "…")}
            ${m.sources && m.sources.length ? `<div class="sources">${m.sources.map((s) => `<span class="source-pill">${escapeHtml(s.title)} #${(s.ord || 0) + 1}</span>`).join("")}</div>` : ""}
          </div>
        </div>
      `).join("")}
    </div>

    <div class="composer">
      <input id="chatInput" placeholder="Ask about ${escapeHtml(active?.title || "this subject")}…" ${state.busy ? "disabled" : ""} />
      <button id="sendBtn" ${state.busy || !state.activeSubjectId ? "disabled" : ""}>↑</button>
    </div>
  `;

  document.getElementById("subjectSelect").onchange = async (e) => {
    await saveState({ activeSubjectId: e.target.value });
    state.messages = [];
    state.sessionId = null;
    render();
  };

  document.getElementById("focusToggle").onclick = async () => {
    await saveState({ focusMode: !state.focusMode });
    chrome.runtime.sendMessage({ type: "FOCUS_TOGGLED", on: state.focusMode });
    render();
  };

  const input = document.getElementById("chatInput");
  const send = document.getElementById("sendBtn");
  const submit = async () => {
    const text = input.value.trim();
    if (!text || !state.activeSubjectId) return;
    state.messages.push({ role: "user", content: text });
    state.messages.push({ role: "ai", content: "" });
    state.busy = true;
    render();
    const chatBox = document.getElementById("chat");
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const resp = await fetch(`${state.backendUrl}/api/subjects/${state.activeSubjectId}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ message: text, session_id: state.sessionId }),
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const lastIdx = state.messages.length - 1;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop();
        for (const evt of events) {
          let type = "message", dataStr = "";
          for (const l of evt.split("\n")) {
            if (l.startsWith("event:")) type = l.slice(6).trim();
            else if (l.startsWith("data:")) dataStr += l.slice(5).trim();
          }
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (type === "delta") {
              state.messages[lastIdx].content = (state.messages[lastIdx].content || "") + data.t;
              render();
              const cb = document.getElementById("chat"); if (cb) cb.scrollTop = cb.scrollHeight;
            } else if (type === "sources") {
              state.messages[lastIdx].sources = data;
            } else if (type === "session") {
              state.sessionId = data.session_id;
            }
          } catch {}
        }
      }
    } catch (e) {
      state.messages[state.messages.length - 1].content = "⚠️ " + e.message;
    } finally {
      state.busy = false;
      render();
    }
  };
  send.onclick = submit;
  input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
  input.focus();
}

function render() {
  if (!state.backendUrl || !state.token) return renderSetup();
  if (state.error) return renderSetup();
  renderMain();
}

(async () => {
  await loadState();
  if (state.backendUrl && state.token) {
    await fetchSubjects();
  }
  render();
})();
