import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { ArrowLeft, BookOpen, MessageCircle, Calendar, Sparkles, Brain, GraduationCap } from "lucide-react";
import MaterialsTab from "./subject/MaterialsTab";
import ChatTab from "./subject/ChatTab";
import CurriculumTab from "./subject/CurriculumTab";
import QuizTab from "./subject/QuizTab";
import MasteryTab from "./subject/MasteryTab";
import PathTab from "./subject/PathTab";

const TABS = [
  { id: "path", label: "Learning Path", icon: GraduationCap, testId: "tab-path" },
  { id: "chat", label: "Chat", icon: MessageCircle, testId: "tab-chat" },
  { id: "materials", label: "Materials", icon: BookOpen, testId: "tab-materials" },
  { id: "curriculum", label: "Calendar", icon: Calendar, testId: "tab-curriculum" },
  { id: "quiz", label: "Free Quiz", icon: Sparkles, testId: "tab-quiz" },
  { id: "mastery", label: "Mastery", icon: Brain, testId: "tab-mastery" },
];

export default function SubjectDetailPage() {
  const { id } = useParams();
  const [subject, setSubject] = useState(null);
  const [tab, setTab] = useState("path");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSubject = async () => {
    const { data } = await api.get(`/subjects/${id}`).catch(() => ({ data: null }));
    if (data) setSubject(data);
  };
  useEffect(() => { loadSubject(); /* eslint-disable-next-line */ }, [id]);

  // Determine onboarding gate: lock other tabs until modules exist
  const [modulesCount, setModulesCount] = useState(null);
  useEffect(() => {
    if (!subject) return;
    api.get(`/subjects/${id}/modules`).then((r) => setModulesCount(r.data.length)).catch(() => setModulesCount(0));
  }, [id, subject, refreshKey]);

  const pathLocked = modulesCount === 0;

  return (
    <div className="min-h-screen bg-app pb-16">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 mt-8">
        <Link to="/subjects" data-testid="back-to-subjects" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 font-semibold text-sm">
          <ArrowLeft size={16} /> All subjects
        </Link>
        {subject && (
          <header className="bg-hero rounded-[2rem] border border-slate-200/60 p-7 sm:p-9 mb-5 fade-up">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Subject</p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mt-1 leading-tight">{subject.title}</h1>
            {subject.description && <p className="text-slate-600 mt-2 max-w-2xl">{subject.description}</p>}
          </header>
        )}

        {/* Tabs */}
        <nav className="card p-1.5 flex gap-1 overflow-x-auto mb-5" style={{ borderRadius: 9999 }}>
          {TABS.map((t) => {
            const locked = pathLocked && t.id !== "path" && t.id !== "materials";
            return (
              <button
                key={t.id}
                data-testid={t.testId}
                disabled={locked}
                onClick={() => !locked && setTab(t.id)}
                title={locked ? "Complete the Learning Path survey first" : undefined}
                className={`px-4 py-2.5 rounded-full font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap transition ${
                  tab === t.id ? "bg-slate-900 text-white" : locked ? "text-slate-300 cursor-not-allowed" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <t.icon size={16} /> {t.label}
              </button>
            );
          })}
        </nav>

        <div data-testid={`tab-content-${tab}`}>
          {tab === "path" && subject && <PathTab subject={subject} onChange={() => setRefreshKey((k) => k + 1)} />}
          {tab === "chat" && <ChatTab subjectId={id} />}
          {tab === "materials" && <MaterialsTab subjectId={id} />}
          {tab === "curriculum" && <CurriculumTab subjectId={id} />}
          {tab === "quiz" && <QuizTab subjectId={id} />}
          {tab === "mastery" && <MasteryTab subjectId={id} />}
        </div>
      </main>
    </div>
  );
}
