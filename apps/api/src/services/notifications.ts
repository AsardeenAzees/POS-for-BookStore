import { Notification, NotificationChannel, NotificationEvent, NotificationStatus } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { maskPhone, normalizeSriLankanPhone } from "./phone.js";
import { getBusinessSettings } from "./settings.js";
import { HttpError } from "../middleware/errors.js";

export type SmsResult = {
  provider: "mock" | "textlk";
  status: "sent" | "failed" | "skipped" | "dry_run";
  providerMessageId?: string;
  errorMessage?: string;
  rawStatus?: string;
  recipient?: string;
  senderId?: string;
  smsCount?: number;
  cost?: string;
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
      status: "dry_run",
      providerMessageId: `mock-${Date.now()}-${input.to.slice(-4)}`,
      rawStatus: "mock_dry_run",
      safeResponse: {
        dryRun: true,
        payload: {
          recipient: input.to,
          type: "plain",
          message: input.message
        }
      }
    };
  }
}

export class TextLkSmsProvider implements SmsProvider {
  name = "textlk" as const;

  async sendSms(input: { to: string; message: string; senderId?: string | null }): Promise<SmsResult> {
    const normalizedRecipient = normalizeSriLankanPhone(input.to);
    if (!normalizedRecipient) {
      return {
        provider: this.name,
        status: "skipped",
        errorMessage: "Invalid Sri Lankan mobile number",
        rawStatus: "invalid_phone"
      };
    }
    const senderId = process.env.TEXTLK_SENDER_ID?.trim() || input.senderId || config.TEXTLK_SENDER_ID || "TextLKDemo";

    if (config.TEXTLK_DRY_RUN) {
      return {
        provider: this.name,
        status: "dry_run",
        providerMessageId: `dry-run-${Date.now()}`,
        rawStatus: "dry_run",
        recipient: normalizedRecipient,
        senderId,
        safeResponse: {
          endpoint: textLkSendUrl(),
          dryRun: true,
          authentication: config.TEXTLK_API_TOKEN ? "Bearer token configured" : "Bearer token not configured",
          payload: {
            recipient: normalizedRecipient,
            sender_id: senderId,
            type: config.TEXTLK_MESSAGE_TYPE || "plain",
            message: input.message
          }
        }
      };
    }

    if (!config.TEXTLK_API_TOKEN) {
      return { provider: this.name, status: "failed", errorMessage: "Text.lk API token is not configured", rawStatus: "missing_token" };
    }

    const endpoint = textLkSendUrl();
    if (!senderId) {
      return { provider: this.name, status: "failed", errorMessage: "Text.lk sender_id is required. Add an approved Sender ID in Settings.", rawStatus: "missing_sender_id" };
    }

    const body: Record<string, string> = {
      recipient: normalizedRecipient,
      sender_id: senderId,
      type: config.TEXTLK_MESSAGE_TYPE || "plain",
      message: input.message
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.TEXTLK_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
      headers.Authorization = `Bearer ${config.TEXTLK_API_TOKEN}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      const safeResponse = safeProviderResponse(response.status, text);
      const responseData = textLkResponseData(safeResponse);
      if (!response.ok) {
        return {
          provider: this.name,
          status: "failed",
          errorMessage: textLkErrorMessage(text, `Text.lk HTTP ${response.status}`),
          rawStatus: responseData.rawStatus ?? textLkStatus(safeResponse) ?? String(response.status),
          recipient: responseData.recipient ?? normalizedRecipient,
          senderId: responseData.senderId ?? senderId,
          smsCount: responseData.smsCount,
          cost: responseData.cost,
          safeResponse
        };
      }
      const gatewayStatus = textLkStatus(safeResponse);
      if (gatewayStatus !== "success") {
        return {
          provider: this.name,
          status: "failed",
          errorMessage: textLkErrorMessage(text, "Text.lk rejected the SMS request"),
          rawStatus: responseData.rawStatus ?? gatewayStatus ?? String(response.status),
          recipient: responseData.recipient ?? normalizedRecipient,
          senderId: responseData.senderId ?? senderId,
          smsCount: responseData.smsCount,
          cost: responseData.cost,
          safeResponse
        };
      }
      return {
        provider: this.name,
        status: "sent",
        providerMessageId: responseData.providerMessageId,
        rawStatus: responseData.rawStatus ?? gatewayStatus,
        recipient: responseData.recipient ?? normalizedRecipient,
        senderId: responseData.senderId ?? senderId,
        smsCount: responseData.smsCount,
        cost: responseData.cost,
        safeResponse
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return {
        provider: this.name,
        status: "failed",
        errorMessage: timedOut ? "Text.lk request timed out" : "Unable to reach Text.lk",
        rawStatus: timedOut ? "timeout" : "exception",
        recipient: normalizedRecipient,
        senderId
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function buildSmsProvider(provider: string): SmsProvider {
  return provider === "textlk" ? new TextLkSmsProvider() : new MockSmsProvider();
}

function effectiveSmsProvider(settingsProvider: string) {
  // An explicit deployment-level Text.lk setting must not be shadowed by an older
  // database row that still contains the original "mock" default. Admin Settings
  // can also opt into Text.lk while the environment remains on its safe mock default.
  return config.SMS_PROVIDER === "textlk" || settingsProvider === "textlk" ? "textlk" : "mock";
}

export async function sendSmsDirect(input: { provider?: "mock" | "textlk"; to: string; message: string; senderId?: string | null }) {
  const normalized = normalizeSriLankanPhone(input.to);
  if (!normalized) {
    return {
      provider: input.provider ?? config.SMS_PROVIDER,
      status: "skipped" as const,
      errorMessage: "Invalid Sri Lankan mobile number",
      rawStatus: "invalid_phone",
      safeResponse: { input: maskPhone(input.to) }
    };
  }
  const provider = buildSmsProvider(input.provider ?? config.SMS_PROVIDER);
  return provider.sendSms({ to: normalized, message: input.message, senderId: input.senderId });
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
  provider?: "mock" | "textlk";
}) {
  const normalized = normalizeSriLankanPhone(input.recipient);
  const settings = await getBusinessSettings();
  const provider = buildSmsProvider(input.provider ?? effectiveSmsProvider(settings.smsProvider));

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
  if (notification.status === NotificationStatus.SENT || notification.status === NotificationStatus.SKIPPED) {
    throw new HttpError(409, "Notification is already finalized");
  }
  const normalized = normalizeSriLankanPhone(notification.recipient);
  if (!normalized) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.SKIPPED, errorMessage: "Invalid Sri Lankan mobile number", error: "Invalid Sri Lankan mobile number" }
    });
  }

  const settings = await getBusinessSettings();
  if (notification.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: notification.customerId } });
    const allowed = notification.event === "desired_item_available"
      ? canSendStockAlert(customer?.notificationPreference ?? "UNSUBSCRIBED")
      : canSendInvoice(customer?.notificationPreference ?? "UNSUBSCRIBED");
    if (!allowed) {
      return prisma.notification.update({
        where: { id: notificationId },
        data: { status: NotificationStatus.SKIPPED, errorMessage: "Customer notification preference does not allow this SMS", error: "Preference blocked" }
      });
    }
  }
  if (!settings.smsEnabled) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.SKIPPED, errorMessage: "SMS is disabled in business settings", error: "SMS disabled" }
    });
  }

  // Use the provider captured when the notification was created. This keeps test
  // sends and retries deterministic even if settings change between both steps.
  const provider = buildSmsProvider(notification.provider);
  let result: SmsResult = { provider: provider.name, status: "failed", errorMessage: "Not attempted" };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    result = await provider.sendSms({ to: normalized, message: notification.message, senderId: settings.smsSenderId });
    if (result.status === "sent" || result.status === "dry_run") break;
  }

  const status = result.status === "sent" || result.status === "dry_run" ? NotificationStatus.SENT : NotificationStatus.FAILED;
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      provider: result.provider,
      providerRef: result.providerMessageId,
      recipient: result.recipient ?? normalized,
      status,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      sentAt: status === NotificationStatus.SENT ? new Date() : undefined,
      error: result.errorMessage,
      errorMessage: result.errorMessage,
      providerResponse: JSON.parse(JSON.stringify({
        status: result.status,
        rawStatus: result.rawStatus,
        recipient: result.recipient,
        senderId: result.senderId,
        smsCount: result.smsCount,
        cost: result.cost,
        response: redactProviderValue(result.safeResponse ?? {})
      }))
    }
  });
  void prisma.auditLog.create({
    data: {
      userId: notification.createdById,
      action: status === NotificationStatus.SENT ? "NOTIFICATION_SENT" : "NOTIFICATION_FAILED",
      entity: "notification",
      entityId: notification.id,
      metadata: { event: notification.event, provider: result.provider, status }
    }
  }).catch(() => undefined);
  return updated;
}

export async function retryNotification(notificationId: string) {
  const claimed = await prisma.notification.updateMany({
    where: { id: notificationId, status: NotificationStatus.FAILED },
    data: { status: NotificationStatus.PENDING, error: null, errorMessage: null }
  });
  if (claimed.count !== 1) throw new HttpError(409, "Only one failed notification can be retried at a time");
  return sendNotification(notificationId);
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
    return { httpStatus: status, body: redactProviderValue(JSON.parse(trimmed)) };
  } catch {
    return { httpStatus: status, body: maskConfiguredToken(trimmed) };
  }
}

function redactProviderValue(value: unknown, key = ""): unknown {
  const normalized = key.toLowerCase();
  if (["token", "authorization", "secret", "password", "recipient", "phone", "message"].some((name) => normalized.includes(name))) return "[masked]";
  if (Array.isArray(value)) return value.map((item) => redactProviderValue(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, item]) => [childKey, redactProviderValue(item, childKey)]));
  return value;
}

function textLkStatus(safeResponse: Record<string, unknown>) {
  const body = safeResponse.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const status = (body as Record<string, unknown>).status;
    return typeof status === "string" ? status.toLowerCase() : undefined;
  }
  return undefined;
}

function textLkErrorMessage(responseText: string, fallback: string) {
  try {
    const record = JSON.parse(responseText.slice(0, 2000)) as Record<string, unknown>;
    const message = record.message ?? record.error;
    if (typeof message === "string" && message.trim()) {
      return maskConfiguredToken(message).slice(0, 240);
    }
  } catch {
    // Non-JSON provider errors use the safe HTTP fallback below.
  }
  return fallback;
}

function textLkResponseData(safeResponse: Record<string, unknown>) {
  const body = asRecord(safeResponse.body);
  const data = asRecord(body?.data);
  return {
    providerMessageId: stringValue(data?.uid),
    rawStatus: stringValue(data?.status),
    recipient: stringValue(data?.to),
    senderId: stringValue(data?.from),
    smsCount: numberValue(data?.sms_count),
    cost: stringValue(data?.cost)
  };
}

function textLkSendUrl() {
  const base = config.TEXTLK_API_BASE_URL.replace(/\/+$/, "");
  const endpoint = config.TEXTLK_SEND_ENDPOINT.replace(/^\/+/, "");
  return `${base}/${endpoint}`;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function maskConfiguredToken(value: string) {
  const bearerMasked = value.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [masked]");
  return config.TEXTLK_API_TOKEN
    ? bearerMasked.replaceAll(config.TEXTLK_API_TOKEN, "[masked]")
    : bearerMasked;
}

export function notificationToSmsStatus(notification: Notification) {
  if (notification.status === "SENT" && notification.providerResponse && typeof notification.providerResponse === "object") {
    const status = (notification.providerResponse as Record<string, unknown>).status;
    if (status === "dry_run") return "dry_run";
  }
  return notification.status.toLowerCase();
}
