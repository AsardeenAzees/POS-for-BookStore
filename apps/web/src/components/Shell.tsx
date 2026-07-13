import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Bell, Boxes, ClipboardList, LayoutDashboard, LogOut, Moon, ReceiptText, Settings, Sun, Users } from "lucide-react";
import { getSession, setSession } from "../lib/api";
import { useEffect, useState } from "react";

const nav = [
  ["/", "Dashboard", LayoutDashboard],
  ["/pos", "POS", ReceiptText],
  ["/inventory", "Inventory", Boxes],
  ["/customers", "Customers", Users],
  ["/desired-items", "Requests", ClipboardList],
  ["/reports", "Reports", BarChart3],
  ["/notifications", "Notifications", Bell],
  ["/settings", "Settings", Settings]
] as const;

export function Shell() {
  const navigate = useNavigate();
  const session = getSession();
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Cloud POS</div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <strong>{session?.user.name}</strong>
            <span>{session?.user.role} · {session?.user.branch?.name ?? "All branches"}</span>
          </div>
          <button className="icon-button" title="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="icon-button" title="Sign out" onClick={() => { setSession(null); navigate("/login"); }}><LogOut size={18} /></button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
