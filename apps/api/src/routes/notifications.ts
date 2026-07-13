import { Router } from "express";
import { NotificationEvent, RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { createSmsNotification, sendNotification } from "../services/notifications.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, async (_req, res) => {
  res.json({ data: await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { customer: true, sale: true, desiredItemRequest: true, createdBy: { select: { name: true, email: true } } } }) });
});

notificationsRouter.post("/sms", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (req, res, next) => {
  try {
    const input = z.object({
      event: z.nativeEnum(NotificationEvent),
      recipient: z.string().min(7),
      message: z.string().min(3),
      customerId: z.string().optional()
    }).parse(req.body);
    res.status(201).json({ data: await createSmsNotification({ ...input, createdById: req.user!.id, sendNow: true }) });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/:id/retry", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (req, res, next) => {
  try {
    res.json({ data: await sendNotification(req.params.id) });
  } catch (error) {
    next(error);
  }
});
