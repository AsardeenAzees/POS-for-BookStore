import { Router } from "express";
import { RoleName, StockMovementType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { changeStock } from "../services/inventory.js";

export const inventoryRouter = Router();

inventoryRouter.get("/stock", requireAuth, async (req, res) => {
  const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
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

inventoryRouter.get("/movements", requireAuth, async (_req, res) => {
  res.json({
    data: await prisma.stockMovement.findMany({
      include: { branch: true, product: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  });
});

inventoryRouter.post("/movements", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INVENTORY_STAFF), async (req, res, next) => {
  try {
    const input = z.object({
      branchId: z.string(),
      productId: z.string(),
      type: z.nativeEnum(StockMovementType),
      quantity: z.coerce.number().int().positive(),
      reason: z.string().min(3)
    }).parse(req.body);

    const data = await changeStock({ ...input, userId: req.user!.id });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});
