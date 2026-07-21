import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, LockKeyhole, Mail, MonitorCheck } from "lucide-react";
import { api, setSession, type Session } from "../lib/api";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (signingIn) return;
    setError("");
    setSigningIn(true);
    try {
      const session = await api<Session>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setSession(session);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSigningIn(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-layout">
        <form className="login-card" onSubmit={submit} aria-busy={signingIn}>
          <div className="login-mark"><MonitorCheck size={25} aria-hidden="true" /></div>
          <div className="login-heading"><span>Secure staff access</span><h1>Sri Lanka Cloud POS</h1><p>Retail POS, Inventory, Invoices and Reports</p></div>
          <label>Email address<div className="input-with-icon"><Mail size={17} /><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@bookshop.lk" disabled={signingIn} /></div></label>
          <label>Password<div className="input-with-icon"><LockKeyhole size={17} /><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" disabled={signingIn} /></div></label>
          {error && <div className="alert" role="alert">{error}</div>}
          <button className="primary login-submit" type="submit" disabled={signingIn}>{signingIn && <span className="button-spinner" aria-hidden="true" />}{signingIn ? "Signing in..." : "Sign in"}</button>
        </form>
        <aside className="demo-login-card">
          <div className="demo-card-icon"><Eye size={21} /></div>
          <div><span className="eyebrow">Demo Admin Preview</span><h2>Read-only demo account</h2></div>
          <dl><div><dt>Email</dt><dd>demo@bookshop.lk</dd></div><div><dt>Password</dt><dd>DemoView@2026!</dd></div></dl>
          <p>This account can view dashboards, inventory, invoices and reports but cannot modify data.</p>
          <button type="button" onClick={() => { setEmail("demo@bookshop.lk"); setPassword("DemoView@2026!"); setError(""); }} disabled={signingIn}>Use demo account</button>
        </aside>
      </div>
    </div>
  );
}
