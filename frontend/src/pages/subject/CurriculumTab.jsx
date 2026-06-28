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
      <div className="bg-white rounded-[2rem] p-7 shadow-xl relative overflow-hidden">
        <div className="blob-lime" style={{ width: 180, height: 180, top: -50, right: -50, opacity: 0.5 }} />
        <div className="relative">
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
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Pass midterm with 85+%"
                className="mt-1 w-full px-4 py-3 rounded-full bg-slate-100 border-2 border-transparent focus:border-[#1D4ED8] focus:bg-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Weeks</label>
              <input
                data-testid="curriculum-weeks-input"
                type="number" min={1} max={12}
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                className="mt-1 w-24 px-4 py-3 rounded-full bg-slate-100 border-2 border-transparent focus:border-[#1D4ED8] focus:bg-white outline-none text-center font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Hrs/wk</label>
              <input
                data-testid="curriculum-hours-input"
                type="number" min={1} max={40}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="mt-1 w-24 px-4 py-3 rounded-full bg-slate-100 border-2 border-transparent focus:border-[#1D4ED8] focus:bg-white outline-none text-center font-bold"
              />
            </div>
            <button
              data-testid="curriculum-generate-btn"
              onClick={generate}
              disabled={busy}
              className="px-6 py-3 rounded-full bg-[#C5E92E] text-slate-900 font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform disabled:opacity-50"
            >
              <Sparkles size={16} /> {busy ? "Generating…" : plan ? "Regenerate" : "Generate"}
            </button>
          </div>
        </div>
      </div>

      {weeksArr.length > 0 && (
        <div className="space-y-4">
          {weeksArr.map((w, i) => (
            <div key={i} className="bg-white rounded-[2rem] p-6 shadow-xl fade-up" data-testid={`curriculum-week-${w.week || i+1}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#1D4ED8] text-white font-display text-xl font-bold flex items-center justify-center shrink-0">
                  {w.week || i + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Week {w.week || i + 1}</div>
                  <h4 className="font-display text-xl font-bold text-slate-900 truncate">{w.focus || "Focus"}</h4>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {(w.days || []).map((d, j) => (
                  <div key={j} className="p-4 rounded-2xl bg-slate-50 border-2 border-transparent hover:border-[#C5E92E] transition">
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
