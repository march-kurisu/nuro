import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Lock, Check, Play, BookOpen, ArrowRight, GraduationCap, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import OnboardingModal from "./OnboardingModal";

const LEVEL_META = {
  foundation: { label: "Foundation", color: "#16A34A", bg: "#D1FAE5" },
  intermediate: { label: "Intermediate", color: "#1D4ED8", bg: "#E0E7FF" },
  advanced: { label: "Advanced", color: "#DC2626", bg: "#FEE2E2" },
};

const STATUS_META = {
  locked: { label: "Locked", icon: Lock, color: "#94A3B8" },
  unlocked: { label: "Up next", icon: Play, color: "#1A1A1F" },
  in_progress: { label: "In progress", icon: Play, color: "#D97706" },
  mastered: { label: "Mastered", icon: Check, color: "#16A34A" },
};

function ModuleQuizPanel({ module, subjectId, onCompleted }) {
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const TARGET_Q = 3;

  const next = async () => {
    setBusy(true); setResult(null); setSelected(null);
    try {
      const { data } = await api.post(`/subjects/${subjectId}/quiz/generate`, {
        difficulty: module.level === "foundation" ? "easy" : module.level === "intermediate" ? "medium" : "hard",
        topic_hint: module.title,
      });
      setQuiz(data);
    } catch (e) {
      toast.error("Need materials? Upload first.");
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (selected === null || !quiz) return;
    try {
      const { data } = await api.post(`/quiz/answer`, { quiz_id: quiz.quiz_id, selected_index: selected });
      setResult(data);
      setQuestionsAnswered((q) => q + 1);
      if (data.correct) setCorrectCount((c) => c + 1);
    } catch { toast.error("Submit failed"); }
  };

  const finishModule = async () => {
    const total = questionsAnswered;
    const score = total ? Math.round((correctCount / total) * 100) : 0;
    try {
      const { data } = await api.post(`/modules/${module.module_id}/complete`, { score });
      toast.success(score >= 70 ? `Mastered with ${score}%! Next module unlocked.` : `Scored ${score}%. Try again to unlock next.`);
      onCompleted(data.modules);
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not save score"); }
  };

  return (
    <div className="mt-5 p-5 rounded-2xl bg-slate-50 border border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Module check</div>
          <div className="font-bold text-slate-900 mt-1">{questionsAnswered}/{TARGET_Q} questions · {questionsAnswered ? Math.round((correctCount/questionsAnswered)*100) : 0}% correct</div>
        </div>
        {!quiz && (
          <button onClick={next} disabled={busy} className="btn-yellow disabled:opacity-50" data-testid={`module-start-quiz-${module.module_id}`}>
            <Sparkles size={14} /> {busy ? "Generating…" : "Start check"}
          </button>
        )}
      </div>

      {quiz && (
        <div className="mt-4">
          <div className="font-display text-lg font-bold text-slate-900">{quiz.question}</div>
          <div className="mt-3 space-y-2">
            {quiz.options.map((opt, i) => {
              const isCorrect = result && i === result.correct_index;
              const isWrong = result && selected === i && !result.correct;
              return (
                <button
                  key={i}
                  disabled={!!result}
                  onClick={() => setSelected(i)}
                  data-testid={`module-quiz-opt-${i}`}
                  className={`w-full text-left p-3 rounded-xl border-2 flex items-center gap-3 text-sm transition ${
                    isCorrect ? "bg-green-50 border-green-500" :
                    isWrong ? "bg-red-50 border-red-500" :
                    selected === i ? "bg-white border-slate-900" :
                    "bg-white border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${
                    isCorrect ? "bg-green-500 text-white" : isWrong ? "bg-red-500 text-white" : selected === i ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}>{String.fromCharCode(65 + i)}</div>
                  <span className="flex-1 text-slate-900">{opt}</span>
                </button>
              );
            })}
          </div>

          {!result && (
            <button onClick={submit} disabled={selected === null} className="mt-4 btn-dark disabled:opacity-40" data-testid="module-submit-quiz">
              Submit <ArrowRight size={14} />
            </button>
          )}

          {result && (
            <div className={`mt-4 p-4 rounded-xl ${result.correct ? "bg-green-50" : "bg-red-50"}`}>
              <div className={`font-bold ${result.correct ? "text-green-700" : "text-red-700"}`}>
                {result.correct ? "Correct!" : "Not quite."}
              </div>
              <p className="text-sm text-slate-700 mt-1">{result.explanation}</p>
              <div className="mt-3 flex gap-2">
                {questionsAnswered < TARGET_Q ? (
                  <button onClick={next} className="btn-dark text-sm" data-testid="module-quiz-next">Next question <ArrowRight size={14} /></button>
                ) : (
                  <button onClick={finishModule} className="btn-yellow text-sm" data-testid="module-finish">
                    <Check size={14} /> Finish & unlock next
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PathTab({ subject, onChange }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get(`/subjects/${subject.subject_id}/modules`);
    setModules(data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [subject.subject_id]);

  if (loading) return <div className="card p-12 text-center text-slate-500">Loading…</div>;

  if (modules.length === 0) {
    return (
      <>
        <div className="card p-12 text-center">
          <div className="icon-square mx-auto mb-4" style={{ width: 56, height: 56, borderRadius: 16 }}>
            <GraduationCap size={24} strokeWidth={2.4} />
          </div>
          <h3 className="font-display text-3xl font-bold text-slate-900">Build your learning path</h3>
          <p className="text-slate-600 mt-2 max-w-md mx-auto">
            Take a quick 30-second survey. Nuro will generate an ordered path from <span className="hl">foundation</span> → advanced, locked until you master each step.
          </p>
          <button onClick={() => setShowOnboarding(true)} data-testid="path-start-onboarding" className="btn-yellow mt-6">
            <Sparkles size={14} /> Start survey
          </button>
        </div>
        {showOnboarding && (
          <OnboardingModal
            subject={subject}
            onClose={() => setShowOnboarding(false)}
            onComplete={(mods) => { setModules(mods); setShowOnboarding(false); onChange?.(); }}
          />
        )}
      </>
    );
  }

  const completed = modules.filter((m) => m.status === "mastered").length;
  const progress = Math.round((completed / modules.length) * 100);
  const restart = async () => {
    if (!confirm("Re-run the survey? Your modules will be rebuilt.")) return;
    setModules([]);
    setShowOnboarding(true);
  };

  return (
    <div className="space-y-5">
      <div className="card-dark p-7 relative overflow-hidden">
        <span className="absolute -top-20 -right-20 w-60 h-60 rounded-full" style={{ background: "#E4F222", opacity: 0.18, filter: "blur(50px)" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/60">Learning path</div>
            <h3 className="font-display text-3xl font-bold mt-1">{completed} / {modules.length} modules mastered</h3>
            <p className="text-white/70 mt-2 text-sm max-w-md">Modules unlock only after you score 70%+ on the previous one. Stay the course.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-display text-5xl font-bold">{progress}%</div>
              <div className="text-white/60 text-xs uppercase tracking-widest font-bold">Complete</div>
            </div>
            <button onClick={restart} className="p-2 rounded-full bg-white/10 hover:bg-white/20" title="Restart survey" data-testid="path-restart">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
        <div className="mt-5 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-[#E4F222] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ol className="space-y-3">
        {modules.map((m, i) => {
          const lv = LEVEL_META[m.level] || LEVEL_META.foundation;
          const st = STATUS_META[m.status] || STATUS_META.locked;
          const StatusIcon = st.icon;
          const isActive = activeModuleId === m.module_id;
          const interactive = m.status !== "locked";
          return (
            <li
              key={m.module_id}
              data-testid={`path-module-${m.module_id}`}
              className={`card p-5 ${interactive ? "" : "opacity-60"} ${isActive ? "ring-2 ring-slate-900" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="font-display text-xs font-bold text-slate-500">STEP</div>
                  <div className={`w-12 h-12 mt-1 rounded-full flex items-center justify-center font-display text-xl font-bold ${
                    m.status === "mastered" ? "bg-green-500 text-white" :
                    m.status === "locked" ? "bg-slate-100 text-slate-400" :
                    "bg-slate-900 text-white"
                  }`}>
                    {m.status === "mastered" ? <Check size={20} /> : i + 1}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: lv.bg, color: lv.color }}>
                      {lv.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: st.color }}>
                      <StatusIcon size={12} /> {st.label}
                    </span>
                    {m.score > 0 && <span className="text-xs text-slate-500">Score: {m.score}%</span>}
                  </div>
                  <h4 className="font-display text-lg font-bold text-slate-900 mt-2">{m.title}</h4>
                  <p className="text-sm text-slate-600 mt-1">{m.summary}</p>
                  {m.objectives && m.objectives.length > 0 && isActive && (
                    <ul className="mt-3 space-y-1">
                      {m.objectives.map((o, j) => (
                        <li key={j} className="text-sm text-slate-700 flex items-start gap-2">
                          <BookOpen size={14} className="text-slate-400 mt-0.5 shrink-0" /> {o}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="shrink-0">
                  {m.status === "locked" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-slate-100 text-slate-400 text-xs font-bold">
                      <Lock size={12} /> Locked
                    </span>
                  ) : (
                    <button
                      data-testid={`path-open-${m.module_id}`}
                      onClick={() => setActiveModuleId(isActive ? null : m.module_id)}
                      className={isActive ? "btn-ghost text-sm" : "btn-dark text-sm"}
                    >
                      {isActive ? "Close" : m.status === "mastered" ? "Review" : "Open"}
                    </button>
                  )}
                </div>
              </div>

              {isActive && interactive && (
                <ModuleQuizPanel
                  module={m}
                  subjectId={subject.subject_id}
                  onCompleted={(mods) => { setModules(mods); setActiveModuleId(null); onChange?.(); }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {showOnboarding && (
        <OnboardingModal
          subject={subject}
          onClose={() => setShowOnboarding(false)}
          onComplete={(mods) => { setModules(mods); setShowOnboarding(false); onChange?.(); }}
        />
      )}
    </div>
  );
}
