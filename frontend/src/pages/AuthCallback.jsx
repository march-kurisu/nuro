import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const session_id = match[1];

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        setToken(data.token, data.user);
        // Clear hash and go to dashboard
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true });
      } catch (e) {
        navigate("/login?error=oauth", { replace: true });
      }
    })();
  }, [navigate, setToken]);

  return (
    <div className="min-h-screen bg-hero flex items-center justify-center font-display text-2xl text-slate-900">
      Signing you in…
    </div>
  );
}
