import { Router } from "express";
import { DesiredItemStatus, RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { branchScope, canAccessBranch, requireAuth, requireRoles } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { normalizeSriLankanPhone } from "../services/phone.js";
import { createDesiredItemNotification } from "../services/desiredItems.js";

export const desiredItemsRouter = Router();

const desiredItemSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  phone: z.string().min(7),
  requestedItemName: z.string().min(2),
  branchId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  notifyBySms: z.boolean().default(true),
  notifyByWhatsapp: z.boolean().default(false)
});

const desiredReadRoles = requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.CASHIER, RoleName.INVENTORY_STAFF, RoleName.DEMO_VIEWER);

desiredItemsRouter.get("/", requireAuth, desiredReadRoles, async (req, res) => {
  const status = req.query.status ? String(req.query.status) as DesiredItemStatus : undefined;
  const branchId = branchScope(req.user!);
  res.json({
    data: await prisma.desiredItemRequest.findMany({
      where: { status, ...(branchId ? { branchId } : {}) },
      include: { customer: true, branch: true, matchedProduct: true, notifications: { orderBy: { createdAt: "desc" }, take: 3 } },
      orderBy: { createdAt: "desc" },
      take: 200
    })
  });
});

desiredItemsRouter.post("/", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.CASHIER), async (req, res, next) => {
  try {
    const input = desiredItemSchema.parse(req.body);
    const phone = normalizeSriLankanPhone(input.phone);
    if (!phone) return res.status(400).json({ error: "Invalid Sri Lankan mobile number" });
    const branchId = input.branchId ?? req.user!.branchId;
    if (!branchId) throw new HttpError(400, "Branch is required");
    if (!canAccessBranch(req.user!, branchId)) throw new HttpError(403, "You can only create requests for your assigned branch");
    const data = await prisma.desiredItemRequest.create({
      data: { ...input, branchId, phone, createdById: req.user!.id }
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

desiredItemsRouter.post("/:id/approve-send", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (req, res, next) => {
  try {
    const existing = await prisma.desiredItemRequest.findUnique({ where: { id: req.params.id }, include: { matchedProduct: true, customer: true } });
    if (!existing || !canAccessBranch(req.user!, existing.branchId)) throw new HttpError(404, "Desired item request not found");
    if (!existing.matchedProduct) throw new HttpError(400, "Request has no matched product yet");
    if (["CLOSED", "CANCELLED", "SPAM", "NOTIFIED"].includes(existing.status)) throw new HttpError(409, "Request is already finalized");
    const request = await prisma.desiredItemRequest.update({
      where: { id: existing.id },
      data: { adminApproved: true, status: "PENDING_REVIEW" },
      include: { matchedProduct: true, customer: true }
    });
    const notification = await createDesiredItemNotification(request, request.matchedProduct!, req.user!.id, true);
    res.json({ data: notification });
  } catch (error) {
    next(error);
  }
});

desiredItemsRouter.patch("/:id/status", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (req, res, next) => {
  try {
    const input = z.object({ status: z.nativeEnum(DesiredItemStatus) }).parse(req.body);
    if (!["CLOSED", "CANCELLED", "SPAM"].includes(input.status)) throw new HttpError(400, "Only close, cancel, or spam transitions are allowed here");
    const existing = await prisma.desiredItemRequest.findUnique({ where: { id: req.params.id } });
    if (!existing || !canAccessBranch(req.user!, existing.branchId)) throw new HttpError(404, "Desired item request not found");
    if (["CLOSED", "CANCELLED", "SPAM"].includes(existing.status)) throw new HttpError(409, "Request is already finalized");
    res.json({ data: await prisma.desiredItemRequest.update({ where: { id: existing.id }, data: { status: input.status } }) });
  } catch (error) {
    next(error);
  }
});
