import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { api, downloadCsv } from "../lib/api";
import { useToast } from "../components/Toast";

const tabs = ["daily-sales", "product-sales", "low-stock", "branch-stock", "employee-sales"] as const;
type Tab = typeof tabs[number];

export function Reports() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("daily-sales");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void api(`/api/reports/${tab}`).then(setData).catch((error) => toast({ type: "error", message: error instanceof Error ? error.message : "Unable to load report" })).finally(() => setLoading(false));
  }, [tab, toast]);

  async function exportCsv(path: string, filename: string) {
    try {
      await downloadCsv(path, filename);
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "CSV export failed" });
    }
  }

  const report = reportRows(tab, data);
  return (
    <section className="page">
      <div className="page-head"><div><h1>Reports</h1><span className="muted">Sales and stock information for your permitted branch scope.</span></div><div className="button-row"><button onClick={() => void exportCsv(`/api/reports/export/${tab}`, `${tab}.csv`)}>Export CSV</button><button onClick={() => window.print()}><Printer size={16} /> Print</button></div></div>
      <div className="tabs">{tabs.map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item.replaceAll("-", " ")}</button>)}</div>
      <div className="panel report-table">{loading ? <div className="empty-state">Loading report...</div> : report.rows.length === 0 ? <div className="empty-state">No records for this report.</div> : <table><thead><tr>{report.columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={String(row.id ?? row.productId ?? row.userId ?? index)}>{report.columns.map((column) => <td key={column.label}>{column.value(row)}</td>)}</tr>)}</tbody></table>}</div>
      <div className="tabs no-print"><button onClick={() => void exportCsv("/api/reports/export/product-list", "products.csv")}>Products CSV</button><button onClick={() => void exportCsv("/api/reports/export/customers", "customers.csv")}>Customers CSV</button><button onClick={() => void exportCsv("/api/reports/export/desired-item-requests", "desired-items.csv")}>Desired Items CSV</button><button onClick={() => void exportCsv("/api/reports/export/sms-logs", "sms-logs.csv")}>SMS Logs CSV</button></div>
    </section>
  );
}

type Row = Record<string, any>;
type Column = { label: string; value: (row: Row) => string | number };

function reportRows(tab: Tab, data: unknown): { rows: Row[]; columns: Column[] } {
  const value = data as any;
  if (tab === "daily-sales") return { rows: value?.sales ?? [], columns: [
    { label: "Invoice", value: (row) => row.invoiceNumber }, { label: "Branch", value: (row) => row.branch?.name ?? "-" }, { label: "Cashier", value: (row) => row.user?.name ?? "-" }, { label: "Total", value: (row) => money(row.total) }, { label: "Date", value: (row) => new Date(row.createdAt).toLocaleString() }
  ] };
  if (tab === "product-sales") return { rows: Array.isArray(value) ? value : [], columns: [
    { label: "Product", value: (row) => row.product?.name ?? row.productId }, { label: "Quantity", value: (row) => row._sum?.quantity ?? 0 }, { label: "Sales", value: (row) => money(row._sum?.total ?? 0) }
  ] };
  if (tab === "low-stock" || tab === "branch-stock") return { rows: Array.isArray(value) ? value : [], columns: [
    { label: "Product", value: (row) => row.product?.name ?? "-" }, { label: "SKU", value: (row) => row.product?.sku ?? "-" }, { label: "Branch", value: (row) => row.branch?.name ?? "-" }, { label: "Quantity", value: (row) => row.quantity }, { label: "Low level", value: (row) => row.lowStockLevel }
  ] };
  return { rows: Array.isArray(value) ? value : [], columns: [
    { label: "Employee", value: (row) => row.user?.name ?? row.userId }, { label: "Email", value: (row) => row.user?.email ?? "-" }, { label: "Invoices", value: (row) => row._count ?? 0 }, { label: "Sales", value: (row) => money(row._sum?.total ?? 0) }
  ] };
}

function money(value: unknown) {
  return `LKR ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
