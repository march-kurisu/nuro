import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Brain } from "lucide-react";

const colorFor = (p) => {
  if (p >= 80) return "#16A34A";
  if (p >= 50) return "#E4B600";
  if (p >= 25) return "#F59E0B";
  return "#94A3B8";
};

export default function MasteryTab({ subjectId }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/subjects/${subjectId}/mastery`);
      setItems(data.sort((a, b) => b.proficiency - a.proficiency));
    })();
  }, [subjectId]);

  const overall = items.length ? Math.round(items.reduce((s, i) => s + i.proficiency, 0) / items.length) : 0;

  return (
    <div className="space-y-5">
      <div className="card-dark p-7 relative overflow-hidden">
        <span className="absolute -top-20 -right-20 w-60 h-60 rounded-full" style={{ background: "#E4F222", opacity: 0.18, filter: "blur(50px)" }} />
        <div className="relative grid sm:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/60">Mastery Map</div>
            <h3 className="font-display text-3xl font-bold mt-1">Your knowledge graph</h3>
            <p className="text-white/70 mt-2 text-sm">Topics evolve color from grey → green as you quiz correctly.</p>
          </div>
          <div className="flex flex-col items-end">
            <div className="font-display text-6xl font-bold leading-none">{overall}<span className="text-2xl">%</span></div>
            <div className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">Overall</div>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="icon-square mx-auto mb-3"><Brain size={20} /></div>
          <p className="font-display text-xl font-bold text-slate-900">No topics tracked yet</p>
          <p className="text-slate-500 mt-1 text-sm">Generate a curriculum or take quizzes — topics appear here automatically.</p>
        </div>
      ) : (
        <div className="card p-7">
          <div className="grid sm:grid-cols-2 gap-4">
            {items.map((t) => (
              <div key={t.topic_id} className="p-5 rounded-2xl border border-slate-200 hover:border-slate-900 transition" data-testid={`mastery-topic-${t.topic_id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{t.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{t.correct}/{t.attempts} correct</div>
                  </div>
                  <div className="font-display text-2xl font-bold" style={{ color: colorFor(t.proficiency) }}>{t.proficiency}%</div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${t.proficiency}%`, background: colorFor(t.proficiency) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
