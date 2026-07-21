import { Router } from "express";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { maskSecret } from "../services/phone.js";
import { getBusinessSettings } from "../services/settings.js";
import { createSmsNotification, notificationToSmsStatus, sendNotification } from "../services/notifications.js";

export const settingsRouter = Router();

settingsRouter.get("/", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER), async (_req, res) => {
  const settings = await getBusinessSettings();
  res.json({ data: publicSettings(settings) });
});

settingsRouter.put("/", requireAuth, requireRoles(RoleName.ADMIN), async (req, res, next) => {
  try {
    const input = z.object({
      businessName: z.string().min(2),
      address: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      taxRegistration: z.string().optional().nullable(),
      receiptFooterText: z.string().min(1),
      defaultCurrency: z.string().default("LKR"),
      smsEnabled: z.boolean(),
      smsProvider: z.enum(["mock", "textlk"]),
      invoiceSmsAutoSend: z.boolean(),
      desiredItemSmsAutoSend: z.boolean(),
      lowStockSmsAutoSend: z.boolean().default(false),
      requireApprovalBeforeDesiredItemSms: z.boolean(),
      lowStockThresholdDefault: z.coerce.number().int().positive(),
      smsSenderId: z.string().optional().nullable()
    }).parse(req.body);

    const data = await prisma.businessSettings.upsert({
      where: { id: "singleton" },
      update: { ...input, textlkTokenConfigured: Boolean(config.TEXTLK_API_TOKEN) },
      create: { id: "singleton", ...input, textlkTokenConfigured: Boolean(config.TEXTLK_API_TOKEN) }
    });
    res.json({ data: publicSettings(data) });
  } catch (error) {
    next(error);
  }
});

function publicSettings(settings: Awaited<ReturnType<typeof getBusinessSettings>>) {
  return {
    ...settings,
    smsSenderId: settings.smsSenderId ?? config.TEXTLK_SENDER_ID,
    textlkApiTokenStatus: maskSecret(config.TEXTLK_API_TOKEN),
    textlkTokenConfigured: Boolean(config.TEXTLK_API_TOKEN)
  };
}

settingsRouter.post("/test-sms", requireAuth, requireRoles(RoleName.ADMIN), async (req, res, next) => {
  try {
    const input = z.object({ phone: z.string().min(7), message: z.string().min(3).default("POS test SMS") }).parse(req.body);
    const notification = await createSmsNotification({
      event: "invoice_created",
      recipient: input.phone,
      message: input.message,
      createdById: req.user!.id,
      sendNow: true
    });
    const sent = notification.status === "PENDING" ? await sendNotification(notification.id) : notification;
    const smsStatus = notificationToSmsStatus(sent);
    if (sent.status === "FAILED" || sent.status === "SKIPPED") {
      return res.status(400).json({ data: sent, error: sent.errorMessage ?? sent.error ?? "SMS failed" });
    }
    res.json({ data: { ...sent, smsStatus } });
  } catch (error) {
    next(error);
  }
});
