import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { api, getSession } from "../lib/api";
import type { Branch, Customer, Product, Sale } from "../lib/types";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";

type CartItem = { product: Product; quantity: number; discount: number };

export function POS() {
  const navigate = useNavigate();
  const toast = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.product.sellingPrice) * item.quantity - item.discount, 0), [cart]);
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    void Promise.all([api<Branch[]>("/api/branches"), api<Customer[]>("/api/customers"), api<Product[]>("/api/products")])
      .then(([branchRows, customerRows, productRows]) => {
        setBranches(branchRows);
        setBranchId(getSession()?.user.branch?.id ?? branchRows[0]?.id ?? "");
        setCustomers(customerRows);
        setProducts(productRows);
      })
      .catch((error) => toast({ type: "error", message: error instanceof Error ? error.message : "Unable to load POS data" }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    const handle = setTimeout(() => void api<Product[]>(`/api/products?q=${encodeURIComponent(q)}`).then(setProducts).catch(() => undefined), 150);
    return () => clearTimeout(handle);
  }, [q]);

  function add(product: Product) {
    const available = availableStock(product, branchId);
    if (available < 1) return toast({ type: "error", message: `${product.name} is out of stock at this branch.` });
    setCart((items) => {
      const found = items.find((item) => item.product.id === product.id);
      if (found?.quantity === available) return items;
      return found ? items.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(available, item.quantity + 1) } : item) : [...items, { product, quantity: 1, discount: 0 }];
    });
  }

  async function checkout(paymentMethod: "CASH" | "DIGITAL") {
    try {
      setCheckingOut(true);
      const created = await api<Sale>("/api/sales", {
        method: "POST",
        body: JSON.stringify({ branchId, customerId: customerId || null, discount, paymentMethod, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, discount: item.discount })) })
      });
      setCart([]);
      setDiscount(0);
      toast({ type: "success", message: `Sale completed: ${created.invoiceNumber}` });
      navigate(`/sales/${created.id}/receipt`);
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "Checkout failed" });
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) return <section className="page"><div className="empty-state">Loading POS...</div></section>;

  return (
    <section className="page pos-grid">
      <div className="panel pos-products">
        <div className="toolbar">
          <label>Branch<select value={branchId} onChange={(event) => { setBranchId(event.target.value); setCart([]); }}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Walk-in</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label>
        </div>
        <div className="search"><Search size={18} /><input autoFocus placeholder="Search by name, SKU, barcode, author" value={q} onChange={(event) => setQ(event.target.value)} /></div>
        <div className="product-list">{products.length ? products.map((product) => { const available = availableStock(product, branchId); return <button key={product.id} disabled={available < 1} onClick={() => add(product)}><strong>{product.name}</strong><span>{product.sku} · LKR {Number(product.sellingPrice).toLocaleString()} · {available} in stock</span></button>; }) : <div className="empty-state">No products found</div>}</div>
      </div>
      <div className="panel cart">
        <h2>Cart</h2>
        {cart.length === 0 && <div className="empty-state">Scan or select a product to begin.</div>}
        {cart.map((item) => (
          <div className="cart-row" key={item.product.id}>
            <div><strong>{item.product.name}</strong><span>LKR {Number(item.product.sellingPrice).toLocaleString()}</span></div>
            <div className="qty-control"><button onClick={() => setCart(cart.map((row) => row.product.id === item.product.id ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row))}><Minus size={14} /></button><input type="number" min="1" max={availableStock(item.product, branchId)} value={item.quantity} onChange={(event) => setCart(cart.map((row) => row.product.id === item.product.id ? { ...row, quantity: Math.max(1, Math.min(availableStock(row.product, branchId), Number(event.target.value) || 1)) } : row))} /><button disabled={item.quantity >= availableStock(item.product, branchId)} onClick={() => setCart(cart.map((row) => row.product.id === item.product.id ? { ...row, quantity: Math.min(availableStock(row.product, branchId), row.quantity + 1) } : row))}><Plus size={14} /></button></div>
            <button className="icon-button" title="Remove item" onClick={() => setCart(cart.filter((row) => row.product.id !== item.product.id))}><Trash2 size={16} /></button>
          </div>
        ))}
        <label>Bill discount<input type="number" min="0" max={subtotal} value={discount} onChange={(event) => setDiscount(Math.max(0, Math.min(subtotal, Number(event.target.value) || 0)))} /></label>
        <div className="totals"><span>Subtotal LKR {subtotal.toLocaleString()}</span><strong>Total LKR {total.toLocaleString()}</strong></div>
        <div className="actions"><button disabled={!cart.length || checkingOut || !branchId} className="primary" onClick={() => void checkout("CASH")}>{checkingOut ? "Processing..." : "Cash"}</button><button disabled={!cart.length || checkingOut || !branchId} onClick={() => void checkout("DIGITAL")}>Digital</button></div>
      </div>
    </section>
  );
}

function availableStock(product: Product, branchId: string) {
  return product.inventory?.find((row) => row.branch.id === branchId)?.quantity ?? 0;
}
