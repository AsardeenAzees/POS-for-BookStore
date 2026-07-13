import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

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

productsRouter.get("/", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "");
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
    include: { category: true, inventory: { include: { branch: true } } },
    orderBy: { name: "asc" },
    take: 100
  });
  res.json({ data: products });
});

productsRouter.get("/duplicate-check", requireAuth, async (req, res) => {
  const name = String(req.query.name ?? "");
  const sku = String(req.query.sku ?? "");
  const barcode = String(req.query.barcode ?? "");
  const matches = await prisma.product.findMany({
    where: {
      OR: [
        sku ? { sku: { equals: sku, mode: "insensitive" } } : {},
        barcode ? { barcode: { equals: barcode, mode: "insensitive" } } : {},
        name ? { name: { contains: name, mode: "insensitive" } } : {}
      ]
    },
    take: 10
  });
  res.json({ data: matches });
});

productsRouter.post("/", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.INVENTORY_STAFF), async (req, res, next) => {
  try {
    const input = productSchema.parse(req.body);
    const product = await prisma.product.create({ data: input });
    const branches = await prisma.branch.findMany();
    await prisma.inventoryStock.createMany({
      data: branches.map((branch) => ({ branchId: branch.id, productId: product.id, quantity: 0 })),
      skipDuplicates: true
    });
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});
