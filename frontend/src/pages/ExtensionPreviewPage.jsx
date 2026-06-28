import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { Sparkles, Bot, ShieldAlert, MessageCircle, Download, Send, BookOpen, ToggleRight } from "lucide-react";

export default function ExtensionPreviewPage() {
  const [subjects, setSubjects] = useState([]);
  const [active, setActive] = useState(null);
  const [focus, setFocus] = useState(true);
  const [chat, setChat] = useState([
    { role: "ai", text: "Hi! I'm tied to your current subject. Ask me anything 👋" }
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
      setChat((c) => [...c, { role: "ai", text: `(Preview) In the real extension, I'd answer "${text}" grounded in ${active?.title || "your subject"}.` }]);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#2E7CF7] pb-16">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 mt-8 grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        <section className="space-y-5">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="blob-lime" style={{ width: 220, height: 220, bottom: -70, right: -70, opacity: 0.5 }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-widest">
                Chrome Extension
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mt-3">Stay in flow without leaving your tab.</h1>
              <p className="text-slate-600 mt-3 max-w-2xl">
                The Nuro extension lives in your browser. Pick the active subject, ask grounded questions, and let Focus Mode nudge you back when you drift to social media.
              </p>
              <div className="mt-5 grid sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#FFEDD5]">
                  <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldAlert size={18} /> Focus Mode</div>
                  <p className="text-sm text-slate-700 mt-1">Detects when you visit a distracting site during your study session and gently nudges back.</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#D1FAE5]">
                  <div className="flex items-center gap-2 font-bold text-slate-900"><Bot size={18} /> Mini RAG chat</div>
                  <p className="text-sm text-slate-700 mt-1">Tied to your active subject. Quick answers grounded in your uploaded materials.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl">
            <h3 className="font-display text-2xl font-bold">Install the extension</h3>
            <p className="text-white/70 mt-2 text-sm">For the hackathon demo, the extension source is bundled in your app folder.</p>
            <ol className="mt-4 space-y-2 text-sm text-white/90">
              <li><span className="font-bold text-[#C5E92E]">1.</span> Download or copy the <code className="bg-white/10 px-2 py-0.5 rounded">/app/chrome-extension</code> folder.</li>
              <li><span className="font-bold text-[#C5E92E]">2.</span> Open <code className="bg-white/10 px-2 py-0.5 rounded">chrome://extensions</code> → toggle Developer Mode.</li>
              <li><span className="font-bold text-[#C5E92E]">3.</span> Click "Load unpacked" and select the folder.</li>
              <li><span className="font-bold text-[#C5E92E]">4.</span> Click the Nuro icon, sign in with your token, and pick an active subject.</li>
            </ol>
            <a
              href={`${process.env.REACT_APP_BACKEND_URL}/api/`}
              className="mt-5 px-5 py-3 rounded-full bg-[#C5E92E] text-slate-900 font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
              target="_blank"
              rel="noreferrer"
              data-testid="extension-backend-link"
            >
              <Download size={16} /> Get backend URL
            </a>
          </div>
        </section>

        {/* Mock extension popup */}
        <aside className="lg:sticky lg:top-28">
          <div className="mx-auto w-[380px] h-[600px] bg-white rounded-[2rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
            {/* header */}
            <div className="bg-slate-900 text-white p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#C5E92E] flex items-center justify-center">
                <Sparkles size={18} className="text-slate-900" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold leading-none">Nuro</div>
                <div className="text-xs text-white/60 mt-0.5 truncate">{active?.title || "No subject"}</div>
              </div>
              <div className="dot-pulse" />
            </div>

            {/* subject picker */}
            <div className="p-3 border-b bg-slate-50">
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

            {/* focus mode toggle */}
            <div className="px-4 py-3 flex items-center justify-between border-b">
              <div>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2"><ShieldAlert size={14} /> Focus Mode</div>
                <div className="text-xs text-slate-500">{focus ? "Active · nudging on distractions" : "Off"}</div>
              </div>
              <button
                data-testid="ext-focus-toggle"
                onClick={() => setFocus((f) => !f)}
                className={`relative w-12 h-7 rounded-full transition ${focus ? "bg-[#C5E92E]" : "bg-slate-300"}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition ${focus ? "left-6" : "left-1"}`} />
              </button>
            </div>

            {/* chat */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 text-xs leading-snug ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* input */}
            <div className="p-3 border-t flex gap-2">
              <input
                data-testid="ext-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask about this subject…"
                className="flex-1 px-3 py-2 rounded-full bg-slate-100 text-sm focus:bg-white border-2 border-transparent focus:border-[#1D4ED8] outline-none"
              />
              <button
                data-testid="ext-chat-send"
                onClick={send}
                className="px-3 py-2 rounded-full bg-[#1D4ED8] text-white"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
          <p className="text-center text-white/70 text-xs mt-3">Live mockup · the real extension lives in <code>/app/chrome-extension</code></p>
        </aside>
      </main>
    </div>
  );
}
