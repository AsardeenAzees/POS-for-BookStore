import { Router } from "express";
import { DesiredItemStatus, RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { normalizeSriLankanPhone } from "../services/phone.js";
import { createDesiredItemNotification } from "../services/desiredItems.js";
import { sendNotification } from "../services/notifications.js";

export const desiredItemsRouter = Router();

const desiredItemSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  phone: z.string().min(7),
  requestedItemName: z.string().min(2),
  matchedProductId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  notifyBySms: z.boolean().default(true),
  notifyByWhatsapp: z.boolean().default(false)
});

desiredItemsRouter.get("/", requireAuth, async (req, res) => {
  const status = req.query.status ? String(req.query.status) as DesiredItemStatus : undefined;
  res.json({
    data: await prisma.desiredItemRequest.findMany({
      where: { status },
      include: { customer: true, branch: true, matchedProduct: true, notifications: { orderBy: { createdAt: "desc" }, take: 3 } },
      orderBy: { createdAt: "desc" },
      take: 200
    })
  });
});

desiredItemsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const input = desiredItemSchema.parse(req.body);
    const phone = normalizeSriLankanPhone(input.phone);
    if (!phone) return res.status(400).json({ error: "Invalid Sri Lankan mobile number" });
    const data = await prisma.desiredItemRequest.create({
      data: { ...input, phone, createdById: req.user!.id }
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

desiredItemsRouter.post("/:id/approve-send", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (req, res, next) => {
  try {
    const request = await prisma.desiredItemRequest.update({
      where: { id: req.params.id },
      data: { adminApproved: true },
      include: { matchedProduct: true, customer: true }
    });
    if (!request.matchedProduct) return res.status(400).json({ error: "Request has no matched product yet" });
    const notification = await createDesiredItemNotification(request, request.matchedProduct, req.user!.id);
    const sent = notification.status === "PENDING" ? await sendNotification(notification.id) : notification;
    await prisma.desiredItemRequest.update({ where: { id: request.id }, data: { status: sent.status === "SENT" ? "NOTIFIED" : "PENDING_REVIEW" } });
    res.json({ data: sent });
  } catch (error) {
    next(error);
  }
});

desiredItemsRouter.patch("/:id/status", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (req, res, next) => {
  try {
    const input = z.object({ status: z.nativeEnum(DesiredItemStatus) }).parse(req.body);
    res.json({ data: await prisma.desiredItemRequest.update({ where: { id: req.params.id }, data: { status: input.status } }) });
  } catch (error) {
    next(error);
  }
});
