import assert from "node:assert/strict";
import test from "node:test";
import { isDesiredItemMatch } from "./desiredItems.js";

const product = { name: "Master Guide Grade 10 Mathematics", sku: "BOOK-MG-MATH-G10", barcode: "4791001000010" };

test("matches desired items by name, SKU, or barcode", () => {
  assert.equal(isDesiredItemMatch("Master Guide Grade 10 Mathematics", product), true);
  assert.equal(isDesiredItemMatch("BOOK-MG-MATH-G10", product), true);
  assert.equal(isDesiredItemMatch("4791001000010", product), true);
});

test("does not match unrelated desired items", () => {
  assert.equal(isDesiredItemMatch("Blue school bag", product), false);
});
