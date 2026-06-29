import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { Plus, BookOpen, Trash2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/Modal";

const COLOR_BG = {
  yellow: "#FEF3C7",
  mint: "#D1FAE5",
  peach: "#FFEDD5",
  sky: "#E0E7FF",
  rose: "#FCE7F3",
  violet: "#EDE9FE",
  teal: "#CCFBF1",
  lemon: "#ECFCCB",
  blush: "#FFE4E6",
  ocean: "#CFFAFE",
  lavender: "#F3E8FF",
  sand: "#F5F5DC",
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("yellow");
  const [params] = useSearchParams();
  const [confirmId, setConfirmId] = useState(null);

  const load = async () => {
    const { data } = await api.get("/subjects");
    setSubjects(data);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (params.get("new") === "1") setCreating(true); }, [params]);

  const create = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.post("/subjects", { title, description: desc, color });
      setTitle(""); setDesc(""); setColor("yellow"); setCreating(false);
      toast.success("Subject created!");
      load();
    } catch {
      toast.error("Could not create subject");
    }
  };

  const remove = async (id) => {
    await api.delete(`/subjects/${id}`);
    toast.success("Subject removed");
    load();
  };

  return (
    <div className="min-h-screen bg-app pb-16">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 mt-8">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Workspace</p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mt-1">Subjects</h1>
          </div>
          <button
            data-testid="subjects-new-btn"
            onClick={() => setCreating(true)}
            className="btn-yellow"
          >
            <Plus size={16} /> New subject
          </button>
        </div>

        {creating && (
          <form
            onSubmit={create}
            className="card p-7 mb-6 fade-up"
            data-testid="subjects-create-form"
          >
            <h3 className="font-display text-2xl font-bold text-slate-900 mb-4">Create new subject</h3>
            <div className="space-y-3">
              <input
                data-testid="subject-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Organic Chemistry"
                className="input"
              />
              <textarea
                data-testid="subject-desc-input"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What do you want to master?"
                rows={2}
                className="input"
                style={{ borderRadius: 20, resize: "none" }}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cover:</span>
                {Object.entries(COLOR_BG).map(([c, hex]) => (
                  <button
                    key={c}
                    type="button"
                    data-testid={`subject-color-${c}`}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition ${color === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                    style={{ background: hex }}
                  />
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" data-testid="subject-create-submit" className="btn-dark">Create</button>
                <button type="button" onClick={() => setCreating(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          </form>
        )}

        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {subjects.length === 0 && !creating && (
            <div className="col-span-full card p-12 text-center">
              <div className="icon-square mx-auto mb-4" style={{ width: 56, height: 56, borderRadius: 16 }}><BookOpen size={24} /></div>
              <h3 className="font-display text-2xl font-bold text-slate-900">No subjects yet</h3>
              <p className="text-slate-500 mt-1">Create your first subject to start building your learning ecosystem.</p>
              <button data-testid="subjects-empty-create" onClick={() => setCreating(true)} className="mt-5 btn-dark">
                <Plus size={16} /> Create subject
              </button>
            </div>
          )}
          {subjects.map((s) => (
            <Link
              to={`/subjects/${s.subject_id}`}
              key={s.subject_id}
              data-testid={`subject-card-${s.subject_id}`}
              className="card p-6 relative hover:-translate-y-1 transition-transform block group"
            >
              <div className="h-2 rounded-full mb-5 -mt-2" style={{ background: COLOR_BG[s.color] || COLOR_BG.yellow }} />
              <div className="flex items-start justify-between">
                <span className="icon-square"><BookOpen size={18} strokeWidth={2.4} /></span>
                <ArrowUpRight size={16} className="text-slate-300 group-hover:text-slate-900 transition" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 mt-4 truncate">{s.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mt-1 h-10">{s.description || "No description yet."}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Materials</div>
                  <div className="font-bold text-slate-900 text-lg">{s.material_count}</div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Mastery</div>
                  <div className="font-bold text-slate-900 text-lg">{s.mastery_avg}%</div>
                </div>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(s.subject_id); }}
                data-testid={`subject-delete-${s.subject_id}`}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </Link>
          ))}
        </section>

        <ConfirmModal
          open={!!confirmId}
          onClose={() => setConfirmId(null)}
          onConfirm={() => { if (confirmId) remove(confirmId); }}
          title="Delete this subject?"
          message="All materials, modules, curriculum, quizzes and chat history for this subject will be permanently removed."
          confirmLabel="Delete"
          danger
        />
      </main>
    </div>
  );
}
