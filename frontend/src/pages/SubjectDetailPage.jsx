import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import NavBar from "@/components/NavBar";
import api from "@/lib/api";
import { ArrowLeft, BookOpen, MessageCircle, Calendar, Sparkles, Brain } from "lucide-react";
import MaterialsTab from "./subject/MaterialsTab";
import ChatTab from "./subject/ChatTab";
import CurriculumTab from "./subject/CurriculumTab";
import QuizTab from "./subject/QuizTab";
import MasteryTab from "./subject/MasteryTab";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageCircle, testId: "tab-chat" },
  { id: "materials", label: "Materials", icon: BookOpen, testId: "tab-materials" },
  { id: "curriculum", label: "Curriculum", icon: Calendar, testId: "tab-curriculum" },
  { id: "quiz", label: "Quiz", icon: Sparkles, testId: "tab-quiz" },
  { id: "mastery", label: "Mastery", icon: Brain, testId: "tab-mastery" },
];

export default function SubjectDetailPage() {
  const { id } = useParams();
  const [subject, setSubject] = useState(null);
  const [tab, setTab] = useState("chat");

  useEffect(() => {
    api.get(`/subjects/${id}`).then((r) => setSubject(r.data)).catch(() => {});
  }, [id]);

  return (
    <div className="min-h-screen bg-[#2E7CF7] pb-16">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 mt-8">
        <Link to="/subjects" data-testid="back-to-subjects" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 font-bold">
          <ArrowLeft size={18} /> All subjects
        </Link>
        {subject && (
          <header className="bg-white rounded-[2rem] p-7 shadow-2xl mb-5 relative overflow-hidden fade-up">
            <div className="blob-lime" style={{ width: 180, height: 180, top: -50, right: -50, opacity: 0.5 }} />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Subject</p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mt-1">{subject.title}</h1>
              {subject.description && <p className="text-slate-600 mt-2 max-w-2xl">{subject.description}</p>}
            </div>
          </header>
        )}

        {/* Tabs */}
        <nav className="bg-white rounded-full shadow-xl p-2 flex gap-1 overflow-x-auto mb-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={t.testId}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 rounded-full font-bold text-sm inline-flex items-center gap-2 whitespace-nowrap transition ${
                tab === t.id ? "bg-[#1D4ED8] text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>

        <div data-testid={`tab-content-${tab}`}>
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
