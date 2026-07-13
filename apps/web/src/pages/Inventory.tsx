import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Branch, Category, Product, Stock } from "../lib/types";
import { downloadCsv } from "../lib/api";
import { useToast } from "../components/Toast";

export function Inventory() {
  const toast = useToast();
  const [stock, setStock] = useState<Stock[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ branchId: "", productId: "", type: "STOCK_IN", quantity: 1, reason: "" });
  const [productForm, setProductForm] = useState({ name: "", sku: "", barcode: "", categoryId: "", brand: "", publisher: "", author: "", grade: "", sellingPrice: 0, costPrice: 0, active: true });
  const [duplicates, setDuplicates] = useState<Product[]>([]);

  async function load() {
    const [stockRows, branchRows, productRows, categoryRows, movementRows] = await Promise.all([api<Stock[]>("/api/inventory/stock"), api<Branch[]>("/api/branches"), api<Product[]>("/api/products"), api<Category[]>("/api/categories"), api<any[]>("/api/inventory/movements")]);
    setStock(stockRows); setBranches(branchRows); setProducts(productRows); setCategories(categoryRows); setMovements(movementRows);
    setForm((f) => ({ ...f, branchId: f.branchId || branchRows[0]?.id || "", productId: f.productId || productRows[0]?.id || "" }));
    setProductForm((f) => ({ ...f, categoryId: f.categoryId || categoryRows[0]?.id || "" }));
  }
  useEffect(() => { void load(); }, []);

  async function submit() {
    await api("/api/inventory/movements", { method: "POST", body: JSON.stringify(form) });
    setForm({ ...form, quantity: 1, reason: "" });
    toast({ type: "success", message: "Stock movement recorded." });
    await load();
  }

  async function checkDuplicates() {
    if (!productForm.name && !productForm.sku && !productForm.barcode) return;
    setDuplicates(await api<Product[]>(`/api/products/duplicate-check?name=${encodeURIComponent(productForm.name)}&sku=${encodeURIComponent(productForm.sku)}&barcode=${encodeURIComponent(productForm.barcode)}`));
  }

  async function addProduct() {
    await api("/api/products", { method: "POST", body: JSON.stringify({ ...productForm, barcode: productForm.barcode || null }) });
    toast({ type: "success", message: "Product added." });
    setProductForm({ name: "", sku: "", barcode: "", categoryId: categories[0]?.id ?? "", brand: "", publisher: "", author: "", grade: "", sellingPrice: 0, costPrice: 0, active: true });
    setDuplicates([]);
    await load();
  }

  return (
    <section className="page">
      <div className="page-head"><h1>Inventory</h1><div className="button-row"><button onClick={() => downloadCsv("/api/reports/export/branch-stock", "branch-stock.csv")}>Export stock</button><button onClick={() => window.print()}>Print</button></div></div>
      <div className="panel form-grid">
        <input placeholder="Product name" value={productForm.name} onBlur={checkDuplicates} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
        <input placeholder="SKU" value={productForm.sku} onBlur={checkDuplicates} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} />
        <input placeholder="Barcode" value={productForm.barcode} onBlur={checkDuplicates} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} />
        <select value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input placeholder="Brand/publisher" value={productForm.publisher || productForm.brand} onChange={(e) => setProductForm({ ...productForm, publisher: e.target.value, brand: e.target.value })} />
        <input placeholder="Author" value={productForm.author} onChange={(e) => setProductForm({ ...productForm, author: e.target.value })} />
        <input placeholder="Grade" value={productForm.grade} onChange={(e) => setProductForm({ ...productForm, grade: e.target.value })} />
        <input type="number" placeholder="Selling price" value={productForm.sellingPrice} onChange={(e) => setProductForm({ ...productForm, sellingPrice: Number(e.target.value) })} />
        <input type="number" placeholder="Cost price" value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: Number(e.target.value) })} />
        <button className="primary" onClick={addProduct}>Add product</button>
        {duplicates.length > 0 && <div className="warning">Possible duplicate: {duplicates.map((item) => item.name).join(", ")}</div>}
      </div>
      <div className="panel form-grid">
        <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>STOCK_IN</option><option>STOCK_OUT</option><option>ADJUSTMENT</option></select>
        <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
        <input placeholder="Reason required" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button className="primary" onClick={() => void submit()}>Record movement</button>
      </div>
      <div className="panel"><table><thead><tr><th>Product</th><th>Branch</th><th>Qty</th><th>Low level</th></tr></thead><tbody>{stock.map((row) => <tr key={row.id}><td>{row.product.name}</td><td>{row.branch.name}</td><td>{row.quantity}</td><td>{row.lowStockLevel}</td></tr>)}</tbody></table></div>
      <div className="panel"><h2>Stock Movement History</h2><table><thead><tr><th>Date</th><th>Product</th><th>Branch</th><th>Type</th><th>Qty</th><th>Reason</th><th>Staff</th></tr></thead><tbody>{movements.map((row) => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.product.name}</td><td>{row.branch.name}</td><td>{row.type}</td><td>{row.quantity}</td><td>{row.reason}</td><td>{row.user?.name}</td></tr>)}</tbody></table></div>
    </section>
  );
}
