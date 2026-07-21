import { useEffect, useState } from "react";
import { api, downloadCsv, isDemoViewer } from "../lib/api";
import type { NotificationLog } from "../lib/types";
import { useToast } from "../components/Toast";
import { Preloader } from "../components/Preloader";

export function Notifications() {
  const toast = useToast();
  const [rows, setRows] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState("");
  const demoMode = isDemoViewer();
  const load = () => api<NotificationLog[]>("/api/notifications").then(setRows).catch((error) => toast({ type: "error", message: error instanceof Error ? error.message : "Unable to load notifications" })).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  async function retry(id: string) {
    setRetryingId(id);
    try {
      await api(`/api/notifications/${id}/retry`, { method: "POST" });
      toast({ type: "success", message: "SMS retry processed." });
      await load();
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "SMS retry failed" });
    } finally {
      setRetryingId("");
    }
  }
  return (
    <section className={`page ${demoMode ? "demo-notification-view" : ""}`}>
      <div className="page-head"><h1>Notifications</h1><button onClick={() => downloadCsv("/api/reports/export/sms-logs", "sms-logs.csv")}>Export CSV</button></div>
      {demoMode && <div className="demo-notice">Notification logs are view-only. Retry actions are disabled for the demo account.</div>}
      <fieldset disabled={demoMode} className="readonly-fieldset" title={demoMode ? "Disabled for demo account" : undefined}>
      <div className="panel">{loading ? <Preloader compact /> : rows.length === 0 ? <div className="empty-state">No notification attempts yet.</div> : <table><thead><tr><th>Event</th><th>Channel</th><th>Recipient</th><th>Status</th><th>Message</th><th>Action</th></tr></thead>
        <tbody>{rows.map((row) => {
          const status = row.smsStatus?.toUpperCase() ?? row.status;
          return <tr key={row.id}><td>{row.event}<br /><span className="muted">{row.provider}</span></td><td>{row.channel}</td><td>{row.recipient}</td><td><span className={`status ${status.toLowerCase()}`}>{status}</span><br /><span className="muted">{row.errorMessage}</span></td><td>{row.message}</td><td>{row.status === "FAILED" && <button disabled={retryingId === row.id} onClick={() => retry(row.id)}>{retryingId === row.id ? "Retrying..." : "Retry"}</button>}</td></tr>;
        })}</tbody>
      </table>}</div>
      </fieldset>
    </section>
  );
}
