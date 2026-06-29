import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Sparkles, Calendar as CalIcon, Clock, ChevronLeft, ChevronRight, Check, Wand2 } from "lucide-react";
import { toast } from "sonner";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthDays(year, month /* 0-11 */) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Monday-first column offset
  const firstDow = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CurriculumTab({ subjectId }) {
  const [plan, setPlan] = useState(null);
  const [goal, setGoal] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [hours, setHours] = useState(5);
  const [startDate, setStartDate] = useState(() => isoDate(new Date()));
  const [dailyTime, setDailyTime] = useState("18:00");
  const [dows, setDows] = useState([0, 1, 2, 3, 4]);
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [view, setView] = useState(new Date());
  const [showForm, setShowForm] = useState(true);
  const [editEvent, setEditEvent] = useState(null); // { idx, ...fields }
  const [addEvent, setAddEvent] = useState(null);   // { date }
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/subjects/${subjectId}/curriculum`);
      if (data) {
        setPlan(data);
        setGoal(data.goal); setWeeks(data.weeks); setHours(data.hours_per_week);
        if (data.start_date) {
          setStartDate(data.start_date);
          setView(new Date(data.start_date + "T00:00:00"));
        }
        if (data.daily_time) setDailyTime(data.daily_time);
        if (data.days_of_week) setDows(data.days_of_week);
        setShowForm(false);
      }
    })();
  }, [subjectId]);

  const generate = async () => {
    if (!goal.trim()) { toast.error("Tell us your goal first"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/subjects/${subjectId}/curriculum/generate`, {
        goal, weeks: Number(weeks), hours_per_week: Number(hours),
        start_date: startDate, daily_time: dailyTime, days_of_week: dows,
      });
      setPlan(data);
      setView(new Date(data.start_date + "T00:00:00"));
      setShowForm(false);
      toast.success("Calendar generated!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const aiSuggest = async () => {
    if (!goal.trim()) { toast.error("Tell us your goal first"); return; }
    setSuggesting(true);
    try {
      const { data } = await api.post(`/subjects/${subjectId}/curriculum/suggest`, {
        goal, hours_per_week: Number(hours), target_date: targetDate || undefined,
      });
      if (data.start_date) setStartDate(data.start_date);
      if (data.weeks) setWeeks(data.weeks);
      if (data.daily_time) setDailyTime(data.daily_time);
      if (Array.isArray(data.days_of_week)) setDows(data.days_of_week);
      toast.success(data.reasoning || "Schedule suggested by AI");
    } catch (e) {
      toast.error("AI suggest failed");
    } finally {
      setSuggesting(false);
    }
  };

  const toggleDone = async (idx, current) => {
    try {
      await api.post(`/subjects/${subjectId}/curriculum/event`, { event_index: idx, done: !current });
      const updated = { ...plan, events: plan.events.map((e, i) => i === idx ? { ...e, done: !current } : e) };
      setPlan(updated);
    } catch { toast.error("Could not update"); }
  };

  const saveEdit = async () => {
    if (!editEvent) return;
    const { idx, date, time, task, minutes } = editEvent;
    try {
      const { data } = await api.patch(`/subjects/${subjectId}/curriculum/event/${idx}`, {
        date, time, task, minutes: Number(minutes),
      });
      const updated = { ...plan, events: plan.events.map((e, i) => i === idx ? { ...e, ...data.event } : e) };
      setPlan(updated);
      setEditEvent(null);
      toast.success("Event updated");
    } catch { toast.error("Edit failed"); }
  };

  const handleDelete = async (idx) => {
    try {
      await api.delete(`/subjects/${subjectId}/curriculum/event/${idx}`);
      const updated = { ...plan, events: plan.events.filter((_, i) => i !== idx) };
      setPlan(updated);
      setEditEvent(null);
      setConfirmDelete(null);
      toast.success("Event deleted");
    } catch { toast.error("Delete failed"); }
  };

  const saveAdd = async () => {
    if (!addEvent?.task?.trim()) { toast.error("Task is required"); return; }
    try {
      const { data } = await api.post(`/subjects/${subjectId}/curriculum/event/add`, {
        date: addEvent.date,
        time: addEvent.time || "18:00",
        task: addEvent.task,
        minutes: Number(addEvent.minutes || 45),
      });
      setPlan((p) => ({ ...(p || {}), events: data.events }));
      setAddEvent(null);
      toast.success("Event added");
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not add event"); }
  };

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = {};
    (plan?.events || []).forEach((ev, idx) => {
      (map[ev.date] = map[ev.date] || []).push({ ...ev, _idx: idx });
    });
    return map;
  }, [plan]);

  const cells = monthDays(view.getFullYear(), view.getMonth());
  const monthName = view.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayIso = isoDate(new Date());

  return (
    <div className="space-y-5">
      {/* Header: collapsible form */}
      {(showForm || !plan) && (
        <div className="card p-7">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-widest">
                <Sparkles size={12} /> AI Scheduler
              </div>
              <h3 className="font-display text-2xl font-bold text-slate-900 mt-3">Plan your study calendar</h3>
              <p className="text-slate-500 text-sm">Pick a start date, time slot & active days — or let AI suggest.</p>
            </div>
            {plan && (
              <button onClick={() => setShowForm(false)} className="btn-ghost text-sm">Hide form</button>
            )}
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Goal</label>
              <input
                data-testid="curriculum-goal-input"
                value={goal} onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Pass midterm with 85+%"
                className="input mt-1"
              />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Start date</label>
                <input
                  data-testid="curriculum-start-date"
                  type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Weeks</label>
                <input
                  data-testid="curriculum-weeks-input"
                  type="number" min={1} max={12}
                  value={weeks} onChange={(e) => setWeeks(e.target.value)}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Hrs/wk</label>
                <input
                  data-testid="curriculum-hours-input"
                  type="number" min={1} max={40}
                  value={hours} onChange={(e) => setHours(e.target.value)}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Daily time</label>
                <input
                  data-testid="curriculum-daily-time"
                  type="time" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)}
                  className="input mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Study days</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DOW_LABELS.map((d, i) => (
                  <button
                    key={i}
                    data-testid={`curriculum-dow-${i}`}
                    type="button"
                    onClick={() => setDows((ds) => ds.includes(i) ? ds.filter(x => x !== i) : [...ds, i].sort())}
                    className={`px-4 py-2 rounded-full font-bold text-sm transition ${
                      dows.includes(i) ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >{d}</button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end pt-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Target deadline (optional)</label>
                <input
                  data-testid="curriculum-target-date"
                  type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                  className="input mt-1"
                />
              </div>
              <button
                data-testid="curriculum-ai-suggest"
                onClick={aiSuggest}
                disabled={suggesting}
                className="btn-ghost disabled:opacity-50"
              >
                <Wand2 size={14} /> {suggesting ? "Thinking…" : "AI suggest"}
              </button>
              <button
                data-testid="curriculum-generate-btn"
                onClick={generate}
                disabled={busy}
                className="btn-yellow disabled:opacity-50"
              >
                <Sparkles size={14} /> {busy ? "Generating…" : plan ? "Regenerate" : "Build calendar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar view */}
      {plan && (
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button data-testid="cal-prev" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft size={18} /></button>
              <h3 className="font-display text-2xl font-bold text-slate-900 min-w-[180px] text-center">{monthName}</h3>
              <button data-testid="cal-next" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight size={18} /></button>
              <button data-testid="cal-today" onClick={() => setView(new Date())} className="px-3 py-1.5 text-xs font-bold rounded-full border border-slate-200 hover:border-slate-900">Today</button>
            </div>
            {!showForm && (
              <button onClick={() => setShowForm(true)} className="btn-ghost text-sm" data-testid="curriculum-edit">
                Edit schedule
              </button>
            )}
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
            {DOW_LABELS.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-[5/6] sm:aspect-[5/4] bg-transparent" />;
              const iso = isoDate(cell);
              const evs = eventsByDate[iso] || [];
              const isToday = iso === todayIso;
              return (
                <div
                  key={i}
                  data-testid={`cal-cell-${iso}`}
                  className={`aspect-[5/6] sm:aspect-[5/4] p-1.5 rounded-xl border ${
                    isToday ? "border-slate-900 bg-slate-50" : "border-slate-100"
                  } ${evs.length ? "" : ""} flex flex-col overflow-hidden`}
                >
                  <div className={`text-xs font-bold ${isToday ? "text-slate-900" : "text-slate-400"} flex items-center justify-between`}>
                    <span>{cell.getDate()}</span>
                    {evs.length > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E4F222] text-slate-900 text-[10px] font-bold">
                        {evs.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1 overflow-y-auto flex-1">
                    {evs.map((ev) => (
                      <button
                        key={ev._idx}
                        data-testid={`cal-event-${ev._idx}`}
                        onClick={() => toggleDone(ev._idx, ev.done)}
                        className={`w-full text-left px-1.5 py-1 rounded-md text-[10px] font-semibold leading-tight transition ${
                          ev.done ? "bg-green-100 text-green-700 line-through" : "bg-slate-900 text-white hover:bg-slate-700"
                        }`}
                        title={`${ev.time} · ${ev.task}`}
                      >
                        <div className="flex items-center gap-1">
                          {ev.done && <Check size={9} />}
                          <span className="opacity-80">{ev.time}</span>
                        </div>
                        <div className="truncate">{ev.task}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's tasks list */}
      {plan && (() => {
        const today = (plan.events || []).filter((e) => e.date === todayIso);
        const upcoming = (plan.events || []).filter((e) => e.date > todayIso && !e.done).slice(0, 5);
        if (today.length === 0 && upcoming.length === 0) return null;
        return (
          <div className="card p-6">
            <h3 className="font-display text-xl font-bold text-slate-900">Today & upcoming</h3>
            <div className="mt-4 space-y-2">
              {today.length === 0 ? (
                <div className="text-sm text-slate-500">No tasks scheduled today. Enjoy a break — or get ahead.</div>
              ) : (
                today.map((ev) => (
                  <div key={ev._idx ?? ev.task} className={`p-3 rounded-xl border flex items-center gap-3 ${ev.done ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><Clock size={12} /> {ev.time}</span>
                    <span className={`flex-1 text-sm ${ev.done ? "line-through text-slate-400" : "text-slate-900 font-semibold"}`}>{ev.task}</span>
                    <span className="text-xs text-slate-500">{ev.minutes}m</span>
                  </div>
                ))
              )}
              {upcoming.length > 0 && (
                <>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 pt-2">Upcoming</div>
                  {upcoming.map((ev, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white border border-slate-100 flex items-center gap-3">
                      <CalIcon size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-500 font-bold">{ev.date} · {ev.time}</span>
                      <span className="flex-1 text-sm text-slate-700 truncate">{ev.task}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
