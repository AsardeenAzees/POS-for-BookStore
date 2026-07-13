import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { api, downloadCsv } from "../lib/api";

export function Reports() {
  const [tab, setTab] = useState("daily-sales");
  const [data, setData] = useState<unknown>(null);
  useEffect(() => { void api(`/api/reports/${tab}`).then(setData); }, [tab]);
  return (
    <section className="page">
      <div className="page-head"><h1>Reports</h1><div className="button-row"><button onClick={() => downloadCsv(`/api/reports/export/${tab}`, `${tab}.csv`)}>Export CSV</button><button onClick={() => window.print()}><Printer size={16} /> Print</button></div></div>
      <div className="tabs">{["daily-sales", "product-sales", "low-stock", "branch-stock", "employee-sales"].map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item.replace("-", " ")}</button>)}</div>
      <pre className="report-json">{JSON.stringify(data, null, 2)}</pre>
      <div className="tabs"><button onClick={() => downloadCsv("/api/reports/export/product-list", "products.csv")}>Products CSV</button><button onClick={() => downloadCsv("/api/reports/export/customers", "customers.csv")}>Customers CSV</button><button onClick={() => downloadCsv("/api/reports/export/desired-item-requests", "desired-items.csv")}>Desired Items CSV</button><button onClick={() => downloadCsv("/api/reports/export/sms-logs", "sms-logs.csv")}>SMS Logs CSV</button></div>
    </section>
  );
}
