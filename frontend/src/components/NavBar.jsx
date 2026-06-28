import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LogOut, LayoutDashboard, BookOpen, Sparkles } from "lucide-react";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  const NavLink = ({ to, icon: Icon, children, testId }) => {
    const active = loc.pathname === to || (to !== "/dashboard" && loc.pathname.startsWith(to));
    return (
      <Link
        to={to}
        data-testid={testId}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all hover:-translate-y-0.5 ${
          active ? "bg-[#1D4ED8] text-white" : "text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Icon size={18} />
        {children}
      </Link>
    );
  };

  return (
    <header className="sticky top-4 z-30 mx-auto max-w-6xl px-4">
      <div className="bg-white rounded-full shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" data-testid="nav-logo" className="flex items-center gap-2 pl-2">
          <div className="w-10 h-10 rounded-full bg-[#C5E92E] flex items-center justify-center shadow-md">
            <Sparkles size={20} className="text-slate-900" />
          </div>
          <span className="font-display text-2xl font-bold text-slate-900">Nuro</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/dashboard" icon={LayoutDashboard} testId="nav-dashboard">Dashboard</NavLink>
          <NavLink to="/subjects" icon={BookOpen} testId="nav-subjects">Subjects</NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-bold text-slate-900">{user?.name}</span>
            <span className="text-xs text-slate-500">{user?.email}</span>
          </div>
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-10 h-10 rounded-full border-2 border-[#C5E92E]" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#1D4ED8] text-white font-bold flex items-center justify-center">
              {(user?.name || "?")[0].toUpperCase()}
            </div>
          )}
          <button
            data-testid="nav-logout"
            onClick={async () => { await logout(); navigate("/login"); }}
            className="p-2 rounded-full hover:bg-slate-100"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
