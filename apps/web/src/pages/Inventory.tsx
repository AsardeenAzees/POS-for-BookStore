import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { api, isDemoViewer } from "../lib/api";
import type { Branch, Category, Product, Stock } from "../lib/types";
import { downloadCsv } from "../lib/api";
import { useToast } from "../components/Toast";
import { PagePreloader } from "../components/Preloader";

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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [editForm, setEditForm] = useState<ProductEditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const demoMode = isDemoViewer();

  async function load() {
    try {
      const [stockRows, branchRows, productRows, categoryRows, movementRows] = await Promise.all([api<Stock[]>("/api/inventory/stock"), api<Branch[]>("/api/branches"), api<Product[]>("/api/products"), api<Category[]>("/api/categories"), api<any[]>("/api/inventory/movements")]);
      setStock(stockRows); setBranches(branchRows); setProducts(productRows); setCategories(categoryRows); setMovements(movementRows);
      setForm((f) => ({ ...f, branchId: f.branchId || branchRows[0]?.id || "", productId: f.productId || productRows[0]?.id || "" }));
      setProductForm((f) => ({ ...f, categoryId: f.categoryId || categoryRows[0]?.id || "" }));
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "Unable to load inventory" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!editingStock) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingEdit) closeEditor();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editingStock, savingEdit]);

  async function submit() {
    try {
      await api("/api/inventory/movements", { method: "POST", body: JSON.stringify(form) });
      setForm({ ...form, quantity: 1, reason: "" });
      toast({ type: "success", message: "Stock movement recorded." });
      await load();
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "Stock movement failed" });
    }
  }

  async function checkDuplicates() {
    if (!productForm.name && !productForm.sku && !productForm.barcode) return;
    setDuplicates(await api<Product[]>(`/api/products/duplicate-check?name=${encodeURIComponent(productForm.name)}&sku=${encodeURIComponent(productForm.sku)}&barcode=${encodeURIComponent(productForm.barcode)}`));
  }

  async function addProduct() {
    try {
      await api("/api/products", { method: "POST", body: JSON.stringify({ ...productForm, barcode: productForm.barcode || null }) });
      toast({ type: "success", message: "Product added." });
      setProductForm({ name: "", sku: "", barcode: "", categoryId: categories[0]?.id ?? "", brand: "", publisher: "", author: "", grade: "", sellingPrice: 0, costPrice: 0, active: true });
      setDuplicates([]);
      await load();
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "Unable to add product" });
    }
  }

  function openEditor(row: Stock) {
    setEditingStock(row);
    setEditForm({
      name: row.product.name,
      sku: row.product.sku,
      barcode: row.product.barcode ?? "",
      categoryId: row.product.category.id,
      brand: row.product.brand ?? "",
      publisher: row.product.publisher ?? "",
      author: row.product.author ?? "",
      grade: row.product.grade ?? "",
      sellingPrice: Number(row.product.sellingPrice),
      costPrice: Number(row.product.costPrice),
      active: row.product.active,
      quantity: row.quantity,
      adjustmentReason: "",
      lowStockLevel: row.lowStockLevel
    });
  }

  function closeEditor() {
    setEditingStock(null);
    setEditForm(null);
  }

  async function saveInventoryItem(event: React.FormEvent) {
    event.preventDefault();
    if (!editingStock || !editForm || savingEdit) return;
    if (!Number.isInteger(editForm.lowStockLevel) || editForm.lowStockLevel < 0) {
      toast({ type: "error", message: "Low-stock level must be a whole number of zero or more." });
      return;
    }
    if (!Number.isInteger(editForm.quantity) || editForm.quantity < 0) {
      toast({ type: "error", message: "On-hand quantity must be a whole number of zero or more." });
      return;
    }
    if (editForm.quantity !== editingStock.quantity && editForm.adjustmentReason.trim().length < 3) {
      toast({ type: "error", message: "Enter a reason of at least 3 characters for the quantity adjustment." });
      return;
    }

    setSavingEdit(true);
    try {
      await api<Stock>(`/api/inventory/stock/${editingStock.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          product: {
            name: editForm.name,
            sku: editForm.sku,
            barcode: editForm.barcode.trim() || null,
            categoryId: editForm.categoryId,
            brand: editForm.brand.trim() || null,
            publisher: editForm.publisher.trim() || null,
            author: editForm.author.trim() || null,
            grade: editForm.grade.trim() || null,
            sellingPrice: editForm.sellingPrice,
            costPrice: editForm.costPrice,
            active: editForm.active
          },
          quantity: editForm.quantity,
          adjustmentReason: editForm.adjustmentReason,
          lowStockLevel: editForm.lowStockLevel
        })
      });
      toast({ type: "success", message: "Inventory item updated." });
      closeEditor();
      await load();
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "Unable to update inventory item" });
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) return <PagePreloader />;

  return (
    <section className="page">
      <div className="page-head"><h1>Inventory</h1><div className="button-row"><button onClick={() => downloadCsv("/api/reports/export/branch-stock", "branch-stock.csv")}>Export stock</button><button onClick={() => window.print()}>Print</button></div></div>
      {demoMode && <div className="demo-notice">Demo account: product creation and stock changes are disabled.</div>}
      {!demoMode && <form className="panel form-grid" onSubmit={(event) => { event.preventDefault(); void addProduct(); }}>
        <div className="form-section-heading"><h2>Add product</h2><span className="muted">Create the product record first, then record its opening stock below.</span></div>
        <label>Product name<input required placeholder="e.g. Atlas Chooty Blue Pen" value={productForm.name} onBlur={checkDuplicates} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label>
        <label>SKU<input required placeholder="e.g. STAT-ATL-PEN-BLUE" value={productForm.sku} onBlur={checkDuplicates} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} /></label>
        <label><span className="field-label">Barcode <span className="optional-mark">(optional)</span></span><input placeholder="Scan or enter barcode" value={productForm.barcode} onBlur={checkDuplicates} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} /></label>
        <label>Category<select value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="field-label">Brand <span className="optional-mark">(optional)</span></span><input placeholder="e.g. Atlas" value={productForm.brand} onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })} /></label>
        <label><span className="field-label">Publisher <span className="optional-mark">(optional)</span></span><input placeholder="e.g. Gunasena" value={productForm.publisher} onChange={(e) => setProductForm({ ...productForm, publisher: e.target.value })} /></label>
        <label><span className="field-label">Author <span className="optional-mark">(optional)</span></span><input placeholder="Author name" value={productForm.author} onChange={(e) => setProductForm({ ...productForm, author: e.target.value })} /></label>
        <label><span className="field-label">Grade <span className="optional-mark">(optional)</span></span><input placeholder="e.g. Grade 10" value={productForm.grade} onChange={(e) => setProductForm({ ...productForm, grade: e.target.value })} /></label>
        <label>Selling price (LKR)<input type="number" min="0" step="0.01" placeholder="0.00" value={productForm.sellingPrice} onChange={(e) => setProductForm({ ...productForm, sellingPrice: Number(e.target.value) })} /></label>
        <label>Cost price (LKR)<input type="number" min="0" step="0.01" placeholder="0.00" value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: Number(e.target.value) })} /></label>
        <button className="primary" type="submit">Add product</button>
        {duplicates.length > 0 && <div className="warning">Possible duplicate: {duplicates.map((item) => item.name).join(", ")}</div>}
      </form>}
      {!demoMode && <form className="panel form-grid" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="form-section-heading"><h2>Record stock movement</h2><span className="muted">Add stock, remove stock, or set the exact on-hand quantity.</span></div>
        <label>Branch<select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label>Product<select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Movement type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="STOCK_IN">Stock in — add quantity</option><option value="STOCK_OUT">Stock out — remove quantity</option><option value="ADJUSTMENT">Adjustment — set exact quantity</option></select></label>
        <label>{form.type === "ADJUSTMENT" ? "New on-hand quantity" : "Quantity"}<input type="number" min={form.type === "ADJUSTMENT" ? 0 : 1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
        <label>Reason<input required minLength={3} placeholder="Why is this stock changing?" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        <button className="primary" type="submit">Record movement</button>
      </form>}
      <div className="search"><input placeholder="Search stock by product, SKU, or branch" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="panel"><table><thead><tr><th>Product</th><th>Branch</th><th>Qty</th><th>Low level</th>{!demoMode && <th>Actions</th>}</tr></thead><tbody>{stock.filter((row) => `${row.product.name} ${row.product.sku} ${row.branch.name}`.toLowerCase().includes(search.toLowerCase())).map((row) => <tr key={row.id}><td><strong>{row.product.name}</strong><br /><span className="muted">{row.product.sku}</span></td><td>{row.branch.name}</td><td>{row.quantity}</td><td><span className={row.quantity <= row.lowStockLevel ? "stock-level low" : "stock-level"}>{row.lowStockLevel}</span></td>{!demoMode && <td><button type="button" onClick={() => openEditor(row)}><Pencil size={15} /> Edit</button></td>}</tr>)}</tbody></table></div>
      <div className="panel"><h2>Stock Movement History</h2><table><thead><tr><th>Date</th><th>Product</th><th>Branch</th><th>Type</th><th>Qty</th><th>Reason</th><th>Staff</th></tr></thead><tbody>{movements.map((row) => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.product.name}</td><td>{row.branch.name}</td><td>{row.type}</td><td>{row.quantity}</td><td>{row.reason}</td><td>{row.user?.name}</td></tr>)}</tbody></table></div>
      {editingStock && editForm && <div className="modal-backdrop no-print" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingEdit) closeEditor(); }}>
        <section className="modal-card inventory-editor" role="dialog" aria-modal="true" aria-labelledby="inventory-editor-title">
          <div className="modal-head"><div><h2 id="inventory-editor-title">Edit inventory item</h2><p>{editingStock.branch.name}. Product details apply across every branch; the low-stock level applies only to this branch.</p></div><button className="icon-button" type="button" aria-label="Close" disabled={savingEdit} onClick={closeEditor}><X size={18} /></button></div>
          <form className="modal-form" onSubmit={saveInventoryItem}>
            <div className="inventory-edit-grid">
              <label>Product name<input required minLength={2} maxLength={160} value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label>
              <label>SKU<input required minLength={2} maxLength={64} value={editForm.sku} onChange={(event) => setEditForm({ ...editForm, sku: event.target.value })} /></label>
              <label>Barcode<input maxLength={64} value={editForm.barcode} onChange={(event) => setEditForm({ ...editForm, barcode: event.target.value })} /></label>
              <label>Category<select required value={editForm.categoryId} onChange={(event) => setEditForm({ ...editForm, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label>Brand<input maxLength={120} value={editForm.brand} onChange={(event) => setEditForm({ ...editForm, brand: event.target.value })} /></label>
              <label>Publisher<input maxLength={120} value={editForm.publisher} onChange={(event) => setEditForm({ ...editForm, publisher: event.target.value })} /></label>
              <label>Author<input maxLength={160} value={editForm.author} onChange={(event) => setEditForm({ ...editForm, author: event.target.value })} /></label>
              <label>Grade<input maxLength={80} value={editForm.grade} onChange={(event) => setEditForm({ ...editForm, grade: event.target.value })} /></label>
              <label>Selling price<input required type="number" min="0" step="0.01" value={editForm.sellingPrice} onChange={(event) => setEditForm({ ...editForm, sellingPrice: Number(event.target.value) })} /></label>
              <label>Cost price<input required type="number" min="0" step="0.01" value={editForm.costPrice} onChange={(event) => setEditForm({ ...editForm, costPrice: Number(event.target.value) })} /></label>
              <label className="inventory-quantity">On-hand quantity for {editingStock.branch.name}<input required type="number" min="0" step="1" value={editForm.quantity} onChange={(event) => setEditForm({ ...editForm, quantity: Number(event.target.value) })} /><small>This sets the exact available quantity and records an adjustment in stock history.</small></label>
              <label className="inventory-threshold">Low-stock level for {editingStock.branch.name}<input required type="number" min="0" step="1" value={editForm.lowStockLevel} onChange={(event) => setEditForm({ ...editForm, lowStockLevel: Number(event.target.value) })} /><small>An alert is triggered when the on-hand quantity reaches this number or below.</small></label>
              <label className="inventory-adjustment-reason">Quantity adjustment reason {editForm.quantity !== editingStock.quantity && <span className="required-mark">Required</span>}<input required={editForm.quantity !== editingStock.quantity} minLength={editForm.quantity !== editingStock.quantity ? 3 : undefined} maxLength={240} placeholder="Required only when quantity changes" value={editForm.adjustmentReason} onChange={(event) => setEditForm({ ...editForm, adjustmentReason: event.target.value })} /><small>Current recorded quantity: {editingStock.quantity}</small></label>
              <label className="check inventory-active"><input type="checkbox" checked={editForm.active} onChange={(event) => setEditForm({ ...editForm, active: event.target.checked })} /> Product is active</label>
            </div>
            <div className="modal-actions"><button type="button" disabled={savingEdit} onClick={closeEditor}>Cancel</button><button className="primary" type="submit" disabled={savingEdit}>{savingEdit && <span className="button-spinner" aria-hidden="true" />}{savingEdit ? "Saving..." : "Save changes"}</button></div>
          </form>
        </section>
      </div>}
    </section>
  );
}

type ProductEditForm = {
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  brand: string;
  publisher: string;
  author: string;
  grade: string;
  sellingPrice: number;
  costPrice: number;
  active: boolean;
  quantity: number;
  adjustmentReason: string;
  lowStockLevel: number;
};
