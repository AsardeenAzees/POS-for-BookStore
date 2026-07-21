import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageSquare, Printer } from "lucide-react";
import { api } from "../lib/api";
import { getSession } from "../lib/api";
import type { BusinessSettings, Sale } from "../lib/types";
import { useToast } from "../components/Toast";
import { PagePreloader } from "../components/Preloader";

export function Receipt() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState<{ sale: Sale; settings: BusinessSettings } | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"thermal" | "a4">("thermal");
  const isAdmin = getSession()?.user.role === "ADMIN";

  useEffect(() => { if (id) void api<{ sale: Sale; settings: BusinessSettings }>(`/api/sales/${id}/receipt`).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Unable to load receipt")); }, [id]);

  async function sendSms() {
    if (!id) return;
    try {
      const result = await api<{ status: string; smsStatus?: string; provider: string }>(`/api/sales/${id}/send-invoice-sms`, { method: "POST" });
      const smsStatus = result.smsStatus ?? result.status.toLowerCase();
      toast({ type: "success", message: smsStatus === "dry_run" ? "Invoice SMS dry-run recorded. No real SMS was sent." : "Invoice SMS sent. Check Notifications for gateway details." });
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "SMS failed" });
    }
  }

  if (error) return <section className="page"><div className="alert">{error}</div><Link className="button-link" to="/pos">Back to POS</Link></section>;
  if (!data?.sale) return <PagePreloader />;
  const { sale, settings } = data;
  const paid = sale.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = paid - Number(sale.total);

  return (
    <section className="page receipt-page">
      {mode === "thermal" && <style media="print">{"@page { size: 80mm auto; margin: 0; }"}</style>}
      <div className="page-head no-print">
        <div>
          <h1>Invoice {sale.invoiceNumber}</h1>
          <span className="muted">{mode === "thermal" ? "80 mm receipt preview · print at 100% scale with no margins." : "A4 invoice preview."}</span>
        </div>
        <div className="button-row">
          <button className={mode === "thermal" ? "active" : ""} onClick={() => setMode("thermal")}>Thermal</button>
          <button className={mode === "a4" ? "active" : ""} onClick={() => setMode("a4")}>A4</button>
          {isAdmin && <button onClick={sendSms}><MessageSquare size={16} /> Send SMS Invoice</button>}
          <button className="primary" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <Link className="button-link" to="/pos">Back to POS</Link>
        </div>
      </div>
      <article className={`invoice ${mode}`}>
        <header>
          <h2>{settings.businessName}</h2>
          <p>{settings.address}</p>
          <p>{settings.phone} {settings.email ? `· ${settings.email}` : ""}</p>
          {settings.taxRegistration && <p>Reg/Tax: {settings.taxRegistration}</p>}
        </header>
        <div className="invoice-meta">
          <div><strong>Invoice</strong><span>{sale.invoiceNumber}</span></div>
          <div><strong>Date</strong><span>{new Date(sale.createdAt).toLocaleString()}</span></div>
          <div><strong>Branch</strong><span>{sale.branch.name}</span></div>
          <div><strong>Cashier</strong><span>{sale.user?.name ?? "Staff"}</span></div>
          <div><strong>Customer</strong><span>{sale.customer ? `${sale.customer.name} · ${sale.customer.phone}` : "Walk-in"}</span></div>
        </div>
        {mode === "thermal" ? (
          <div className="thermal-items" aria-label="Purchased items">
            <div className="thermal-items-head"><span>Item</span><span>Amount</span></div>
            {sale.items.map((item) => (
              <div className="thermal-item" key={item.id}>
                <div className="thermal-item-name">
                  <strong>{item.product.name}</strong>
                  <span>{[item.product.sku, item.product.barcode].filter(Boolean).join(" · ")}</span>
                  <span>{item.quantity} × {money(item.unitPrice)}{Number(item.discount ?? 0) > 0 ? ` · Discount ${money(item.discount ?? 0)}` : ""}</span>
                </div>
                <strong className="thermal-item-total">{money(item.total)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <table className="invoice-items">
            <thead><tr><th>Item</th><th>SKU/Barcode</th><th>Qty</th><th>Unit</th><th>Discount</th><th>Total</th></tr></thead>
            <tbody>{sale.items.map((item) => <tr key={item.id}><td>{item.product.name}</td><td>{item.product.sku}<br />{item.product.barcode}</td><td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.discount ?? 0)}</td><td>{money(item.total)}</td></tr>)}</tbody>
          </table>
        )}
        <div className="invoice-totals">
          <span>Subtotal</span><strong>{money(sale.subtotal)}</strong>
          <span>Discount</span><strong>{money(sale.discount)}</strong>
          <span>Payment</span><strong>{sale.payments[0]?.method ?? "CASH"}</strong>
          <span>Paid</span><strong>{money(paid)}</strong>
          <span>Balance</span><strong>{money(balance)}</strong>
          <span className="grand">Grand Total</span><strong className="grand">{money(sale.total)}</strong>
        </div>
        <footer>{settings.receiptFooterText}</footer>
      </article>
    </section>
  );
}

function money(value: string | number) {
  return `LKR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
