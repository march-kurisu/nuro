import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LogOut, LayoutDashboard, BookOpen, Sparkles, Chrome } from "lucide-react";

function NavLink({ to, icon: Icon, children, testId, active }) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <Icon size={16} />
      {children}
    </Link>
  );
}

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  const isActive = (p) => loc.pathname === p || (p !== "/dashboard" && loc.pathname.startsWith(p));

  return (
    <header className="sticky top-4 z-30 mx-auto max-w-7xl px-4">
      <div className="card flex items-center justify-between px-5 py-3" style={{ borderRadius: 9999 }}>
        <Link to="/dashboard" data-testid="nav-logo" className="flex items-center gap-2">
          <span className="icon-square" style={{ width: 36, height: 36, borderRadius: 10 }}>
            <Sparkles size={18} strokeWidth={2.5} />
          </span>
          <span className="font-display text-2xl font-bold text-slate-900 tracking-tight">Nuro</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/dashboard" icon={LayoutDashboard} testId="nav-dashboard" active={isActive("/dashboard")}>Dashboard</NavLink>
          <NavLink to="/subjects" icon={BookOpen} testId="nav-subjects" active={isActive("/subjects")}>Subjects</NavLink>
          <NavLink to="/extension-preview" icon={Chrome} testId="nav-extension" active={isActive("/extension-preview")}>Extension</NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-bold text-slate-900">{user?.name}</span>
            <span className="text-xs text-slate-500">{user?.email}</span>
          </div>
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-9 h-9 rounded-full" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
              {(user?.name || "?")[0].toUpperCase()}
            </div>
          )}
          <button
            data-testid="nav-logout"
            onClick={async () => { await logout(); navigate("/login"); }}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
