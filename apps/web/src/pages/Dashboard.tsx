import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Sale, Stock } from "../lib/types";

export function Dashboard() {
  const [summary, setSummary] = useState<any>();
  const [daily, setDaily] = useState<{ total: number; count: number; sales: Sale[] }>();
  const [lowStock, setLowStock] = useState<Stock[]>([]);

  useEffect(() => {
    void api<any>("/api/reports/dashboard-summary").then(setSummary).catch(() => undefined);
    void api<{ total: number; count: number; sales: Sale[] }>("/api/reports/daily-sales").then(setDaily).catch(() => undefined);
    void api<Stock[]>("/api/reports/low-stock").then(setLowStock);
  }, []);

  return (
    <section className="page">
      <h1>Dashboard</h1>
      <div className="metrics">
        <div><span>Today sales</span><strong>LKR {(summary?.todaySales ?? daily?.total ?? 0).toLocaleString()}</strong></div>
        <div><span>Invoices</span><strong>{summary?.todayInvoices ?? daily?.count ?? 0}</strong></div>
        <div><span>Low stock items</span><strong>{summary?.lowStockCount ?? lowStock.length}</strong></div>
        <div><span>Pending requests</span><strong>{summary?.pendingDesired ?? 0}</strong></div>
      </div>
      {summary && <div className="dashboard-grid">
        <div className="panel"><h2>Top Products</h2><table><thead><tr><th>Product</th><th>Qty</th><th>Total</th></tr></thead><tbody>{summary.topProducts.map((row: any) => <tr key={row.productId}><td>{row.product?.name}</td><td>{row._sum.quantity}</td><td>LKR {Number(row._sum.total ?? 0).toLocaleString()}</td></tr>)}</tbody></table></div>
        <div className="panel"><h2>Recent Sales</h2><table><thead><tr><th>Invoice</th><th>Customer</th><th>Total</th></tr></thead><tbody>{summary.recentSales.map((sale: any) => <tr key={sale.id}><td>{sale.invoiceNumber}</td><td>{sale.customer?.name ?? "Walk-in"}</td><td>LKR {Number(sale.total).toLocaleString()}</td></tr>)}</tbody></table></div>
      </div>}
      <div className="panel">
        <h2>Low Stock Alerts</h2>
        <table><thead><tr><th>Product</th><th>Branch</th><th>Qty</th><th>Level</th></tr></thead>
          <tbody>{lowStock.map((row) => <tr key={row.id}><td>{row.product.name}</td><td>{row.branch.name}</td><td>{row.quantity}</td><td>{row.lowStockLevel}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
