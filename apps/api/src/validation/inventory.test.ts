import assert from "node:assert/strict";
import test from "node:test";
import { inventoryItemUpdateSchema, productSchema } from "./inventory.js";

const validProduct = {
  name: "Atlas Chooty Blue Pen",
  sku: "PEN-001",
  barcode: null,
  categoryId: "category-1",
  brand: "Atlas",
  publisher: null,
  author: null,
  grade: null,
  sellingPrice: 50,
  costPrice: 35,
  active: true
};

test("product validation trims identifiers and accepts valid prices", () => {
  const result = productSchema.parse({ ...validProduct, name: "  Atlas Pen  ", sku: " PEN-002 " });
  assert.equal(result.name, "Atlas Pen");
  assert.equal(result.sku, "PEN-002");
});

test("inventory item update accepts zero as a valid quantity and low-stock threshold", () => {
  const result = inventoryItemUpdateSchema.parse({ product: validProduct, quantity: 0, lowStockLevel: 0 });
  assert.equal(result.quantity, 0);
  assert.equal(result.lowStockLevel, 0);
});

test("inventory item update rejects invalid quantities and thresholds", () => {
  assert.equal(inventoryItemUpdateSchema.safeParse({ product: validProduct, quantity: -1, lowStockLevel: 5 }).success, false);
  assert.equal(inventoryItemUpdateSchema.safeParse({ product: validProduct, quantity: 10, lowStockLevel: -1 }).success, false);
  assert.equal(inventoryItemUpdateSchema.safeParse({ product: validProduct, quantity: 2.5, lowStockLevel: 5 }).success, false);
  assert.equal(inventoryItemUpdateSchema.safeParse({ product: validProduct, quantity: 10, lowStockLevel: 2.5 }).success, false);
});
