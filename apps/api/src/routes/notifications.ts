import { Router } from "express";
import rateLimit from "express-rate-limit";
import { NotificationEvent, RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { branchScope, requireAuth, requireRoles } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { canSendInvoice, canSendStockAlert, createSmsNotification, notificationToSmsStatus, retryNotification } from "../services/notifications.js";

export const notificationsRouter = Router();
const smsActionLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

notificationsRouter.get("/", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (req, res) => {
  const branchId = branchScope(req.user!);
  const rows = await prisma.notification.findMany({
    where: branchId ? { OR: [{ sale: { branchId } }, { desiredItemRequest: { branchId } }, { createdBy: { branchId } }] } : undefined,
    orderBy: { createdAt: "desc" }, take: 200,
    include: { customer: true, sale: true, desiredItemRequest: true, createdBy: { select: { name: true, email: true } } }
  });
  res.json({ data: rows.map((row) => ({ ...row, smsStatus: notificationToSmsStatus(row) })) });
});

notificationsRouter.post("/sms", smsActionLimiter, requireAuth, requireRoles(RoleName.ADMIN), async (req, res, next) => {
  try {
    const input = z.object({
      event: z.nativeEnum(NotificationEvent),
      recipient: z.string().min(7),
      message: z.string().min(3),
      customerId: z.string().optional()
    }).parse(req.body);
    if (input.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new HttpError(404, "Customer not found");
      const allowed = input.event === "desired_item_available" ? canSendStockAlert(customer.notificationPreference) : canSendInvoice(customer.notificationPreference);
      if (!allowed) throw new HttpError(400, "Customer notification preference does not allow this SMS");
    }
    res.status(201).json({ data: await createSmsNotification({ ...input, createdById: req.user!.id, sendNow: true }) });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/:id/retry", smsActionLimiter, requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (req, res, next) => {
  try {
    const branchId = branchScope(req.user!);
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, ...(branchId ? { OR: [{ sale: { branchId } }, { desiredItemRequest: { branchId } }, { createdBy: { branchId } }] } : {}) }
    });
    if (!notification) throw new HttpError(404, "Notification not found");
    res.json({ data: await retryNotification(notification.id) });
  } catch (error) {
    next(error);
  }
});
