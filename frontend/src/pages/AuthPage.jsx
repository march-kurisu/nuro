import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Sparkles, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";

export default function AuthPage({ mode = "login" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const isLogin = mode === "login";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await register(email, password, name);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-hero">
      <div className="max-w-md mx-auto px-6 pt-10">
        <Link to="/" className="inline-flex items-center gap-2 mb-8" data-testid="auth-back-home">
          <span className="icon-square" style={{ width: 36, height: 36, borderRadius: 10 }}>
            <Sparkles size={18} strokeWidth={2.5} />
          </span>
          <span className="font-display text-2xl font-bold text-slate-900">Nuro</span>
        </Link>

        <div className="card p-8 fade-up">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-slate-500 mt-1">
            {isLogin ? "Continue your learning journey." : "Start your AI-powered study session."}
          </p>

          <button
            data-testid="auth-google-btn"
            onClick={googleLogin}
            type="button"
            className="mt-6 btn-dark w-full justify-center text-base py-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M21.35 11.1H12v2.99h5.31c-.51 2.74-2.83 3.99-5.31 3.99c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.49 0 2.84.54 3.89 1.42l2.13-2.13C16.46 3.83 14.34 3 12 3C7.03 3 3 7.03 3 12s4.03 9 9 9c4.5 0 8.59-3.28 8.59-9c0-.55-.05-1.1-.14-1.65z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-400 font-bold uppercase tracking-widest">or</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {!isLogin && (
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  data-testid="auth-name-input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="input with-icon"
                />
              </div>
            )}
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="auth-email-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input with-icon"
              />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="auth-password-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="input with-icon"
              />
            </div>
            <button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={busy}
              className="btn-yellow w-full justify-center text-base py-3 disabled:opacity-50"
            >
              {busy ? "..." : isLogin ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-slate-600">
            {isLogin ? "New here? " : "Already have an account? "}
            <Link
              data-testid="auth-switch-link"
              to={isLogin ? "/register" : "/login"}
              className="font-bold text-slate-900 underline decoration-[#E4F222] decoration-4 underline-offset-2 hover:decoration-yellow-400"
            >
              {isLogin ? "Create an account" : "Log in"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
