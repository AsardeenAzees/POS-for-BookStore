import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { branchScope, requireAuth, requireRoles } from "../middleware/auth.js";

export const productsRouter = Router();

const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  barcode: z.string().optional().nullable(),
  categoryId: z.string(),
  brand: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  author: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  sellingPrice: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative(),
  active: z.boolean().default(true)
});

const productReadRoles = requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.CASHIER, RoleName.INVENTORY_STAFF, RoleName.DEMO_VIEWER);

productsRouter.get("/", requireAuth, productReadRoles, async (req, res) => {
  const q = String(req.query.q ?? "");
  const branchId = branchScope(req.user!);
  const products = await prisma.product.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
            { author: { contains: q, mode: "insensitive" } },
            { publisher: { contains: q, mode: "insensitive" } }
          ]
        }
      : undefined,
    include: { category: true, inventory: { where: branchId ? { branchId } : undefined, include: { branch: true } } },
    orderBy: { name: "asc" },
    take: 100
  });
  res.json({ data: products });
});

productsRouter.get("/duplicate-check", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INVENTORY_STAFF), async (req, res) => {
  const name = String(req.query.name ?? "");
  const sku = String(req.query.sku ?? "");
  const barcode = String(req.query.barcode ?? "");
  const filters = [
    sku ? { sku: { equals: sku, mode: "insensitive" as const } } : null,
    barcode ? { barcode: { equals: barcode, mode: "insensitive" as const } } : null,
    name ? { name: { contains: name, mode: "insensitive" as const } } : null
  ].filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));
  if (!filters.length) return res.json({ data: [] });
  const matches = await prisma.product.findMany({
    where: { OR: filters },
    take: 10
  });
  res.json({ data: matches });
});

productsRouter.post("/", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INVENTORY_STAFF), async (req, res, next) => {
  try {
    const input = productSchema.parse(req.body);
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: input });
      const branches = await tx.branch.findMany({ where: { active: true } });
      await tx.inventoryStock.createMany({
        data: branches.map((branch) => ({ branchId: branch.id, productId: created.id, quantity: 0 })),
        skipDuplicates: true
      });
      return created;
    });
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});
