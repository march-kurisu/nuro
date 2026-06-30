// Nuro Floating Bubble - injects a draggable Nuro button + panel onto ANY page.
// Uses Shadow DOM for style isolation so we don't clash with host page CSS.
(function () {
  if (window.__nuro_bubble_injected__) return;
  window.__nuro_bubble_injected__ = true;

  // Skip Chrome internal pages
  if (location.protocol === "chrome:" || location.protocol === "chrome-extension:") return;
  if (document.getElementById("__nuro_blocker__")) return; // don't show bubble on blocker overlay

  const STORAGE = {
    get: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
    set: (obj) => new Promise((r) => chrome.storage.local.set(obj, r)),
  };

  const POS_KEY = "nuro_bubble_pos_global";

  // ------- Host element with shadow root -------
  const host = document.createElement("div");
  host.id = "__nuro_bubble_host__";
  host.style.cssText = "all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483646;";
  (document.documentElement || document.body).appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  // ------- Styles -------
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    :host, * { box-sizing: border-box; }
    .font-display { font-family: 'Bricolage Grotesque', system-ui, sans-serif; letter-spacing: -0.02em; }
    body, * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

    .bubble {
      position: fixed; width: 44px; height: 44px; border-radius: 50%;
      background: #E4F222; color: #0F172A;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px -6px rgba(0,0,0,0.35), 0 0 0 3px rgba(228,242,34,0.18);
      cursor: grab; border: none; touch-action: none;
      transition: transform 0.15s;
    }
    .bubble:hover { transform: scale(1.05); }
    .bubble.dragging { cursor: grabbing; transform: scale(1.08); transition: none; }
    .bubble svg { width: 20px; height: 20px; }
    .bubble .status {
      position: absolute; bottom: -1px; right: -1px; width: 11px; height: 11px;
      border-radius: 50%; background: #16A34A; border: 2px solid white;
    }
    .bubble .status.off { background: #94A3B8; }

    .panel {
      position: fixed; width: 360px; height: 540px;
      background: white; border-radius: 24px;
      box-shadow: 0 30px 80px -20px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.05);
      display: flex; flex-direction: column; overflow: hidden;
      animation: fadeUp 0.2s ease-out;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .header { background: #0F172A; color: white; padding: 12px 14px; display: flex; align-items: center; gap: 10px; }
    .logo { width: 32px; height: 32px; border-radius: 8px; background: #E4F222; display: flex; align-items: center; justify-content: center; color: #0F172A; }
    .header .title { flex: 1; min-width: 0; }
    .header .title b { display: block; font-size: 14px; font-family: 'Bricolage Grotesque'; font-weight: 700; }
    .header .title small { display: block; font-size: 10px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .header .x { background: rgba(255,255,255,0.1); border: 0; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .header .x:hover { background: rgba(255,255,255,0.2); }

    .section { padding: 10px 14px; border-bottom: 1px solid #E5E7EB; background: #F9FAFB; }
    .section .lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6B7280; }
    .select {
      width: 100%; margin-top: 4px; padding: 6px 12px; border-radius: 9999px;
      border: 1.5px solid #E5E7EB; background: white; font-weight: 700; font-size: 12px; color: #0F172A;
      cursor: pointer; font-family: inherit;
    }
    .row { display: flex; align-items: center; justify-content: space-between; }
    .row b { font-size: 13px; }
    .row small { font-size: 11px; color: #6B7280; display: block; margin-top: 2px; }

    .toggle { position: relative; width: 40px; height: 24px; border-radius: 9999px; border: 0; cursor: pointer; transition: background 0.2s; }
    .toggle.on { background: #E4F222; }
    .toggle.off { background: #CBD5E1; }
    .toggle .knob { position: absolute; top: 2px; width: 20px; height: 20px; border-radius: 50%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: left 0.2s; }
    .toggle.on .knob { left: 18px; }
    .toggle.off .knob { left: 2px; }

    .chat { flex: 1; overflow-y: auto; padding: 12px 14px; background: #F9FAFB; }
    .msg { display: flex; margin-bottom: 8px; }
    .msg.user { justify-content: flex-end; }
    .bubble-msg { max-width: 85%; padding: 7px 12px; font-size: 12px; line-height: 1.5; word-wrap: break-word; }
    .bubble-msg.ai { background: #F1F5F9; color: #0F172A; border-radius: 18px 18px 18px 4px; }
    .bubble-msg.user { background: #0F172A; color: white; border-radius: 18px 18px 4px 18px; }

    .composer { padding: 10px 12px; border-top: 1px solid #E5E7EB; display: flex; gap: 6px; background: white; }
    .composer input { flex: 1; padding: 8px 14px; border-radius: 9999px; background: #F1F5F9; border: 1.5px solid transparent; font-size: 12px; outline: none; font-family: inherit; color: #0F172A; }
    .composer input:focus { background: white; border-color: #0F172A; }
    .composer button { width: 34px; height: 34px; border-radius: 50%; background: #0F172A; color: white; border: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .composer button:disabled { opacity: 0.4; cursor: not-allowed; }

    .setup { padding: 18px; }
    .setup h2 { font-family: 'Bricolage Grotesque'; font-weight: 700; font-size: 18px; margin: 0 0 6px; color: #0F172A; }
    .setup p { font-size: 11px; color: #6B7280; margin: 0 0 12px; line-height: 1.5; }
    .setup input { width: 100%; padding: 8px 12px; border-radius: 9999px; border: 1.5px solid #E5E7EB; background: #F9FAFB; font-size: 12px; outline: none; font-family: inherit; margin-bottom: 8px; }
    .setup input:focus { border-color: #0F172A; background: white; }
    .setup .btn { width: 100%; padding: 9px 16px; border-radius: 9999px; background: #E4F222; color: #0F172A; font-weight: 700; font-size: 13px; border: 0; cursor: pointer; }
  `;
  root.appendChild(style);

  // ------- DOM structure -------
  const container = document.createElement("div");
  root.appendChild(container);

  let state = {
    backendUrl: "",
    token: "",
    activeSubjectId: null,
    focusMode: true,
    subjects: [],
    panelOpen: false,
    messages: [],
    sessionId: null,
    busy: false,
    pos: { x: window.innerWidth - 64, y: window.innerHeight - 96 },
  };

  async function loadCfg() {
    const cfg = await STORAGE.get(["backendUrl", "token", "activeSubjectId", "focusMode"]);
    state.backendUrl = cfg.backendUrl || "";
    state.token = cfg.token || "";
    state.activeSubjectId = cfg.activeSubjectId || null;
    state.focusMode = cfg.focusMode !== false;
    const posStored = await STORAGE.get([POS_KEY]);
    if (posStored[POS_KEY]) state.pos = posStored[POS_KEY];
  }

  async function fetchSubjects() {
    if (!state.backendUrl || !state.token) return;
    try {
      const r = await fetch(`${state.backendUrl}/api/subjects`, {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (!r.ok) return;
      state.subjects = await r.json();
      if (!state.activeSubjectId && state.subjects[0]) {
        state.activeSubjectId = state.subjects[0].subject_id;
        STORAGE.set({ activeSubjectId: state.activeSubjectId });
      }
    } catch {}
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function activeSubject() {
    return state.subjects.find((s) => s.subject_id === state.activeSubjectId);
  }

  function render() {
    const a = activeSubject();
    const needsSetup = !state.backendUrl || !state.token;
    const sparkleSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>`;
    const closeSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
    const sendSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 14-7-7 14-2-5z"/></svg>`;

    let panelHtml = "";
    if (state.panelOpen) {
      // panel position
      const panelX = state.pos.x + 44 > window.innerWidth - 380 ? Math.max(8, state.pos.x - 380) : state.pos.x + 52;
      const panelY = Math.max(8, Math.min(state.pos.y, window.innerHeight - 560));
      if (needsSetup) {
        panelHtml = `
          <div class="panel" style="left:${panelX}px;top:${panelY}px;height:auto;">
            <div class="header">
              <span class="logo">${sparkleSVG}</span>
              <div class="title"><b>Nuro</b><small>Setup needed</small></div>
              <button class="x" data-act="close">${closeSVG}</button>
            </div>
            <div class="setup">
              <h2>Connect to Nuro</h2>
              <p>Open Nuro web app → /extension-preview → copy your backend URL and session token, paste them here.</p>
              <input id="be-url" placeholder="Backend URL (https://…)" value="${escapeHtml(state.backendUrl)}" />
              <input id="be-tok" placeholder="Session token (sess_…)" value="${escapeHtml(state.token)}" />
              <button class="btn" data-act="connect">Connect</button>
            </div>
          </div>`;
      } else {
        panelHtml = `
          <div class="panel" style="left:${panelX}px;top:${panelY}px;">
            <div class="header">
              <span class="logo">${sparkleSVG}</span>
              <div class="title"><b>Nuro</b><small>${escapeHtml(a?.title || "No subject")}</small></div>
              <button class="x" data-act="close">${closeSVG}</button>
            </div>
            <div class="section">
              <div class="lbl">Active subject</div>
              <select class="select" data-act="subject">
                ${state.subjects.length === 0 ? `<option value="">— No subjects —</option>` : ""}
                ${state.subjects.map((s) => `<option value="${s.subject_id}" ${s.subject_id === state.activeSubjectId ? "selected" : ""}>${escapeHtml(s.title)}</option>`).join("")}
              </select>
            </div>
            <div class="section">
              <div class="row">
                <div>
                  <b>⚡ Focus Mode</b>
                  <small>${state.focusMode ? "Active · nudges on distracting sites" : "Off"}</small>
                </div>
                <button class="toggle ${state.focusMode ? "on" : "off"}" data-act="focus"><span class="knob"></span></button>
              </div>
            </div>
            <div class="chat" id="chat">
              ${state.messages.length === 0 ? `<div class="msg"><div class="bubble-msg ai">Hi! Ask me anything about <b>${escapeHtml(a?.title || "your subject")}</b>. Grounded in your materials.</div></div>` : ""}
              ${state.messages.map((m) => `<div class="msg ${m.role}"><div class="bubble-msg ${m.role}">${escapeHtml(m.content) || (state.busy ? "…" : "")}</div></div>`).join("")}
            </div>
            <div class="composer">
              <input data-act="input" placeholder="Ask about ${escapeHtml(a?.title || "this")}…" ${state.busy ? "disabled" : ""} />
              <button data-act="send" ${state.busy || !state.activeSubjectId ? "disabled" : ""}>${sendSVG}</button>
            </div>
          </div>`;
      }
    }

    container.innerHTML = `
      <button class="bubble" style="left:${state.pos.x}px;top:${state.pos.y}px;" data-act="bubble" aria-label="Nuro">
        ${sparkleSVG}
        <span class="status ${state.focusMode ? "" : "off"}"></span>
      </button>
      ${panelHtml}
    `;
    bind();
  }

  // ------- Event bindings -------
  function bind() {
    // Bubble drag
    const bubble = container.querySelector('.bubble');
    if (bubble) {
      let down = false, moved = false, offX = 0, offY = 0;
      const startDrag = (cx, cy) => { down = true; moved = false; offX = cx - state.pos.x; offY = cy - state.pos.y; bubble.classList.add("dragging"); };
      const doMove = (cx, cy) => {
        if (!down) return;
        const dx = Math.abs(cx - offX - state.pos.x);
        const dy = Math.abs(cy - offY - state.pos.y);
        if (dx > 3 || dy > 3) moved = true;
        const x = Math.max(8, Math.min(window.innerWidth - 52, cx - offX));
        const y = Math.max(8, Math.min(window.innerHeight - 52, cy - offY));
        state.pos = { x, y };
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        const panel = container.querySelector('.panel');
        if (panel) {
          const px = x + 44 > window.innerWidth - 380 ? Math.max(8, x - 380) : x + 52;
          const py = Math.max(8, Math.min(y, window.innerHeight - 560));
          panel.style.left = `${px}px`;
          panel.style.top = `${py}px`;
        }
      };
      const endDrag = async () => {
        if (!down) return;
        down = false;
        bubble.classList.remove("dragging");
        await STORAGE.set({ [POS_KEY]: state.pos });
        if (!moved) {
          state.panelOpen = !state.panelOpen;
          if (state.panelOpen && state.subjects.length === 0 && state.backendUrl && state.token) {
            await fetchSubjects();
          }
          render();
        }
      };
      bubble.addEventListener("mousedown", (e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); });
      bubble.addEventListener("touchstart", (e) => { startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
      window.addEventListener("mousemove", (e) => doMove(e.clientX, e.clientY));
      window.addEventListener("touchmove", (e) => { if (e.touches[0]) doMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
      window.addEventListener("mouseup", endDrag);
      window.addEventListener("touchend", endDrag);
    }

    container.querySelectorAll("[data-act]").forEach((el) => {
      const act = el.dataset.act;
      if (act === "close") el.onclick = () => { state.panelOpen = false; render(); };
      if (act === "connect") el.onclick = async () => {
        const url = container.querySelector("#be-url").value.trim().replace(/\/$/, "");
        const tok = container.querySelector("#be-tok").value.trim();
        if (!url || !tok) return;
        state.backendUrl = url; state.token = tok;
        await STORAGE.set({ backendUrl: url, token: tok });
        await fetchSubjects();
        render();
      };
      if (act === "subject") el.onchange = async (e) => {
        state.activeSubjectId = e.target.value;
        state.messages = []; state.sessionId = null;
        await STORAGE.set({ activeSubjectId: state.activeSubjectId });
        render();
      };
      if (act === "focus") el.onclick = async () => {
        state.focusMode = !state.focusMode;
        await STORAGE.set({ focusMode: state.focusMode });
        render();
      };
      if (act === "send") el.onclick = sendMsg;
      if (act === "input") {
        el.onkeydown = (e) => { if (e.key === "Enter") sendMsg(); };
        el.focus();
      }
    });
  }

  async function sendMsg() {
    const input = container.querySelector('[data-act="input"]');
    if (!input) return;
    const text = input.value.trim();
    if (!text || state.busy || !state.activeSubjectId) return;
    state.messages.push({ role: "user", content: text });
    state.messages.push({ role: "ai", content: "" });
    state.busy = true;
    render();

    // Auto-save long messages as material in parallel
    if (text.length >= 250) {
      const title = text.split(/[.\n!?]/, 1)[0].slice(0, 60) || `Notes ${new Date().toLocaleString()}`;
      fetch(`${state.backendUrl}/api/subjects/${state.activeSubjectId}/materials/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ title, content: text }),
      }).then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          state.messages.push({
            role: "ai",
            content: `📌 Auto-saved to materials as "${title}" (${data.chunks} chunks).`,
          });
          render();
        }
      }).catch(() => {});
    }

    let acc = "";
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
        const evts = buf.split("\n\n");
        buf = evts.pop();
        for (const ev of evts) {
          let t = "", d = "";
          for (const l of ev.split("\n")) {
            if (l.startsWith("event:")) t = l.slice(6).trim();
            else if (l.startsWith("data:")) d += l.slice(5).trim();
          }
          if (!d) continue;
          try {
            const data = JSON.parse(d);
            if (t === "delta") {
              acc += data.t;
              state.messages[lastIdx].content = acc;
              render();
              const c = container.querySelector("#chat");
              if (c) c.scrollTop = c.scrollHeight;
            } else if (t === "session") {
              state.sessionId = data.session_id;
            }
          } catch {}
        }
      }
    } catch (e) {
      state.messages[state.messages.length - 1].content = "⚠ " + e.message;
    } finally {
      state.busy = false;
      render();
    }
  }

  // React to storage changes (e.g. token updated elsewhere)
  chrome.storage?.onChanged?.addListener?.((changes, area) => {
    if (area !== "local") return;
    let changed = false;
    if (changes.backendUrl) { state.backendUrl = changes.backendUrl.newValue || ""; changed = true; }
    if (changes.token) { state.token = changes.token.newValue || ""; changed = true; }
    if (changes.focusMode) { state.focusMode = changes.focusMode.newValue !== false; changed = true; }
    if (changes.activeSubjectId) { state.activeSubjectId = changes.activeSubjectId.newValue || null; changed = true; }
    if (changed) render();
  });

  (async () => {
    await loadCfg();
    if (state.backendUrl && state.token) await fetchSubjects();
    render();
  })();
})();
