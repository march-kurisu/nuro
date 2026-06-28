import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#2E7CF7] flex items-center justify-center text-white font-display text-2xl">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
