import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { Plus, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

const COLOR_BG = {
  mint: "#D1FAE5",
  peach: "#FFEDD5",
  sky: "#E0E7FF",
  lemon: "#FEF9C3",
  rose: "#FCE7F3",
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("mint");
  const [params] = useSearchParams();

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
      setTitle(""); setDesc(""); setColor("mint"); setCreating(false);
      toast.success("Subject created!");
      load();
    } catch (e) {
      toast.error("Could not create subject");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this subject and all its materials?")) return;
    await api.delete(`/subjects/${id}`);
    toast.success("Subject removed");
    load();
  };

  return (
    <div className="min-h-screen bg-[#2E7CF7] pb-16">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 mt-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-white/80 font-bold uppercase tracking-widest text-sm">Workspace</p>
            <h1 className="font-display text-5xl font-bold text-white">Subjects</h1>
          </div>
          <button
            data-testid="subjects-new-btn"
            onClick={() => setCreating(true)}
            className="px-5 py-3 rounded-full bg-[#C5E92E] text-slate-900 font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
          >
            <Plus size={18} /> New subject
          </button>
        </div>

        {creating && (
          <form
            onSubmit={create}
            className="bg-white rounded-[2rem] p-7 shadow-2xl mb-6 relative fade-up"
            data-testid="subjects-create-form"
          >
            <div className="paperclip" />
            <h3 className="font-display text-2xl font-bold text-slate-900 mb-4">Create new subject</h3>
            <div className="space-y-3">
              <input
                data-testid="subject-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Organic Chemistry"
                className="w-full px-5 py-3.5 rounded-full bg-slate-100 border-2 border-transparent focus:border-[#1D4ED8] focus:bg-white outline-none"
              />
              <textarea
                data-testid="subject-desc-input"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What do you want to master?"
                rows={2}
                className="w-full px-5 py-3 rounded-3xl bg-slate-100 border-2 border-transparent focus:border-[#1D4ED8] focus:bg-white outline-none resize-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Color:</span>
                {Object.entries(COLOR_BG).map(([c, hex]) => (
                  <button
                    key={c}
                    type="button"
                    data-testid={`subject-color-${c}`}
                    onClick={() => setColor(c)}
                    className={`w-9 h-9 rounded-full border-2 transition ${color === c ? "border-slate-900 scale-110" : "border-transparent"}`}
                    style={{ background: hex }}
                  />
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  data-testid="subject-create-submit"
                  className="px-6 py-3 rounded-full bg-[#C5E92E] text-slate-900 font-bold hover:-translate-y-0.5 transition-transform"
                >Create</button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-6 py-3 rounded-full bg-slate-100 text-slate-700 font-bold"
                >Cancel</button>
              </div>
            </div>
          </form>
        )}

        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {subjects.length === 0 && !creating && (
            <div className="col-span-full bg-white rounded-[2rem] p-12 text-center shadow-xl">
              <div className="w-20 h-20 rounded-full bg-[#FFEDD5] flex items-center justify-center mx-auto mb-4">
                <BookOpen size={36} className="text-orange-600" />
              </div>
              <h3 className="font-display text-2xl font-bold text-slate-900">No subjects yet</h3>
              <p className="text-slate-500 mt-1">Create your first subject to start building your learning ecosystem.</p>
              <button
                data-testid="subjects-empty-create"
                onClick={() => setCreating(true)}
                className="mt-5 px-6 py-3 rounded-full bg-[#1D4ED8] text-white font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
              ><Plus size={18} /> Create subject</button>
            </div>
          )}
          {subjects.map((s) => (
            <Link
              to={`/subjects/${s.subject_id}`}
              key={s.subject_id}
              data-testid={`subject-card-${s.subject_id}`}
              className="bg-white rounded-[2rem] p-6 shadow-xl relative hover:-translate-y-1 transition-transform block group"
            >
              <div className="paperclip" />
              <div
                className="absolute top-0 left-0 right-0 h-2 rounded-t-[2rem]"
                style={{ background: COLOR_BG[s.color] || COLOR_BG.mint }}
              />
              <div className="flex items-start gap-3 mt-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: COLOR_BG[s.color] || COLOR_BG.mint }}>
                  <BookOpen size={26} className="text-slate-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-bold text-slate-900 truncate">{s.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{s.description || "No description yet."}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                <div className="px-3 py-2 rounded-xl bg-slate-100">
                  <div className="text-slate-500">Materials</div>
                  <div className="font-bold text-slate-900 text-lg">{s.material_count}</div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-slate-100">
                  <div className="text-slate-500">Mastery</div>
                  <div className="font-bold text-slate-900 text-lg">{s.mastery_avg}%</div>
                </div>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(s.subject_id); }}
                data-testid={`subject-delete-${s.subject_id}`}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
