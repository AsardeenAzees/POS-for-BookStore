import assert from "node:assert/strict";
import test from "node:test";
import { RoleName } from "@prisma/client";
import { branchScope, canAccessBranch, type AuthUser } from "./auth.js";

const user = (role: RoleName, branchId: string | null): AuthUser => ({ id: "user", email: "user@example.test", role, branchId });

test("administrator has global branch access", () => {
  assert.equal(branchScope(user(RoleName.ADMIN, "cmb")), undefined);
  assert.equal(canAccessBranch(user(RoleName.ADMIN, "cmb"), "kdy"), true);
});

test("branch roles are limited to their assigned branch", () => {
  assert.equal(branchScope(user(RoleName.MANAGER, "cmb")), "cmb");
  assert.equal(canAccessBranch(user(RoleName.CASHIER, "cmb"), "cmb"), true);
  assert.equal(canAccessBranch(user(RoleName.CASHIER, "cmb"), "kdy"), false);
});
