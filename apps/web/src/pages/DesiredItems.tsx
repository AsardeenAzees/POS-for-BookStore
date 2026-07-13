import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Branch, DesiredItemRequest } from "../lib/types";
import { useToast } from "../components/Toast";

export function DesiredItems() {
  const toast = useToast();
  const [rows, setRows] = useState<DesiredItemRequest[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({ customerName: "", phone: "", requestedItemName: "", branchId: "", notes: "", notifyBySms: true, notifyByWhatsapp: false });
  async function load() {
    const [items, branchRows] = await Promise.all([api<DesiredItemRequest[]>("/api/desired-items"), api<Branch[]>("/api/branches")]);
    setRows(items); setBranches(branchRows); setForm((current) => ({ ...current, branchId: current.branchId || branchRows[0]?.id || "" }));
  }
  useEffect(() => { void load(); }, []);
  async function submit() {
    await api("/api/desired-items", { method: "POST", body: JSON.stringify(form) });
    setForm({ customerName: "", phone: "", requestedItemName: "", branchId: branches[0]?.id ?? "", notes: "", notifyBySms: true, notifyByWhatsapp: false });
    toast({ type: "success", message: "Desired item request recorded." });
    await load();
  }
  async function approve(id: string) {
    await api(`/api/desired-items/${id}/approve-send`, { method: "POST" });
    toast({ type: "success", message: "Notification approved and processed." });
    await load();
  }
  async function status(id: string, value: string) {
    await api(`/api/desired-items/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: value }) });
    await load();
  }
  return (
    <section className="page">
      <div className="page-head"><div><h1>Desired Item Requests</h1><span className="muted">Record unavailable items and notify customers when stock arrives.</span></div></div>
      <div className="panel form-grid">
        <input placeholder="Customer name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
        <input placeholder="Phone 07XXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Requested item/book" value={form.requestedItemName} onChange={(e) => setForm({ ...form, requestedItemName: e.target.value })} />
        <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="primary" onClick={submit}>Add request</button>
      </div>
      <div className="panel">
        <table><thead><tr><th>Item</th><th>Customer</th><th>Branch</th><th>Status</th><th>Matched</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{row.requestedItemName}<br /><span className="muted">{row.notes}</span></td><td>{row.customerName}<br />{row.phone}</td><td>{row.branch?.name}</td><td><span className={`status ${row.status.toLowerCase()}`}>{row.status}</span></td><td>{row.matchedProduct?.name ?? "-"}</td><td><div className="button-row"><button onClick={() => approve(row.id)}>Approve/send</button><button onClick={() => status(row.id, "CANCELLED")}>Cancel</button><button onClick={() => status(row.id, "SPAM")}>Spam</button></div></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
