import { useEffect, useState } from "react";
import { api, downloadCsv, isDemoViewer } from "../lib/api";
import type { Customer } from "../lib/types";
import { useToast } from "../components/Toast";
import { PagePreloader } from "../components/Preloader";

export function Customers() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", address: "", notificationPreference: "INVOICE_ONLY" });
  const demoMode = isDemoViewer();
  const load = () => api<Customer[]>("/api/customers").then(setCustomers).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  async function submit() {
    try {
      await api("/api/customers", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", phone: "", whatsapp: "", address: "", notificationPreference: "INVOICE_ONLY" });
      toast({ type: "success", message: "Customer added." });
      await load();
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "Unable to add customer" });
    }
  }
  if (loading) return <PagePreloader />;
  return (
    <section className={`page ${demoMode ? "demo-customer-view" : ""}`}>
      <div className="page-head"><h1>Customers</h1><button onClick={() => downloadCsv("/api/reports/export/customers", "customers.csv")}>Export CSV</button></div>
      {demoMode && <div className="demo-notice">Customer records are view-only in demo mode.</div>}
      {!demoMode && <div className="panel form-grid">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="WhatsApp optional" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        <input placeholder="Address optional" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <select value={form.notificationPreference} onChange={(e) => setForm({ ...form, notificationPreference: e.target.value })}><option>INVOICE_ONLY</option><option>STOCK_ALERTS</option><option>MARKETING</option><option>UNSUBSCRIBED</option></select>
        <button className="primary" onClick={() => void submit()}>Add customer</button>
      </div>}
      <div className="search"><input placeholder="Search customers by name or phone" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <fieldset disabled={demoMode} className="readonly-fieldset" title={demoMode ? "Disabled for demo account" : undefined}>
      <div className="panel"><table><thead><tr><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Preference</th></tr></thead><tbody>{customers.filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(search.toLowerCase())).map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.phone}</td><td>{c.whatsapp}</td><td><select value={c.notificationPreference} onChange={async (e) => { try { await api(`/api/customers/${c.id}/preference`, { method: "PATCH", body: JSON.stringify({ notificationPreference: e.target.value }) }); await load(); } catch (error) { toast({ type: "error", message: error instanceof Error ? error.message : "Unable to update preference" }); } }}><option>INVOICE_ONLY</option><option>STOCK_ALERTS</option><option>MARKETING</option><option>UNSUBSCRIBED</option></select></td></tr>)}</tbody></table></div>
      </fieldset>
    </section>
  );
}
