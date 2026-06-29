import { useNavigate } from "react-router-dom";
import { Search, Sparkles, ArrowUpRight, Star, Brain, Target, Cpu, BookOpen, ChevronDown, Smartphone, Quote } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  const NavLink = ({ children }) => (
    <button className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900 transition">
      {children} <ChevronDown size={14} />
    </button>
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Sticky Nav */}
      <header className="sticky top-4 z-30 max-w-7xl mx-auto px-4">
        <div className="card flex items-center justify-between px-5 py-3" style={{ borderRadius: 9999 }}>
          <button onClick={() => navigate("/")} data-testid="nav-logo" className="flex items-center gap-2">
            <span className="icon-square" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <Sparkles size={18} strokeWidth={2.5} />
            </span>
            <span className="font-display text-2xl font-bold text-slate-900 tracking-tight">Nuro</span>
          </button>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-semibold text-slate-700 hover:text-slate-900">Features</a>
            <a href="#how" className="text-sm font-semibold text-slate-700 hover:text-slate-900">How it works</a>
            <a href="#pricing" className="text-sm font-semibold text-slate-700 hover:text-slate-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <button data-testid="landing-login-btn" onClick={() => navigate("/login")} className="hidden sm:inline px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900">Log in</button>
            <button data-testid="landing-register-btn" onClick={() => navigate("/register")} className="btn-dark text-sm">
              <Smartphone size={14} /> Get started
            </button>
          </div>
        </div>
      </header>

      {/* HERO with soft blue gradient */}
      <section className="bg-hero pt-20 pb-16 mt-4 mx-4 rounded-[2rem] border border-slate-200/60 overflow-hidden relative">
        <div className="max-w-4xl mx-auto px-6 text-center fade-up">
          <span className="trust-pill" data-testid="trust-badge">
            <span className="dot-pulse" /> Trusted by self-directed learners
          </span>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 mt-6 leading-[1.05]">
            Upgrade Your Skills to<br />
            Unlock <span className="hl">🎯</span> <span className="hl">📚</span> <span className="hl">🚀</span> New Possibilities!
          </h1>
          <p className="text-slate-600 text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
            Join thousands of learners turning notes into mastery with an AI study coach grounded in <em>your</em> own materials.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button data-testid="hero-start-btn" onClick={() => navigate("/register")} className="btn-dark text-base px-7 py-3.5">
              Start Learning Free
            </button>
          </div>
        </div>

        {/* Search bar card */}
        <div className="max-w-4xl mx-auto mt-10 px-4">
          <div className="card p-6 sm:p-7" data-testid="search-card">
            <div className="text-sm font-bold text-slate-900 mb-3">Find your perfect subject</div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  data-testid="search-input"
                  placeholder="Search subjects, topics, or skills…"
                  className="input with-icon"
                />
              </div>
              <select className="select-pill" data-testid="search-level">
                <option>Level</option>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
              <select className="select-pill" data-testid="search-category">
                <option>Category</option>
                <option>STEM</option>
                <option>Humanities</option>
                <option>Languages</option>
                <option>Business</option>
              </select>
              <button onClick={() => navigate("/register")} className="btn-dark px-5">Find</button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Popular:</span>
              {["Organic Chemistry", "Calculus", "World History", "TOEFL"].map((t) => (
                <button key={t} className="text-xs font-semibold px-3 py-1 rounded-full border border-slate-200 hover:border-slate-900 text-slate-700 transition">{t}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Find the right skills */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-slate-900">Find the right tools for you</h2>
          <p className="text-slate-600 mt-3">Four AI-powered modules working together — grounded in the materials you actually study.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {[
            { icon: Brain, title: "Grounded RAG Chat", desc: "Ask anything — answers cite the exact chunk from your PDFs and notes.", dark: false },
            { icon: Target, title: "Adaptive Quiz Engine", desc: "Hardest questions appear only when you're ready. Mastery rises naturally.", dark: true },
            { icon: BookOpen, title: "AI Curriculum Builder", desc: "Goal + hours/week → weekly schedule personalized to your materials.", dark: false },
            { icon: Cpu, title: "Chrome Focus Extension", desc: "Drifting to YouTube during study? Gentle nudge back to the materials.", dark: false },
            { icon: Sparkles, title: "Mastery Map", desc: "Knowledge graph evolves color from grey → green as you quiz correctly.", dark: false },
            { icon: Star, title: "Spaced Repetition", desc: "Topics auto-resurface based on your performance — never forgotten.", dark: false },
          ].map((f, i) => (
            <div key={i} className={`${f.dark ? "card-dark" : "card"} p-6 group hover:-translate-y-1 transition-transform`}>
              <div className="flex items-start justify-between">
                <span className={`icon-square ${f.dark ? "" : ""}`}>
                  <f.icon size={22} strokeWidth={2.4} />
                </span>
                <ArrowUpRight size={18} className={f.dark ? "text-white/40 group-hover:text-white" : "text-slate-300 group-hover:text-slate-900"} />
              </div>
              <h3 className={`font-display text-xl font-bold mt-5 ${f.dark ? "" : "text-slate-900"}`}>{f.title}</h3>
              <p className={`mt-1 text-sm ${f.dark ? "text-white/70" : "text-slate-600"}`}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended Learning Paths */}
      <section id="how" className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">Recommended Learning Paths<br />Tailored to You</h2>
          <p className="text-slate-600 mt-3">Built dynamically from your subjects, mastery map, and weak topics.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {["For You", "Design", "Business", "Data", "Communication", "Language", "More +"].map((t, i) => (
            <button key={i} className={i === 0 ? "btn-dark text-sm px-4 py-2" : "btn-ghost text-sm px-4 py-2"}>{t}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {[
            { tag: "Intermediate", title: "Organic Chemistry mastery", desc: "From IUPAC naming to reaction mechanisms.", img: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80" },
            { tag: "Pro", title: "Full-stack Web Dev", desc: "React, FastAPI, MongoDB — build, ship, iterate.", img: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80" },
            { tag: "Beginner-friendly", title: "Spanish A1 → B1", desc: "Vocab + grammar drills built from your textbook.", img: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=600&q=80" },
          ].map((c, i) => (
            <div key={i} className="card overflow-hidden hover:-translate-y-1 transition-transform">
              <div className="h-44 relative overflow-hidden" style={{ background: "#F4F4F2" }}>
                <img src={c.img} alt="" className="w-full h-full object-cover" />
                <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/90 text-xs font-bold text-slate-900 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E4F222]" /> {c.tag}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-900">{c.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 text-center">Loved by learners</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
          {[
            { name: "Daniel Rafiq", role: "Engineering student", text: "Finally an AI tutor that actually cites my textbook. Game-changer for exam prep." },
            { name: "Nadya R.", role: "Med student", text: "The mastery map showed me exactly which topics to revise. Saved hours every week." },
            { name: "Hartanto P.", role: "Polyglot", text: "The Chrome extension keeps me honest. No more YouTube spirals during study blocks." },
          ].map((t, i) => (
            <div key={i} className="card p-6 relative">
              <Quote size={24} className="text-[#E4F222]" />
              <div className="flex items-center gap-1 mt-2 text-[#E4F222]">
                {Array.from({ length: 5 }).map((_, j) => (<Star key={j} size={16} fill="#E4F222" stroke="none" />))}
              </div>
              <p className="text-slate-700 mt-3 leading-relaxed">"{t.text}"</p>
              <div className="mt-5 flex items-center gap-3 pt-4 border-t border-slate-100">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center">{t.name[0]}</div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 pb-20">
        <div className="card-dark p-10 sm:p-14 text-center relative overflow-hidden">
          <span className="absolute top-6 right-6 w-32 h-32 rounded-full" style={{ background: "#E4F222", opacity: 0.15, filter: "blur(40px)" }} />
          <h2 className="font-display text-4xl sm:text-5xl font-bold leading-tight">Ready to upgrade<br />how you study?</h2>
          <p className="text-white/70 mt-4 max-w-xl mx-auto">Free during the hackathon. No credit card. Bring your notes, leave with mastery.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button data-testid="footer-cta-start" onClick={() => navigate("/register")} className="btn-yellow text-base px-7 py-3.5">Start Learning Free</button>
            <button onClick={() => navigate("/login")} className="btn-ghost text-base px-7 py-3.5" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>I have an account</button>
          </div>
        </div>
      </section>

      <footer className="text-slate-500 text-center pb-8 text-sm">
        Made with Nuro · Powered by Claude Sonnet 4.5
      </footer>
    </div>
  );
}
