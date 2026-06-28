import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Upload, FileText, Trash2, Plus, Type } from "lucide-react";
import { toast } from "sonner";

export default function MaterialsTab({ subjectId }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showText, setShowText] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    const { data } = await api.get(`/subjects/${subjectId}/materials`);
    setItems(data);
  };
  useEffect(() => { load(); }, [subjectId]);

  const upload = async (file) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("lle_token");
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/subjects/${subjectId}/materials/upload`, {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Upload failed");
      toast.success(`Indexed ${data.chunks} chunks (${data.char_count.toLocaleString()} chars)`);
      load();
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submitText = async (e) => {
    e.preventDefault();
    if (!textTitle.trim() || !textContent.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/subjects/${subjectId}/materials/text`, {
        title: textTitle, content: textContent,
      });
      toast.success(`Indexed ${data.chunks} chunks`);
      setTextTitle(""); setTextContent(""); setShowText(false);
      load();
    } catch (e) {
      toast.error("Could not add material");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this material?")) return;
    await api.delete(`/materials/${id}`);
    toast.success("Removed");
    load();
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[2rem] p-6 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-900">Study materials</h3>
            <p className="text-slate-500 text-sm">Upload PDFs, text, or markdown. We index them so chat & quizzes stay grounded.</p>
          </div>
          <div className="flex gap-2">
            <button
              data-testid="materials-upload-btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="px-4 py-2.5 rounded-full bg-[#C5E92E] text-slate-900 font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform disabled:opacity-50"
            >
              <Upload size={16} /> Upload file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              data-testid="materials-file-input"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button
              data-testid="materials-paste-btn"
              onClick={() => setShowText((v) => !v)}
              className="px-4 py-2.5 rounded-full bg-slate-900 text-white font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
            >
              <Type size={16} /> Paste text
            </button>
          </div>
        </div>

        {showText && (
          <form onSubmit={submitText} className="mt-5 space-y-3 p-5 rounded-2xl bg-slate-50">
            <input
              data-testid="materials-text-title"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              placeholder="Material title (e.g., 'Chapter 3 notes')"
              className="w-full px-4 py-3 rounded-full bg-white border-2 border-slate-200 focus:border-[#1D4ED8] outline-none"
            />
            <textarea
              data-testid="materials-text-content"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste study notes here…"
              rows={8}
              className="w-full px-4 py-3 rounded-3xl bg-white border-2 border-slate-200 focus:border-[#1D4ED8] outline-none resize-y"
            />
            <button
              data-testid="materials-text-submit"
              type="submit"
              disabled={busy}
              className="px-5 py-3 rounded-full bg-[#1D4ED8] text-white font-bold inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} /> Add material
            </button>
          </form>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {items.length === 0 && (
          <div className="col-span-full bg-white rounded-[2rem] p-10 text-center shadow-xl">
            <div className="w-16 h-16 rounded-full bg-[#FFEDD5] flex items-center justify-center mx-auto mb-3">
              <FileText size={28} className="text-orange-600" />
            </div>
            <p className="font-display text-xl font-bold text-slate-900">No materials yet</p>
            <p className="text-slate-500 mt-1 text-sm">Upload your first PDF or paste notes to ground the AI.</p>
          </div>
        )}
        {items.map((m) => (
          <div key={m.material_id} className="bg-white rounded-2xl p-4 shadow-md flex items-start gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-[#E0E7FF] flex items-center justify-center shrink-0">
              <FileText size={22} className="text-[#1D4ED8]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 truncate">{m.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {m.chunk_count} chunks · {m.char_count.toLocaleString()} chars
              </div>
            </div>
            <button
              onClick={() => remove(m.material_id)}
              data-testid={`material-delete-${m.material_id}`}
              className="p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
