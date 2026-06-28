import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen, Brain, Target, Zap, ArrowRight, Cpu } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#2E7CF7] relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="blob-lime" style={{ width: 200, height: 200, top: -40, left: -40, opacity: 0.4 }} />
      <div className="blob-lime" style={{ width: 320, height: 320, bottom: -80, right: -80, opacity: 0.35 }} />

      {/* Top bar */}
      <div className="relative max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-11 h-11 rounded-full bg-[#C5E92E] flex items-center justify-center shadow-lg">
            <Sparkles size={22} className="text-slate-900" />
          </div>
          <span className="font-display text-3xl font-bold text-white">Nuro</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            data-testid="landing-login-btn"
            onClick={() => navigate("/login")}
            className="px-5 py-2.5 rounded-full bg-white/15 backdrop-blur text-white font-bold hover:bg-white/25 transition"
          >
            Log in
          </button>
          <button
            data-testid="landing-register-btn"
            onClick={() => navigate("/register")}
            className="px-5 py-2.5 rounded-full bg-[#C5E92E] text-slate-900 font-bold hover:-translate-y-0.5 transition-transform shadow-md"
          >
            Get started
          </button>
        </div>
      </div>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur text-white text-sm font-bold mb-6">
            <span className="dot-pulse" /> Hackathon build · AI Study Coach
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
            Your AI-powered<br />learning ecosystem.
          </h1>
          <p className="text-white/85 text-lg mt-6 max-w-xl leading-relaxed">
            Drop your notes, get an adaptive curriculum, quiz yourself, and chat with an AI that's actually grounded in <em>your</em> materials — plus a Chrome extension that gently keeps you focused.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <button
              data-testid="hero-start-btn"
              onClick={() => navigate("/register")}
              className="px-6 py-3.5 rounded-full bg-[#C5E92E] text-slate-900 font-bold text-lg shadow-xl hover:-translate-y-1 transition-transform inline-flex items-center gap-2"
            >
              Start learning free <ArrowRight size={20} />
            </button>
            <button
              data-testid="hero-login-btn"
              onClick={() => navigate("/login")}
              className="px-6 py-3.5 rounded-full bg-white text-slate-900 font-bold text-lg hover:-translate-y-1 transition-transform"
            >
              I already have an account
            </button>
          </div>
        </div>

        {/* Right: feature cards stack */}
        <div className="relative">
          <div className="bg-white rounded-[2rem] shadow-2xl p-7 relative">
            <div className="paperclip" />
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#FFEDD5] flex items-center justify-center shrink-0">
                <Brain size={28} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-bold text-slate-900">Grounded RAG Chat</h3>
                <p className="text-slate-600 mt-1">Ask anything — answers cite the exact chunk from your uploaded PDF or notes.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-2xl p-7 mt-5 ml-12 relative">
            <div className="paperclip left" />
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#D1FAE5] flex items-center justify-center shrink-0">
                <Target size={28} className="text-emerald-700" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-bold text-slate-900">Adaptive Quiz + Mastery Map</h3>
                <p className="text-slate-600 mt-1">Weak topics auto-surface. Get harder questions only when you're ready.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-[2rem] shadow-2xl p-7 mt-5 relative">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#C5E92E] flex items-center justify-center shrink-0">
                <Cpu size={28} className="text-slate-900" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-bold">Chrome Focus Extension</h3>
                <p className="text-white/70 mt-1">Drifting to YouTube during study time? Get nudged back to your materials.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature row */}
      <section className="relative max-w-6xl mx-auto px-6 pb-24">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-10 relative overflow-hidden">
          <div className="blob-lime" style={{ width: 220, height: 220, top: -60, right: -40, opacity: 0.5 }} />
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 relative">Built for self-directed learners</h2>
          <p className="text-slate-600 mt-3 max-w-2xl relative">Curriculum-agnostic. Drop your study materials and let Nuro plan, test, and coach.</p>
          <div className="mt-8 grid sm:grid-cols-3 gap-5 relative">
            {[
              { icon: BookOpen, title: "Multi-subject workspace", desc: "Organize physics, history, French — all separate.", bg: "#D1FAE5" },
              { icon: Sparkles, title: "AI curriculum generator", desc: "Goal + hours/week → personalized study plan.", bg: "#FFEDD5" },
              { icon: Zap, title: "Spaced repetition", desc: "Topics resurface based on your performance.", bg: "#E0E7FF" },
            ].map((f, i) => (
              <div key={i} className="p-5 rounded-2xl border-2 border-slate-100 hover:border-[#C5E92E] transition-colors">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: f.bg }}>
                  <f.icon size={24} className="text-slate-900" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">{f.title}</h3>
                <p className="text-slate-600 text-sm mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="text-white/70 text-center pb-8 text-sm">
        Made with Nuro · Powered by Claude Sonnet 4.5
      </footer>
    </div>
  );
}
