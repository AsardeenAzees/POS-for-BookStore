import assert from "node:assert/strict";
import test from "node:test";
import { calculateSaleTotals } from "./sales.js";

test("calculates server-priced line and bill totals", () => {
  const result = calculateSaleTotals([{ productId: "p1", quantity: 2, unitPrice: 100, discount: 10 }], 20);
  assert.deepEqual(result, { lines: [{ productId: "p1", quantity: 2, unitPrice: 100, discount: 10, total: 190 }], subtotal: 190, total: 170 });
});

test("rejects discounts beyond the sale value", () => {
  assert.throws(() => calculateSaleTotals([{ productId: "p1", quantity: 1, unitPrice: 100, discount: 101 }], 0), /Line discount/);
  assert.throws(() => calculateSaleTotals([{ productId: "p1", quantity: 1, unitPrice: 100, discount: 0 }], 101), /Bill discount/);
});
