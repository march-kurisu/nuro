import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, ShieldAlert, MessageCircle } from "lucide-react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY = "nuro_bubble_pos";

export default function FloatingBubble() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) return saved;
    } catch {}
    return { x: typeof window !== "undefined" ? window.innerWidth - 80 : 1000, y: typeof window !== "undefined" ? window.innerHeight - 120 : 600 };
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ down: false, moved: false, offX: 0, offY: 0 });

  const [subjects, setSubjects] = useState([]);
  const [active, setActive] = useState(null);
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem("nuro_focus") !== "off");
  const [messages, setMessages] = useState([{ role: "ai", content: "Hi! Quick chat tied to your active subject. Ask me anything." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get("/subjects").then((r) => {
      setSubjects(r.data || []);
      const savedId = localStorage.getItem("nuro_active_subject");
      const found = (r.data || []).find((s) => s.subject_id === savedId);
      setActive(found || r.data?.[0] || null);
    }).catch(() => {});
  }, [user]);

  // Drag handlers
  const onDown = (clientX, clientY) => {
    dragRef.current = { down: true, moved: false, offX: clientX - pos.x, offY: clientY - pos.y };
    setDragging(true);
  };
  const onMove = (clientX, clientY) => {
    if (!dragRef.current.down) return;
    const dx = Math.abs(clientX - dragRef.current.offX - pos.x);
    const dy = Math.abs(clientY - dragRef.current.offY - pos.y);
    if (dx > 3 || dy > 3) dragRef.current.moved = true;
    const size = 56;
    const x = Math.max(8, Math.min(window.innerWidth - size - 8, clientX - dragRef.current.offX));
    const y = Math.max(8, Math.min(window.innerHeight - size - 8, clientY - dragRef.current.offY));
    setPos({ x, y });
  };
  const onUp = () => {
    if (dragRef.current.down) {
      dragRef.current.down = false;
      setDragging(false);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      if (!dragRef.current.moved) setOpen((o) => !o);
    }
  };

  useEffect(() => {
    const mm = (e) => onMove(e.clientX, e.clientY);
    const mu = () => onUp();
    const tm = (e) => onMove(e.touches[0].clientX, e.touches[0].clientY);
    const te = () => onUp();
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    window.addEventListener("touchmove", tm, { passive: true });
    window.addEventListener("touchend", te);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", te);
    };
    // eslint-disable-next-line
  }, [pos]);

  const toggleFocus = () => {
    const next = !focusMode;
    setFocusMode(next);
    localStorage.setItem("nuro_focus", next ? "on" : "off");
  };

  const send = async (e) => {
    e?.preventDefault();
    if (!input.trim() || !active || busy) return;
    const text = input.trim();
    setMessages((m) => [...m, { role: "user", content: text }, { role: "ai", content: "" }]);
    setInput("");
    setBusy(true);
    let acc = "";
    try {
      const token = localStorage.getItem("lle_token");
      const resp = await fetch(`${API}/subjects/${active.subject_id}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const evts = buf.split("\n\n"); buf = evts.pop();
        for (const ev of evts) {
          let t = "", d = "";
          for (const l of ev.split("\n")) {
            if (l.startsWith("event:")) t = l.slice(6).trim();
            else if (l.startsWith("data:")) d += l.slice(5).trim();
          }
          if (!d || t !== "delta") continue;
          try { acc += JSON.parse(d).t; setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "ai", content: acc }; return c; }); } catch {}
        }
      }
    } catch {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "ai", content: "Connection error." }; return c; });
    } finally { setBusy(false); }
  };

  if (!user) return null;

  return (
    <>
      {/* Bubble */}
      <button
        data-testid="floating-bubble"
        onMouseDown={(e) => { e.preventDefault(); onDown(e.clientX, e.clientY); }}
        onTouchStart={(e) => { onDown(e.touches[0].clientX, e.touches[0].clientY); }}
        style={{
          position: "fixed", top: pos.y, left: pos.x, width: 56, height: 56,
          borderRadius: "50%", background: "#E4F222", color: "#0F172A",
          boxShadow: "0 10px 30px -8px rgba(0,0,0,0.35), 0 0 0 4px rgba(228,242,34,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: dragging ? "grabbing" : "grab",
          zIndex: 9998, border: "none", touchAction: "none",
          transition: dragging ? "none" : "transform 0.15s",
          transform: dragging ? "scale(1.08)" : "scale(1)",
        }}
        aria-label="Nuro"
      >
        <Sparkles size={24} strokeWidth={2.6} />
        {focusMode && (
          <span style={{
            position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "50%",
            background: "#16A34A", border: "2px solid white",
          }} />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          data-testid="floating-panel"
          style={{
            position: "fixed",
            top: Math.min(pos.y, window.innerHeight - 540),
            left: pos.x + 56 > window.innerWidth - 380 ? Math.max(8, pos.x - 380) : pos.x + 64,
            width: 360, height: 520, zIndex: 9999,
          }}
          className="bg-white rounded-[1.5rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden fade-up"
        >
          <div className="p-3 bg-slate-900 text-white flex items-center gap-2">
            <span className="icon-square" style={{ width: 32, height: 32, borderRadius: 8 }}><Sparkles size={16} strokeWidth={2.4} /></span>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold leading-none text-sm">Nuro</div>
              <div className="text-[10px] text-white/60 truncate">{active?.title || "No subject"}</div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-white/10" data-testid="bubble-close">
              <X size={14} />
            </button>
          </div>

          <div className="p-3 border-b bg-slate-50">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active subject</label>
            <select
              value={active?.subject_id || ""}
              onChange={(e) => {
                const sub = subjects.find((s) => s.subject_id === e.target.value) || null;
                setActive(sub);
                if (sub) localStorage.setItem("nuro_active_subject", sub.subject_id);
              }}
              className="mt-1 w-full px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-900"
              data-testid="bubble-subject"
            >
              <option value="">— Pick —</option>
              {subjects.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.title}</option>)}
            </select>
          </div>

          <div className="px-3 py-2 flex items-center justify-between border-b">
            <div className="flex items-center gap-2 text-xs">
              <ShieldAlert size={14} className="text-slate-600" />
              <span className="font-bold text-slate-900">Focus Mode</span>
            </div>
            <button
              onClick={toggleFocus}
              data-testid="bubble-focus"
              className={`relative w-10 h-6 rounded-full transition ${focusMode ? "bg-[#E4F222]" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${focusMode ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] px-3 py-1.5 text-xs leading-snug ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                  {m.content || (busy ? "…" : "")}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1">
              <MessageCircle size={10} /> Tied to your subject's materials
            </div>
          </div>

          <form onSubmit={send} className="p-2 border-t flex gap-1 bg-white">
            <input
              data-testid="bubble-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={active ? `Ask about ${active.title.slice(0, 20)}…` : "Pick a subject first"}
              disabled={!active || busy}
              className="flex-1 px-3 py-1.5 rounded-full bg-slate-100 text-xs focus:bg-white border-2 border-transparent focus:border-slate-900 outline-none disabled:opacity-50"
            />
            <button type="submit" disabled={!input.trim() || busy} className="px-2.5 py-1.5 rounded-full bg-slate-900 text-white disabled:opacity-40" data-testid="bubble-send">
              <Send size={12} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
