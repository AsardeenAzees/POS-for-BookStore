import assert from "node:assert/strict";
import test from "node:test";
import { RoleName } from "@prisma/client";
import { branchScope, canAccessBranch, DEMO_READ_ONLY_MESSAGE, enforceDemoReadOnly, type AuthUser } from "./auth.js";

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

test("demo viewer has global branch visibility for read-only screens", () => {
  assert.equal(branchScope(user(RoleName.DEMO_VIEWER, null)), undefined);
  assert.equal(canAccessBranch(user(RoleName.DEMO_VIEWER, null), "kdy"), true);
});

test("demo viewer mutations return the read-only 403 response", () => {
  let statusCode: number | undefined;
  let responseBody: unknown;
  let nextCalled = false;
  const request = { method: "POST", user: user(RoleName.DEMO_VIEWER, null) } as Parameters<typeof enforceDemoReadOnly>[0];
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    }
  } as unknown as Parameters<typeof enforceDemoReadOnly>[1];

  enforceDemoReadOnly(request, response, () => { nextCalled = true; });

  assert.equal(statusCode, 403);
  assert.deepEqual(responseBody, { error: DEMO_READ_ONLY_MESSAGE });
  assert.equal(responseBody && (responseBody as { error: string }).error, "Demo account is read-only. This action is disabled.");
  assert.equal(nextCalled, false);
});

test("demo viewer GET requests continue to read handlers", () => {
  let nextCalled = false;
  const request = { method: "GET", user: user(RoleName.DEMO_VIEWER, null) } as Parameters<typeof enforceDemoReadOnly>[0];
  enforceDemoReadOnly(request, {} as Parameters<typeof enforceDemoReadOnly>[1], () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
