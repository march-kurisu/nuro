import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BookOpen, Sparkles, Target, Flame, ArrowRight, TrendingUp, Chrome, ArrowUpRight } from "lucide-react";

function Stat({ icon: Icon, label, value, suffix, dark }) {
  return (
    <div className={`${dark ? "card-dark" : "card"} p-5 relative overflow-hidden`}>
      <div className="flex items-start justify-between">
        <span className={`icon-square ${dark ? "dark" : ""}`}>
          <Icon size={20} strokeWidth={2.4} />
        </span>
        <ArrowUpRight size={16} className={dark ? "text-white/40" : "text-slate-300"} />
      </div>
      <div className={`font-display text-4xl font-bold mt-4 ${dark ? "" : "text-slate-900"}`}>{value}{suffix}</div>
      <div className={`text-xs font-semibold mt-1 uppercase tracking-widest ${dark ? "text-white/60" : "text-slate-500"}`}>{label}</div>
    </div>
  );
}

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

  return (
    <div className="min-h-screen bg-app pb-16">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-6">
        {/* Hero greet card with hero gradient */}
        <section className="bg-hero rounded-[2rem] border border-slate-200/60 p-8 sm:p-10 fade-up relative overflow-hidden">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <span className="trust-pill">
                <span className="dot-pulse" /> {user?.email}
              </span>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mt-4 leading-tight">
                Hey {user?.name?.split(" ")[0] || "learner"} —<br />ready to <span className="hl">level up</span> today?
              </h1>
              <p className="text-slate-600 text-lg mt-3 max-w-xl">
                {summary && summary.subjects_count === 0
                  ? "Let's set up your first subject and start your AI-coached study session."
                  : "Pick up where you left off, or start a new subject."}
              </p>
              <div className="flex flex-wrap gap-3 mt-5">
                <Link to="/subjects" data-testid="dash-go-subjects" className="btn-dark">
                  Open workspace <ArrowRight size={16} />
                </Link>
                <Link to="/subjects?new=1" data-testid="dash-new-subject" className="btn-yellow">+ New subject</Link>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center w-40 h-40 rounded-full bg-white border border-slate-200 shadow-sm float-anim">
              <Sparkles size={56} className="text-[#E4F222]" strokeWidth={2.4} />
            </div>
          </div>
        </section>

        {/* Stats */}
        {summary && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat icon={BookOpen} label="Subjects" value={summary.subjects_count} />
            <Stat icon={Target} label="Quizzes taken" value={summary.quizzes_taken} dark />
            <Stat icon={TrendingUp} label="Accuracy" value={summary.quiz_accuracy} suffix="%" />
            <Stat icon={Flame} label="Streak (14d)" value={summary.streak_days} suffix="d" />
          </section>
        )}

        {/* Heatmap + Subjects */}
        <section className="grid lg:grid-cols-[1fr_1fr] gap-5">
          {summary && (
            <div className="card p-7">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900">14-day study heatmap</h2>
                  <p className="text-slate-500 text-sm">Days you quizzed, chatted, or reviewed.</p>
                </div>
                <span className="icon-square"><Flame size={20} strokeWidth={2.4} /></span>
              </div>
              <div className="mt-5 grid grid-cols-7 gap-2 max-w-md">
                {summary.heatmap.map((d) => (
                  <div key={d.date} title={d.date} className={`heat-cell ${d.active ? "active" : ""}`} />
                ))}
              </div>
              <div className="mt-5 flex items-center gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-2"><span className="heat-cell" style={{ width: 14, height: 14 }} /> Rest</span>
                <span className="flex items-center gap-2"><span className="heat-cell active" style={{ width: 14, height: 14 }} /> Active</span>
              </div>
              <div className="mt-6 p-5 rounded-2xl bg-slate-900 text-white relative overflow-hidden">
                <div className="text-xs uppercase tracking-widest text-white/60 font-bold">Overall mastery</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-display text-5xl font-bold">{summary.overall_mastery}%</span>
                  <span className="text-white/60 text-sm">across all topics</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-[#E4F222]" style={{ width: `${summary.overall_mastery}%` }} />
                </div>
              </div>
            </div>
          )}

          <div className="card p-7">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-slate-900">Your subjects</h2>
              <Link to="/subjects" data-testid="dash-all-subjects" className="text-sm font-bold text-slate-900 inline-flex items-center gap-1 hover:gap-2 transition-all">
                All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {subjects.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  <div className="icon-square mx-auto mb-3"><BookOpen size={20} /></div>
                  No subjects yet. Create your first one!
                </div>
              )}
              {subjects.slice(0, 5).map((s) => (
                <Link
                  key={s.subject_id}
                  to={`/subjects/${s.subject_id}`}
                  data-testid={`dash-subject-${s.subject_id}`}
                  className="block p-4 rounded-2xl border border-slate-200 hover:border-slate-900 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="icon-square" style={{ width: 36, height: 36, borderRadius: 10 }}><BookOpen size={16} strokeWidth={2.4} /></span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{s.title}</div>
                        <div className="text-xs text-slate-500">{s.material_count} materials · {s.mastery_avg}% mastery</div>
                      </div>
                    </div>
                    <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden shrink-0">
                      <div className="h-full bg-slate-900" style={{ width: `${s.mastery_avg}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Extension banner */}
        <section className="card-dark p-8 relative overflow-hidden">
          <span className="absolute -top-20 -right-20 w-60 h-60 rounded-full" style={{ background: "#E4F222", opacity: 0.18, filter: "blur(50px)" }} />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4F222] text-slate-900 text-xs font-bold uppercase tracking-widest">
                <Chrome size={12} /> Chrome Extension
              </div>
              <h3 className="font-display text-3xl font-bold mt-3">Stay on-task with Focus Mode</h3>
              <p className="text-white/70 mt-2">Install the Nuro extension for contextual nudges + a mini RAG chat tied to your active subject.</p>
            </div>
            <Link to="/extension-preview" data-testid="extension-preview-link" className="btn-yellow">
              Preview extension <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
