import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Sparkles, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";

export default function CurriculumTab({ subjectId }) {
  const [plan, setPlan] = useState(null);
  const [goal, setGoal] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [hours, setHours] = useState(5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/subjects/${subjectId}/curriculum`);
      if (data) {
        setPlan(data);
        setGoal(data.goal); setWeeks(data.weeks); setHours(data.hours_per_week);
      }
    })();
  }, [subjectId]);

  const generate = async () => {
    if (!goal.trim()) { toast.error("Tell us your goal first"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/subjects/${subjectId}/curriculum/generate`, {
        goal, weeks: Number(weeks), hours_per_week: Number(hours),
      });
      setPlan(data);
      toast.success("Curriculum generated!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const weeksArr = plan?.plan?.weeks || [];

  return (
    <div className="space-y-5">
      <div className="card p-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-widest">
          <Sparkles size={12} /> AI Generator
        </div>
        <h3 className="font-display text-2xl font-bold text-slate-900 mt-3">Plan your weeks</h3>
        <p className="text-slate-500 text-sm">Set your goal — Claude designs the curriculum from your materials.</p>

        <div className="mt-5 grid md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Goal</label>
            <input
              data-testid="curriculum-goal-input"
              value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Pass midterm with 85+%"
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Weeks</label>
            <input
              data-testid="curriculum-weeks-input"
              type="number" min={1} max={12}
              value={weeks} onChange={(e) => setWeeks(e.target.value)}
              className="input mt-1 text-center font-bold w-24"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Hrs/wk</label>
            <input
              data-testid="curriculum-hours-input"
              type="number" min={1} max={40}
              value={hours} onChange={(e) => setHours(e.target.value)}
              className="input mt-1 text-center font-bold w-24"
            />
          </div>
          <button data-testid="curriculum-generate-btn" onClick={generate} disabled={busy} className="btn-yellow disabled:opacity-50">
            <Sparkles size={14} /> {busy ? "Generating…" : plan ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>

      {weeksArr.length > 0 && (
        <div className="space-y-4">
          {weeksArr.map((w, i) => (
            <div key={i} className="card p-6 fade-up" data-testid={`curriculum-week-${w.week || i+1}`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="icon-square dark font-display font-bold text-lg" style={{ width: 48, height: 48, borderRadius: 14 }}>{w.week || i + 1}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Week {w.week || i + 1}</div>
                  <h4 className="font-display text-xl font-bold text-slate-900 truncate">{w.focus || "Focus"}</h4>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {(w.days || []).map((d, j) => (
                  <div key={j} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-900 transition">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-900 inline-flex items-center gap-2">
                        <Calendar size={14} /> {d.day || `Day ${j + 1}`}
                      </span>
                      <span className="text-slate-500 inline-flex items-center gap-1 text-xs">
                        <Clock size={12} /> {d.minutes || 30}m
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700 text-sm">{d.task}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
