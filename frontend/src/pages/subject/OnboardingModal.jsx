import { useState } from "react";
import api from "@/lib/api";
import { Sparkles, X, ArrowRight, GraduationCap } from "lucide-react";
import { toast } from "sonner";

const LEVELS = [
  { id: "beginner", label: "Total beginner", desc: "Never studied this before" },
  { id: "some_basics", label: "Some basics", desc: "I know a little, fuzzy on details" },
  { id: "intermediate", label: "Intermediate", desc: "Comfortable, want to deepen" },
  { id: "advanced", label: "Advanced", desc: "Polishing edge cases" },
];

export default function OnboardingModal({ subject, onComplete, onClose }) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [currentLevel, setCurrentLevel] = useState("beginner");
  const [weakAreas, setWeakAreas] = useState("");
  const [targetOutcome, setTargetOutcome] = useState("");
  const [busy, setBusy] = useState(false);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/subjects/${subject.subject_id}/onboard`, {
        goal, current_level: currentLevel, weak_areas: weakAreas, target_outcome: targetOutcome,
      });
      toast.success(`Created your learning path · ${data.modules.length} modules`);
      onComplete(data.modules);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not build path. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" data-testid="onboarding-modal">
      <div className="card max-w-xl w-full p-7 sm:p-9 relative fade-up">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100" data-testid="onboarding-close">
          <X size={18} />
        </button>

        {step === 0 && (
          <>
            <span className="icon-square"><GraduationCap size={22} strokeWidth={2.4} /></span>
            <h2 className="font-display text-3xl font-bold mt-4 text-slate-900">Let's build your learning path</h2>
            <p className="text-slate-600 mt-2">
              A quick 30-second survey so we can <span className="hl">order modules</span> from foundation → advanced, just for you.
            </p>
            <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Subject</div>
              <div className="font-bold text-slate-900 mt-1">{subject.title}</div>
            </div>
            <button onClick={next} className="btn-yellow mt-6 w-full justify-center" data-testid="onboarding-start">
              Start survey <ArrowRight size={16} />
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Step 1 / 3</div>
            <h2 className="font-display text-2xl font-bold mt-2 text-slate-900">What's your goal?</h2>
            <p className="text-slate-600 mt-1 text-sm">Be specific — e.g., "Pass midterm with B+ or higher" or "Hold a 5-min conversation in Spanish."</p>
            <textarea
              data-testid="onboard-goal"
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What does success look like for you?"
              className="input mt-4"
              style={{ borderRadius: 20, resize: "none" }}
            />
            <div className="flex gap-2 mt-5">
              <button onClick={back} className="btn-ghost">Back</button>
              <button onClick={next} disabled={!goal.trim()} className="btn-dark flex-1 justify-center disabled:opacity-50" data-testid="onboard-next-1">
                Continue <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Step 2 / 3</div>
            <h2 className="font-display text-2xl font-bold mt-2 text-slate-900">Where are you now?</h2>
            <p className="text-slate-600 mt-1 text-sm">Pick the level that best matches you. We'll start your path here.</p>
            <div className="mt-4 grid gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  data-testid={`onboard-level-${l.id}`}
                  onClick={() => setCurrentLevel(l.id)}
                  className={`text-left p-4 rounded-2xl border-2 transition ${
                    currentLevel === l.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <div className="font-bold text-slate-900">{l.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{l.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={back} className="btn-ghost">Back</button>
              <button onClick={next} className="btn-dark flex-1 justify-center" data-testid="onboard-next-2">
                Continue <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Step 3 / 3</div>
            <h2 className="font-display text-2xl font-bold mt-2 text-slate-900">Any weak spots?</h2>
            <p className="text-slate-600 mt-1 text-sm">Topics you struggle with or want extra focus on. Skip if unsure.</p>
            <input
              data-testid="onboard-weak"
              value={weakAreas}
              onChange={(e) => setWeakAreas(e.target.value)}
              placeholder="e.g., trigonometric identities, French verb conjugation…"
              className="input mt-4"
            />
            <input
              data-testid="onboard-target"
              value={targetOutcome}
              onChange={(e) => setTargetOutcome(e.target.value)}
              placeholder="Target outcome (optional)"
              className="input mt-2"
            />
            <div className="flex gap-2 mt-5">
              <button onClick={back} className="btn-ghost">Back</button>
              <button onClick={submit} disabled={busy} className="btn-yellow flex-1 justify-center disabled:opacity-50" data-testid="onboard-submit">
                <Sparkles size={14} /> {busy ? "Building path…" : "Build my learning path"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
