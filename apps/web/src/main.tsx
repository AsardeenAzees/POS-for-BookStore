import React from "react";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="sales/:id/receipt" element={<Receipt />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="customers" element={<Customers />} />
            <Route path="desired-items" element={<DesiredItems />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
