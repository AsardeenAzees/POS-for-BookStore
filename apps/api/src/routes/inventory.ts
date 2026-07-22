import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { branchScope, canAccessBranch, requireAuth, requireRoles } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { changeStock, createLowStockAlert } from "../services/inventory.js";
import { findAndNotifyDesiredItemMatches } from "../services/desiredItems.js";
import { inventoryItemUpdateSchema } from "../validation/inventory.js";

export const inventoryRouter = Router();

const inventoryRoles = requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INVENTORY_STAFF, RoleName.DEMO_VIEWER);

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

inventoryRouter.patch("/stock/:id", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INVENTORY_STAFF), async (req, res, next) => {
  try {
    const input = inventoryItemUpdateSchema.parse(req.body);
    const existing = await prisma.inventoryStock.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Inventory item not found");
    if (!canAccessBranch(req.user!, existing.branchId)) throw new HttpError(403, "You can only change stock settings for your assigned branch");
    const quantityChanged = input.quantity !== existing.quantity;
    if (quantityChanged && input.adjustmentReason.length < 3) throw new HttpError(400, "A reason of at least 3 characters is required when changing quantity");

    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: existing.productId }, data: input.product });
      const changed = await tx.inventoryStock.updateMany({
        where: { id: existing.id, quantity: existing.quantity },
        data: { quantity: input.quantity, lowStockLevel: input.lowStockLevel }
      });
      if (changed.count !== 1) throw new HttpError(409, "Stock changed while you were editing. Refresh and try again.");
      if (quantityChanged) {
        await tx.stockMovement.create({
          data: {
            branchId: existing.branchId,
            productId: existing.productId,
            userId: req.user!.id,
            type: "ADJUSTMENT",
            quantity: Math.abs(input.quantity - existing.quantity),
            beforeQty: existing.quantity,
            afterQty: input.quantity,
            reason: input.adjustmentReason
          }
        });
      }
      return tx.inventoryStock.findUniqueOrThrow({
        where: { id: existing.id },
        include: { branch: true, product: { include: { category: true } } }
      });
    });

    try {
      if (quantityChanged && updated.quantity > existing.quantity && updated.quantity > 0) {
        await findAndNotifyDesiredItemMatches({ product: updated.product, branchId: updated.branchId, userId: req.user!.id });
      }
      await createLowStockAlert({
        branchId: updated.branchId,
        productId: updated.productId,
        productName: updated.product.name,
        quantity: updated.quantity,
        lowStockLevel: updated.lowStockLevel,
        userId: req.user!.id
      });
    } catch (error) {
      console.error("[post-inventory-edit-notification]", { stockId: updated.id, error: error instanceof Error ? error.message : String(error) });
    }
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
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
