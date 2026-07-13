import { Notification, NotificationChannel, NotificationEvent, NotificationStatus } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { maskPhone, normalizeSriLankanPhone } from "./phone.js";
import { getBusinessSettings } from "./settings.js";

export type SmsResult = {
  provider: "mock" | "textlk";
  status: "sent" | "failed" | "skipped" | "dry_run";
  providerMessageId?: string;
  errorMessage?: string;
  rawStatus?: string;
  safeResponse?: Record<string, unknown>;
};

export interface SmsProvider {
  name: "mock" | "textlk";
  sendSms(input: { to: string; message: string; senderId?: string | null }): Promise<SmsResult>;
}

export class MockSmsProvider implements SmsProvider {
  name = "mock" as const;

  async sendSms(input: { to: string; message: string }): Promise<SmsResult> {
    return {
      provider: this.name,
      status: "sent",
      providerMessageId: `mock-${Date.now()}-${input.to.slice(-4)}`,
      rawStatus: "mock_sent",
      safeResponse: { to: maskPhone(input.to), dryRun: false }
    };
  }
}

export class TextLkSmsProvider implements SmsProvider {
  name = "textlk" as const;

  async sendSms(input: { to: string; message: string; senderId?: string | null }): Promise<SmsResult> {
    if (config.TEXTLK_DRY_RUN) {
      return {
        provider: this.name,
        status: "dry_run",
        providerMessageId: `dry-run-${Date.now()}`,
        rawStatus: "dry_run",
        safeResponse: { to: maskPhone(input.to), endpoint: config.TEXTLK_SEND_ENDPOINT || "/", dryRun: true }
      };
    }

    if (!config.TEXTLK_API_TOKEN) {
      return { provider: this.name, status: "failed", errorMessage: "Text.lk API token is not configured", rawStatus: "missing_token" };
    }

    const endpoint = new URL(config.TEXTLK_SEND_ENDPOINT || "", config.TEXTLK_API_BASE_URL.endsWith("/") ? config.TEXTLK_API_BASE_URL : `${config.TEXTLK_API_BASE_URL}/`);
    const body: Record<string, string> = {
      [config.TEXTLK_RECIPIENT_FIELD]: input.to,
      [config.TEXTLK_MESSAGE_FIELD]: input.message,
      [config.TEXTLK_TYPE_FIELD]: config.TEXTLK_MESSAGE_TYPE
    };
    const senderId = input.senderId || config.TEXTLK_SENDER_ID;
    if (!senderId) {
      return { provider: this.name, status: "failed", errorMessage: "Text.lk sender_id is not configured", rawStatus: "missing_sender_id" };
    }
    if (senderId) body[config.TEXTLK_SENDER_FIELD] = senderId;
    if (config.TEXTLK_TOKEN_MODE === "body") body.token = config.TEXTLK_API_TOKEN;
    if (config.TEXTLK_TOKEN_MODE === "query") endpoint.searchParams.set("token", config.TEXTLK_API_TOKEN);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.TEXTLK_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
      if (config.TEXTLK_TOKEN_MODE === "bearer") headers.Authorization = `Bearer ${config.TEXTLK_API_TOKEN}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      const safeResponse = safeProviderResponse(response.status, text);
      if (!response.ok) {
        return { provider: this.name, status: "failed", errorMessage: `Text.lk HTTP ${response.status}`, rawStatus: String(response.status), safeResponse };
      }
      return { provider: this.name, status: "sent", providerMessageId: extractProviderId(text), rawStatus: String(response.status), safeResponse };
    } catch (error) {
      return { provider: this.name, status: "failed", errorMessage: error instanceof Error ? error.message : "Text.lk send failed", rawStatus: "exception" };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function buildSmsProvider(provider: string): SmsProvider {
  return provider === "textlk" ? new TextLkSmsProvider() : new MockSmsProvider();
}

export async function createSmsNotification(input: {
  event: NotificationEvent;
  recipient: string;
  message: string;
  customerId?: string;
  saleId?: string;
  desiredItemRequestId?: string;
  createdById?: string;
  payload?: object;
  sendNow?: boolean;
}) {
  const normalized = normalizeSriLankanPhone(input.recipient);
  const settings = await getBusinessSettings();
  const provider = buildSmsProvider(settings.smsProvider || config.SMS_PROVIDER);

  const created = await prisma.notification.create({
    data: {
      event: input.event,
      channel: NotificationChannel.SMS,
      recipient: normalized ?? input.recipient,
      message: input.message,
      customerId: input.customerId,
      saleId: input.saleId,
      desiredItemRequestId: input.desiredItemRequestId,
      createdById: input.createdById,
      payload: input.payload ?? {},
      provider: provider.name,
      status: normalized ? NotificationStatus.PENDING : NotificationStatus.SKIPPED,
      errorMessage: normalized ? undefined : "Invalid Sri Lankan mobile number",
      error: normalized ? undefined : "Invalid Sri Lankan mobile number"
    }
  });

  if (!normalized || !input.sendNow || !settings.smsEnabled) return created;
  return sendNotification(created.id);
}

export async function sendNotification(notificationId: string) {
  const notification = await prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
  const normalized = normalizeSriLankanPhone(notification.recipient);
  if (!normalized) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.SKIPPED, errorMessage: "Invalid Sri Lankan mobile number", error: "Invalid Sri Lankan mobile number" }
    });
  }

  const settings = await getBusinessSettings();
  if (!settings.smsEnabled) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.SKIPPED, errorMessage: "SMS is disabled in business settings", error: "SMS disabled" }
    });
  }

  const provider = buildSmsProvider(settings.smsProvider || config.SMS_PROVIDER);
  let result: SmsResult = { provider: provider.name, status: "failed", errorMessage: "Not attempted" };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    result = await provider.sendSms({ to: normalized, message: notification.message, senderId: settings.smsSenderId });
    if (result.status === "sent" || result.status === "dry_run") break;
  }

  const status = result.status === "sent" || result.status === "dry_run" ? NotificationStatus.SENT : NotificationStatus.FAILED;
  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      provider: result.provider,
      providerRef: result.providerMessageId,
      status,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      sentAt: status === NotificationStatus.SENT ? new Date() : undefined,
      error: result.errorMessage,
      errorMessage: result.errorMessage,
      providerResponse: JSON.parse(JSON.stringify({
        status: result.status,
        rawStatus: result.rawStatus,
        response: result.safeResponse ?? {}
      }))
    }
  });
}

export function canSendStockAlert(preference: string) {
  return preference === "STOCK_ALERTS" || preference === "MARKETING";
}

export function canSendInvoice(preference: string) {
  return preference !== "UNSUBSCRIBED";
}

function safeProviderResponse(status: number, text: string) {
  const trimmed = text.slice(0, 800);
  try {
    return { httpStatus: status, body: JSON.parse(trimmed) };
  } catch {
    return { httpStatus: status, body: trimmed };
  }
}

function extractProviderId(text: string) {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const id = parsed.id ?? parsed.message_id ?? parsed.reference ?? parsed.uid;
    return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
  } catch {
    return undefined;
  }
}

export function notificationToSmsStatus(notification: Notification) {
  if (notification.status === "SENT" && notification.providerResponse && typeof notification.providerResponse === "object") {
    const status = (notification.providerResponse as Record<string, unknown>).status;
    if (status === "dry_run") return "dry_run";
  }
  return notification.status.toLowerCase();
}
