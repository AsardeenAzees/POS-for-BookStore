import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setSession, type Session } from "../lib/api";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const session = await api<Session>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setSession(session);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>Cloud POS</h1>
        <p>Sri Lankan retail POS and inventory dashboard</p>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <div className="alert">{error}</div>}
        <button className="primary">Sign in</button>
      </form>
    </div>
  );
}
