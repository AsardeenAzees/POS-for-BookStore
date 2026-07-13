import { useEffect, useState } from "react";
import { api, downloadCsv } from "../lib/api";
import type { NotificationLog } from "../lib/types";
import { useToast } from "../components/Toast";

export function Notifications() {
  const toast = useToast();
  const [rows, setRows] = useState<NotificationLog[]>([]);
  const load = () => api<NotificationLog[]>("/api/notifications").then(setRows);
  useEffect(() => { void load(); }, []);
  async function retry(id: string) {
    await api(`/api/notifications/${id}/retry`, { method: "POST" });
    toast({ type: "success", message: "SMS retry processed." });
    await load();
  }
  return (
    <section className="page">
      <div className="page-head"><h1>Notifications</h1><button onClick={() => downloadCsv("/api/reports/export/sms-logs", "sms-logs.csv")}>Export CSV</button></div>
      <div className="panel"><table><thead><tr><th>Event</th><th>Channel</th><th>Recipient</th><th>Status</th><th>Message</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}><td>{row.event}<br /><span className="muted">{row.provider}</span></td><td>{row.channel}</td><td>{row.recipient}</td><td><span className={`status ${row.status.toLowerCase()}`}>{row.status}</span><br /><span className="muted">{row.errorMessage}</span></td><td>{row.message}</td><td>{row.status === "FAILED" && <button onClick={() => retry(row.id)}>Retry</button>}</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}
