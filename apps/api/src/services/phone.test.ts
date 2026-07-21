import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSriLankanPhone } from "./phone.js";

test("normalizes supported Sri Lankan mobile formats", () => {
  assert.equal(normalizeSriLankanPhone("0758396064"), "94758396064");
  assert.equal(normalizeSriLankanPhone("+94758396064"), "94758396064");
  assert.equal(normalizeSriLankanPhone("94758396064"), "94758396064");
});

test("rejects non-mobile and malformed numbers", () => {
  assert.equal(normalizeSriLankanPhone("0112500000"), null);
  assert.equal(normalizeSriLankanPhone("9475839606"), null);
  assert.equal(normalizeSriLankanPhone(""), null);
});
