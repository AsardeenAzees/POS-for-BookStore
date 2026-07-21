import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { branchScope, canAccessBranch, requireAuth, requireRoles } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { changeStock } from "../services/inventory.js";

export const inventoryRouter = Router();

const inventoryRoles = requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INVENTORY_STAFF);

inventoryRouter.get("/stock", requireAuth, inventoryRoles, async (req, res, next) => {
  const requestedBranchId = req.query.branchId ? String(req.query.branchId) : undefined;
  if (requestedBranchId && !canAccessBranch(req.user!, requestedBranchId)) return next(new HttpError(403, "You can only view stock for your assigned branch"));
  const branchId = requestedBranchId ?? branchScope(req.user!);
  const q = String(req.query.q ?? "");
  const rows = await prisma.inventoryStock.findMany({
    where: {
      branchId,
      product: q ? { name: { contains: q, mode: "insensitive" } } : undefined
    },
    include: { branch: true, product: { include: { category: true } } },
    orderBy: [{ branch: { name: "asc" } }, { product: { name: "asc" } }]
  });
  res.json({ data: rows });
});

inventoryRouter.get("/movements", requireAuth, inventoryRoles, async (req, res) => {
  const branchId = branchScope(req.user!);
  res.json({
    data: await prisma.stockMovement.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true, product: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  });
});

inventoryRouter.post("/movements", requireAuth, inventoryRoles, async (req, res, next) => {
  try {
    const input = z.object({
      branchId: z.string(),
      productId: z.string(),
      type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
      quantity: z.coerce.number().int().nonnegative(),
      reason: z.string().trim().min(3).max(240)
    }).parse(req.body);

    if (input.type !== "ADJUSTMENT" && input.quantity === 0) throw new HttpError(400, "Quantity must be positive");
    if (!canAccessBranch(req.user!, input.branchId)) throw new HttpError(403, "You can only change stock for your assigned branch");

    const data = await changeStock({ ...input, userId: req.user!.id });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});
