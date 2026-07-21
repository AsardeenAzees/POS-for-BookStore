export type PricedSaleItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export function calculateSaleTotals(items: PricedSaleItem[], saleDiscount: number) {
  const lines = items.map((item) => {
    const gross = item.quantity * item.unitPrice;
    if (item.discount > gross) throw new Error("Line discount cannot exceed the line value");
    return { ...item, total: gross - item.discount };
  });
  const subtotal = lines.reduce((sum, item) => sum + item.total, 0);
  if (saleDiscount > subtotal) throw new Error("Bill discount cannot exceed the subtotal");
  return { lines, subtotal, total: subtotal - saleDiscount };
}
