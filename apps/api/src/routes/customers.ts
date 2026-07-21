import { Router } from "express";
import { NotificationPreference, RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { normalizeSriLankanPhone } from "../services/phone.js";

export const customersRouter = Router();

customersRouter.use(requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.CASHIER, RoleName.DEMO_VIEWER));

const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  whatsapp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notificationPreference: z.nativeEnum(NotificationPreference).default("INVOICE_ONLY")
});

customersRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "");
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : undefined,
    orderBy: { name: "asc" },
    take: 100
  });
  res.json({ data: customers });
});

customersRouter.get("/:id/history", async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { sales: { include: { items: { include: { product: true } }, payments: true }, orderBy: { createdAt: "desc" } } }
  });
  res.json({ data: customer });
});

customersRouter.post("/", async (req, res, next) => {
  try {
    const input = customerSchema.parse(req.body);
    const phone = normalizeSriLankanPhone(input.phone);
    const whatsapp = input.whatsapp ? normalizeSriLankanPhone(input.whatsapp) : null;
    if (!phone) return res.status(400).json({ error: "Invalid Sri Lankan mobile number" });
    if (input.whatsapp && !whatsapp) return res.status(400).json({ error: "Invalid Sri Lankan WhatsApp number" });
    res.status(201).json({ data: await prisma.customer.create({ data: { ...input, phone, whatsapp } }) });
  } catch (error) {
    next(error);
  }
});

customersRouter.patch("/:id/preference", async (req, res, next) => {
  try {
    const input = z.object({ notificationPreference: z.nativeEnum(NotificationPreference) }).parse(req.body);
    res.json({ data: await prisma.customer.update({ where: { id: req.params.id }, data: input }) });
  } catch (error) {
    next(error);
  }
});
