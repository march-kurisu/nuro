import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api, { API } from "@/lib/api";
import { Send, Sparkles, Bot, User as UserIcon, FileText, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ChatTab({ subjectId, subjectTitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [visualizing, setVisualizing] = useState(null); // msg_id being visualized
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/subjects/${subjectId}/chat/history`);
      setMessages(data);
      const lastSession = data.length ? data[data.length - 1].session_id : null;
      if (lastSession) setSessionId(lastSession);
    })();
  }, [subjectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (e) => {
    e?.preventDefault();
    if (!input.trim() || streaming) return;
    const userMsg = { role: "user", content: input, msg_id: `tmp_${Date.now()}` };
    setMessages((m) => [...m, userMsg]);
    const text = input;
    setInput("");
    setStreaming(true);

    let assistantBuffer = "";
    const assistantId = `tmp_a_${Date.now()}`;
    setMessages((m) => [...m, { role: "assistant", content: "", msg_id: assistantId }]);

    try {
      const token = localStorage.getItem("lle_token");
      const resp = await fetch(`${API}/subjects/${subjectId}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop();
        for (const evt of events) {
          const lines = evt.split("\n");
          let type = "message";
          let dataStr = "";
          for (const l of lines) {
            if (l.startsWith("event:")) type = l.slice(6).trim();
            else if (l.startsWith("data:")) dataStr += l.slice(5).trim();
          }
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (type === "delta") {
              assistantBuffer += data.t;
              setMessages((m) =>
                m.map((mm) => (mm.msg_id === assistantId ? { ...mm, content: assistantBuffer } : mm))
              );
            } else if (type === "sources") {
              setMessages((m) =>
                m.map((mm) => (mm.msg_id === assistantId ? { ...mm, sources: data } : mm))
              );
            } else if (type === "session") {
              setSessionId(data.session_id);
            } else if (type === "error") {
              assistantBuffer += `\n\n_${data.message}_`;
              setMessages((m) =>
                m.map((mm) => (mm.msg_id === assistantId ? { ...mm, content: assistantBuffer } : mm))
              );
            }
          } catch { /* ignore parse */ }
        }
      }
    } catch {
      setMessages((m) =>
        m.map((mm) => (mm.msg_id === assistantId ? { ...mm, content: "Sorry, something went wrong." } : mm))
      );
    } finally {
      setStreaming(false);
    }
  };

  const visualize = async (msg) => {
    setVisualizing(msg.msg_id);
    try {
      const { data } = await api.post("/visualize", {
        prompt: msg.content.slice(0, 1200),
        subject: subjectTitle || "",
      });
      const imgData = `data:${data.mime_type || "image/png"};base64,${data.image_b64}`;
      setMessages((ms) =>
        ms.map((m) => (m.msg_id === msg.msg_id ? { ...m, image: imgData, image_caption: data.caption } : m))
      );
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Visual generation failed");
    } finally {
      setVisualizing(null);
    }
  };

  return (
    <div className="card overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[600px]">
      <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-900 text-white shrink-0">
        <span className="icon-square"><Sparkles size={18} strokeWidth={2.4} /></span>
        <div>
          <h3 className="font-display text-xl font-bold">Study chat</h3>
          <p className="text-xs text-white/70">Grounded in your uploaded materials · Click "Visualize" for diagrams</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-app min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="icon-square mx-auto mb-3"><Bot size={20} /></div>
            <p className="font-display text-xl font-bold text-slate-900">Ask anything</p>
            <p className="text-slate-500 mt-1 text-sm">Try &quot;Summarize chapter 1&quot; or &quot;Quiz me on key terms&quot;.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.msg_id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="icon-square shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
                <Bot size={16} strokeWidth={2.4} />
              </div>
            )}
            <div className={`max-w-[75%] px-4 py-3 ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
              <div className="prose-chat">
                {m.role === "assistant" ? (
                  m.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : (
                    <span className="text-slate-400">{streaming ? "…" : ""}</span>
                  )
                ) : (
                  <p>{m.content}</p>
                )}
              </div>

              {/* Inline generated image */}
              {m.image && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-white">
                  <img src={m.image} alt="Generated visual" className="w-full block" data-testid={`chat-image-${m.msg_id}`} />
                  {m.image_caption && <div className="px-3 py-2 text-xs text-slate-500 italic">{m.image_caption}</div>}
                </div>
              )}

              {/* Sources + visualize action */}
              {m.role === "assistant" && m.content && (
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex flex-wrap gap-1">
                    {(m.sources || []).map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                        <FileText size={10} /> {s.title} #{(s.ord || 0) + 1}
                      </span>
                    ))}
                  </div>
                  {!m.image && (
                    <button
                      data-testid={`chat-visualize-${m.msg_id}`}
                      onClick={() => visualize(m)}
                      disabled={visualizing === m.msg_id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold hover:-translate-y-0.5 transition-transform disabled:opacity-60"
                    >
                      {visualizing === m.msg_id ? (
                        <><Loader2 size={11} className="animate-spin" /> Generating image…</>
                      ) : (
                        <><ImageIcon size={11} /> Visualize</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <div className="w-9 h-9 shrink-0 rounded-full bg-slate-900 flex items-center justify-center">
                <UserIcon size={16} className="text-white" />
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-slate-100 p-4 flex gap-2 bg-white shrink-0">
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your AI study coach…"
          disabled={streaming}
          className="input"
        />
        <button
          data-testid="chat-send-btn"
          type="submit"
          disabled={streaming || !input.trim()}
          className="btn-dark disabled:opacity-40"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}
