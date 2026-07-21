import React, { type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { getSession } from "./lib/api";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { POS } from "./pages/POS";
import { Inventory } from "./pages/Inventory";
import { Customers } from "./pages/Customers";
import { Reports } from "./pages/Reports";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { DesiredItems } from "./pages/DesiredItems";
import { Receipt } from "./pages/Receipt";
import { ToastProvider } from "./components/Toast";
import "./styles.css";

function Protected() {
  return getSession() ? <Shell /> : <Navigate to="/login" replace />;
}

function RoleRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const role = getSession()?.user.role;
  return role && roles.includes(role) ? children : <Navigate to="/" replace />;
}

function Home() {
  const role = getSession()?.user.role;
  if (role === "ADMIN" || role === "MANAGER") return <Dashboard />;
  if (role === "CASHIER") return <Navigate to="/pos" replace />;
  if (role === "INVENTORY_STAFF") return <Navigate to="/inventory" replace />;
  return <section className="page"><div className="panel empty-state"><h1>Delivery workflow</h1><p>The delivery workspace is planned for Phase 2. No POS-side delivery actions are assigned to this role yet.</p></div></section>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route index element={<Home />} />
            <Route path="pos" element={<RoleRoute roles={["ADMIN", "MANAGER", "CASHIER"]}><POS /></RoleRoute>} />
            <Route path="sales/:id/receipt" element={<RoleRoute roles={["ADMIN", "MANAGER", "CASHIER"]}><Receipt /></RoleRoute>} />
            <Route path="inventory" element={<RoleRoute roles={["ADMIN", "MANAGER", "INVENTORY_STAFF"]}><Inventory /></RoleRoute>} />
            <Route path="customers" element={<RoleRoute roles={["ADMIN", "MANAGER", "CASHIER"]}><Customers /></RoleRoute>} />
            <Route path="desired-items" element={<RoleRoute roles={["ADMIN", "MANAGER", "CASHIER", "INVENTORY_STAFF"]}><DesiredItems /></RoleRoute>} />
            <Route path="reports" element={<RoleRoute roles={["ADMIN", "MANAGER"]}><Reports /></RoleRoute>} />
            <Route path="notifications" element={<RoleRoute roles={["ADMIN", "MANAGER"]}><Notifications /></RoleRoute>} />
            <Route path="settings" element={<RoleRoute roles={["ADMIN", "MANAGER"]}><Settings /></RoleRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
