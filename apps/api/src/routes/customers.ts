import { Router } from "express";
import { NotificationPreference } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const customersRouter = Router();

const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  whatsapp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notificationPreference: z.nativeEnum(NotificationPreference).default("INVOICE_ONLY")
});

customersRouter.get("/", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "");
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : undefined,
    orderBy: { name: "asc" },
    take: 100
  });
  res.json({ data: customers });
});

customersRouter.get("/:id/history", requireAuth, async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { sales: { include: { items: { include: { product: true } }, payments: true }, orderBy: { createdAt: "desc" } } }
  });
  res.json({ data: customer });
});

customersRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    res.status(201).json({ data: await prisma.customer.create({ data: customerSchema.parse(req.body) }) });
  } catch (error) {
    next(error);
  }
});

customersRouter.patch("/:id/preference", requireAuth, async (req, res, next) => {
  try {
    const input = z.object({ notificationPreference: z.nativeEnum(NotificationPreference) }).parse(req.body);
    res.json({ data: await prisma.customer.update({ where: { id: req.params.id }, data: input }) });
  } catch (error) {
    next(error);
  }
});
