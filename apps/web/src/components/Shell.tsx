import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Bell, Boxes, ClipboardList, LayoutDashboard, LogOut, Moon, ReceiptText, Settings, Sun, Users } from "lucide-react";
import { getSession, setSession } from "../lib/api";
import { useEffect, useState } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER"] },
  { to: "/pos", label: "POS", icon: ReceiptText, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { to: "/inventory", label: "Inventory", icon: Boxes, roles: ["ADMIN", "MANAGER", "INVENTORY_STAFF"] },
  { to: "/customers", label: "Customers", icon: Users, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { to: "/desired-items", label: "Requests", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "CASHIER", "INVENTORY_STAFF"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["ADMIN", "MANAGER"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN", "MANAGER"] }
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
          {nav.filter((item) => item.roles.some((role) => role === session?.user.role)).map(({ to, label, icon: Icon }) => (
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
