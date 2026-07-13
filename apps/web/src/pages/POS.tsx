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
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.product.sellingPrice) * item.quantity - item.discount, 0), [cart]);
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    void api<Branch[]>("/api/branches").then((data) => { setBranches(data); setBranchId(getSession()?.user.branch?.id ?? data[0]?.id ?? ""); });
    void api<Customer[]>("/api/customers").then(setCustomers);
    void api<Product[]>("/api/products").then(setProducts);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => void api<Product[]>(`/api/products?q=${encodeURIComponent(q)}`).then(setProducts), 150);
    return () => clearTimeout(handle);
  }, [q]);

  function add(product: Product) {
    setCart((items) => {
      const found = items.find((item) => item.product.id === product.id);
      return found ? items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { product, quantity: 1, discount: 0 }];
    });
  }

  async function checkout(paymentMethod: "CASH" | "DIGITAL") {
    try {
      const created = await api<Sale>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          customerId: customerId || null,
          discount,
          paymentMethod,
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, unitPrice: Number(item.product.sellingPrice), discount: item.discount }))
        })
      });
      setCart([]);
      setDiscount(0);
      toast({ type: "success", message: `Sale completed: ${created.invoiceNumber}` });
      navigate(`/sales/${created.id}/receipt`);
    } catch (error) {
      toast({ type: "error", message: error instanceof Error ? error.message : "Checkout failed" });
    }
  }

  return (
    <section className="page pos-grid">
      <div className="panel pos-products">
        <div className="toolbar">
          <label>Branch<select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label>Customer<select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Walk-in</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label>
        </div>
        <div className="search"><Search size={18} /><input autoFocus placeholder="Search by name, SKU, barcode, author" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="product-list">{products.length ? products.map((product) => <button key={product.id} onClick={() => add(product)}><strong>{product.name}</strong><span>{product.sku} · LKR {Number(product.sellingPrice).toLocaleString()}</span></button>) : <div className="empty-state">No products found</div>}</div>
      </div>
      <div className="panel cart">
        <h2>Cart</h2>
        {cart.map((item) => (
          <div className="cart-row" key={item.product.id}>
            <div><strong>{item.product.name}</strong><span>LKR {Number(item.product.sellingPrice).toLocaleString()}</span></div>
            <div className="qty-control"><button onClick={() => setCart(cart.map((row) => row.product.id === item.product.id ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row))}><Minus size={14} /></button><input type="number" min="1" value={item.quantity} onChange={(e) => setCart(cart.map((row) => row.product.id === item.product.id ? { ...row, quantity: Number(e.target.value) } : row))} /><button onClick={() => setCart(cart.map((row) => row.product.id === item.product.id ? { ...row, quantity: row.quantity + 1 } : row))}><Plus size={14} /></button></div>
            <button className="icon-button" onClick={() => setCart(cart.filter((row) => row.product.id !== item.product.id))}><Trash2 size={16} /></button>
          </div>
        ))}
        <label>Bill discount<input type="number" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>
        <div className="totals"><span>Subtotal LKR {subtotal.toLocaleString()}</span><strong>Total LKR {total.toLocaleString()}</strong></div>
        <div className="actions"><button disabled={!cart.length} className="primary" onClick={() => void checkout("CASH")}>Cash</button><button disabled={!cart.length} onClick={() => void checkout("DIGITAL")}>Digital</button></div>
      </div>
    </section>
  );
}
