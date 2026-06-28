import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BookOpen, Sparkles, Target, Flame, ArrowRight, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, subs] = await Promise.all([
        api.get("/dashboard/summary"),
        api.get("/subjects"),
      ]);
      setSummary(s.data);
      setSubjects(subs.data);
    })();
  }, []);

  const Stat = ({ icon: Icon, label, value, bg, suffix }) => (
    <div className="bg-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-20" style={{ background: bg }} />
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: bg }}>
        <Icon size={22} className="text-slate-900" />
      </div>
      <div className="font-display text-4xl font-bold text-slate-900">{value}{suffix}</div>
      <div className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#2E7CF7] pb-16">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
        {/* Hero greet */}
        <section className="bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden fade-up">
          <div className="blob-lime" style={{ width: 240, height: 240, top: -60, right: -60, opacity: 0.5 }} />
          <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Good to see you</p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mt-1">
                Hey {user?.name?.split(" ")[0] || "learner"} 👋
              </h1>
              <p className="text-slate-600 text-lg mt-3 max-w-xl">
                {summary && summary.subjects_count === 0
                  ? "Let's set up your first subject and start your AI-coached study session."
                  : "Pick up where you left off, or start a new subject."}
              </p>
              <div className="flex flex-wrap gap-3 mt-5">
                <Link
                  to="/subjects"
                  data-testid="dash-go-subjects"
                  className="px-5 py-3 rounded-full bg-[#1D4ED8] text-white font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
                >
                  Open workspace <ArrowRight size={18} />
                </Link>
                <Link
                  to="/subjects?new=1"
                  data-testid="dash-new-subject"
                  className="px-5 py-3 rounded-full bg-[#C5E92E] text-slate-900 font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
                >
                  + New subject
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#C5E92E] to-[#1D4ED8] flex items-center justify-center shadow-xl float-anim">
                <Sparkles size={80} className="text-white" />
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        {summary && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-5 fade-up">
            <Stat icon={BookOpen} label="Subjects" value={summary.subjects_count} bg="#FFEDD5" />
            <Stat icon={Target} label="Quizzes taken" value={summary.quizzes_taken} bg="#D1FAE5" />
            <Stat icon={TrendingUp} label="Accuracy" value={summary.quiz_accuracy} suffix="%" bg="#E0E7FF" />
            <Stat icon={Flame} label="Streak (14d)" value={summary.streak_days} suffix="d" bg="#FEE2E2" />
          </section>
        )}

        {/* Heatmap + Subjects */}
        <section className="grid lg:grid-cols-[1fr_1fr] gap-5">
          {summary && (
            <div className="bg-white rounded-[2rem] p-7 shadow-xl">
              <h2 className="font-display text-2xl font-bold text-slate-900">14-day study heatmap</h2>
              <p className="text-slate-500 text-sm">Days you quizzed, chatted, or reviewed.</p>
              <div className="mt-5 grid grid-cols-7 gap-2 max-w-md">
                {summary.heatmap.map((d) => (
                  <div
                    key={d.date}
                    title={d.date}
                    className={`heat ${d.active ? "active" : ""}`}
                    style={{ background: d.active ? "#C5E92E" : "#E2E8F0" }}
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-2"><span className="heat" style={{ width: 14, height: 14, background: "#E2E8F0" }} /> Rest</span>
                <span className="flex items-center gap-2"><span className="heat active" style={{ width: 14, height: 14 }} /> Active</span>
              </div>
              <div className="mt-6 p-4 rounded-2xl bg-slate-900 text-white">
                <div className="text-xs uppercase tracking-widest text-white/70 font-bold">Overall mastery</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-display text-4xl font-bold">{summary.overall_mastery}%</span>
                  <span className="text-white/60 text-sm">across all topics</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-[#C5E92E]" style={{ width: `${summary.overall_mastery}%` }} />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-[2rem] p-7 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-slate-900">Your subjects</h2>
              <Link to="/subjects" data-testid="dash-all-subjects" className="text-sm font-bold text-[#1D4ED8] hover:underline">All →</Link>
            </div>
            <div className="mt-5 space-y-3">
              {subjects.length === 0 && (
                <div className="text-center py-8 text-slate-500">No subjects yet. Create your first one!</div>
              )}
              {subjects.slice(0, 5).map((s) => (
                <Link
                  key={s.subject_id}
                  to={`/subjects/${s.subject_id}`}
                  data-testid={`dash-subject-${s.subject_id}`}
                  className="block p-4 rounded-2xl border-2 border-slate-100 hover:border-[#C5E92E] hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{s.title}</div>
                      <div className="text-xs text-slate-500">{s.material_count} materials · {s.mastery_avg}% mastery</div>
                    </div>
                    <div className="w-14 h-2 rounded-full bg-slate-100 overflow-hidden shrink-0">
                      <div className="h-full bg-[#1D4ED8]" style={{ width: `${s.mastery_avg}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Extension banner */}
        <section className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="blob-lime" style={{ width: 200, height: 200, bottom: -60, right: -60, opacity: 0.6 }} />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-block px-3 py-1 rounded-full bg-[#C5E92E] text-slate-900 text-xs font-bold uppercase tracking-widest">Chrome Extension</div>
              <h3 className="font-display text-3xl font-bold mt-3">Stay on-task with Focus Mode</h3>
              <p className="text-white/75 mt-2">Install the Nuro extension to get contextual nudges when you drift, plus a mini RAG chat for any subject — without leaving your tab.</p>
            </div>
            <Link
              to="/extension-preview"
              data-testid="extension-preview-link"
              className="px-5 py-3 rounded-full bg-[#C5E92E] text-slate-900 font-bold hover:-translate-y-0.5 transition-transform"
            >
              Preview extension
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
