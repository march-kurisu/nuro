import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { Sparkles, Bot, ShieldAlert, Send, Download, Chrome } from "lucide-react";

export default function ExtensionPreviewPage() {
  const [subjects, setSubjects] = useState([]);
  const [active, setActive] = useState(null);
  const [focus, setFocus] = useState(true);
  const [chat, setChat] = useState([
    { role: "ai", text: "Hi! I'm tied to your current subject. Ask me anything." }
  ]);
  const [input, setInput] = useState("");

  useEffect(() => {
    api.get("/subjects").then((r) => {
      setSubjects(r.data);
      if (r.data[0]) setActive(r.data[0]);
    });
  }, []);

  const send = () => {
    if (!input.trim()) return;
    setChat((c) => [...c, { role: "user", text: input }]);
    const text = input;
    setInput("");
    setTimeout(() => {
      setChat((c) => [...c, { role: "ai", text: `(Preview) In the real extension I'd answer "${text}" grounded in ${active?.title || "your subject"}.` }]);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-app pb-16">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 mt-8 grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        <section className="space-y-5">
          <div className="bg-hero rounded-[2rem] border border-slate-200/60 p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-widest">
              <Chrome size={12} /> Chrome Extension
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mt-4 leading-tight">
              Stay in flow without leaving your <span className="hl">tab</span>.
            </h1>
            <p className="text-slate-600 mt-3 max-w-2xl">
              Nuro lives in your browser. Pick the active subject, ask grounded questions, and let Focus Mode nudge you back when you drift to social media.
            </p>
            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldAlert size={18} /> Focus Mode</div>
                <p className="text-sm text-slate-600 mt-1">Detects distracting sites during your study window and nudges back.</p>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900"><Bot size={18} /> Mini RAG chat</div>
                <p className="text-sm text-slate-600 mt-1">Quick answers grounded in your uploaded materials.</p>
              </div>
            </div>
          </div>

          <div className="card-dark p-8">
            <h3 className="font-display text-2xl font-bold">Install the extension</h3>
            <p className="text-white/70 mt-2 text-sm">Download the .zip, unzip it, then load it as an unpacked extension in Chrome.</p>
            <ol className="mt-4 space-y-2 text-sm text-white/90">
              <li><span className="font-bold text-[#E4F222]">1.</span> Click <b>Download .zip</b> below and unzip it on your computer.</li>
              <li><span className="font-bold text-[#E4F222]">2.</span> Open <code className="bg-white/10 px-2 py-0.5 rounded">chrome://extensions</code> → toggle <b>Developer Mode</b> (top-right).</li>
              <li><span className="font-bold text-[#E4F222]">3.</span> Click <b>Load unpacked</b> → select the <code className="bg-white/10 px-2 py-0.5 rounded">chrome-extension</code> folder.</li>
              <li><span className="font-bold text-[#E4F222]">4.</span> Click the Nuro icon → paste your backend URL & session token.</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`${process.env.REACT_APP_BACKEND_URL}/api/extension/download`}
                className="btn-yellow"
                data-testid="extension-download-zip"
                download
              >
                <Download size={14} /> Download .zip
              </a>
              <button
                data-testid="extension-copy-token"
                onClick={async () => {
                  const token = localStorage.getItem("lle_token") || "";
                  try {
                    await navigator.clipboard.writeText(token);
                    alert("Token copied! Paste it in the extension setup.");
                  } catch {
                    prompt("Copy this token:", token);
                  }
                }}
                className="btn-ghost"
                style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}
              >
                Copy my token
              </button>
              <button
                data-testid="extension-copy-url"
                onClick={async () => {
                  const url = process.env.REACT_APP_BACKEND_URL;
                  try {
                    await navigator.clipboard.writeText(url);
                    alert("Backend URL copied!");
                  } catch {
                    prompt("Copy this URL:", url);
                  }
                }}
                className="btn-ghost"
                style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}
              >
                Copy backend URL
              </button>
            </div>
          </div>
        </section>

        {/* Mock extension popup */}
        <aside className="lg:sticky lg:top-28">
          <div className="mx-auto w-[380px] h-[600px] bg-white rounded-[2rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center gap-3">
              <span className="icon-square" style={{ width: 36, height: 36, borderRadius: 10 }}>
                <Sparkles size={18} strokeWidth={2.4} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold leading-none">Nuro</div>
                <div className="text-xs text-white/60 mt-0.5 truncate">{active?.title || "No subject"}</div>
              </div>
              <div className="dot-pulse" />
            </div>

            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active subject</label>
              <select
                data-testid="ext-subject-select"
                value={active?.subject_id || ""}
                onChange={(e) => setActive(subjects.find((s) => s.subject_id === e.target.value) || null)}
                className="mt-1 w-full px-3 py-2 rounded-full bg-white border-2 border-slate-200 text-sm font-bold text-slate-900"
              >
                <option value="">— Pick subject —</option>
                {subjects.map((s) => (
                  <option key={s.subject_id} value={s.subject_id}>{s.title}</option>
                ))}
              </select>
            </div>

            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2"><ShieldAlert size={14} /> Focus Mode</div>
                <div className="text-xs text-slate-500">{focus ? "Active · nudging on distractions" : "Off"}</div>
              </div>
              <button
                data-testid="ext-focus-toggle"
                onClick={() => setFocus((f) => !f)}
                className={`relative w-12 h-7 rounded-full transition ${focus ? "bg-[#E4F222]" : "bg-slate-300"}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition ${focus ? "left-6" : "left-1"}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 text-xs leading-snug ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-100 flex gap-2 bg-white">
              <input
                data-testid="ext-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask about this subject…"
                className="flex-1 px-3 py-2 rounded-full bg-slate-100 text-sm focus:bg-white border-2 border-transparent focus:border-slate-900 outline-none"
              />
              <button data-testid="ext-chat-send" onClick={send} className="px-3 py-2 rounded-full bg-slate-900 text-white">
                <Send size={14} />
              </button>
            </div>
          </div>
          <p className="text-center text-slate-500 text-xs mt-3">Live mockup · the real extension lives in <code>/app/chrome-extension</code></p>
        </aside>
      </main>
    </div>
  );
}
