import { useEffect, useState } from "react";
import { api, downloadCsv } from "../lib/api";
import type { Customer } from "../lib/types";

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", address: "", notificationPreference: "INVOICE_ONLY" });
  const load = () => api<Customer[]>("/api/customers").then(setCustomers);
  useEffect(() => { void load(); }, []);
  async function submit() {
    await api("/api/customers", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", phone: "", whatsapp: "", address: "", notificationPreference: "INVOICE_ONLY" });
    await load();
  }
  return (
    <section className="page">
      <div className="page-head"><h1>Customers</h1><button onClick={() => downloadCsv("/api/reports/export/customers", "customers.csv")}>Export CSV</button></div>
      <div className="panel form-grid">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="WhatsApp optional" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        <input placeholder="Address optional" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <select value={form.notificationPreference} onChange={(e) => setForm({ ...form, notificationPreference: e.target.value })}><option>INVOICE_ONLY</option><option>STOCK_ALERTS</option><option>MARKETING</option><option>UNSUBSCRIBED</option></select>
        <button className="primary" onClick={() => void submit()}>Add customer</button>
      </div>
      <div className="panel"><table><thead><tr><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Preference</th></tr></thead><tbody>{customers.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.phone}</td><td>{c.whatsapp}</td><td><select value={c.notificationPreference} onChange={async (e) => { await api(`/api/customers/${c.id}/preference`, { method: "PATCH", body: JSON.stringify({ notificationPreference: e.target.value }) }); await load(); }}><option>INVOICE_ONLY</option><option>STOCK_ALERTS</option><option>MARKETING</option><option>UNSUBSCRIBED</option></select></td></tr>)}</tbody></table></div>
    </section>
  );
}
