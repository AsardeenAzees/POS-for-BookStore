import "dotenv/config";
import { z } from "zod";

const envBoolean = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") return defaultValue;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
    return value;
  }, z.boolean());

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(24),
  JWT_EXPIRES_IN: z.string().default("12h"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SMS_PROVIDER: z.enum(["mock", "textlk"]).default("mock"),
  SMS_AUTO_SEND_INVOICE: envBoolean(false),
  SMS_AUTO_SEND_STOCK_ALERT: envBoolean(false),
  TEXTLK_API_BASE_URL: z.string().url().default("https://app.text.lk/api/v3"),
  TEXTLK_API_TOKEN: z.string().default(""),
  TEXTLK_SENDER_ID: z.string().default(""),
  TEXTLK_DRY_RUN: envBoolean(true),
  TEXTLK_SEND_ENDPOINT: z.string().default("sms/send"),
  TEXTLK_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  TEXTLK_RECIPIENT_FIELD: z.string().default("recipient"),
  TEXTLK_MESSAGE_FIELD: z.string().default("message"),
  TEXTLK_SENDER_FIELD: z.string().default("sender_id"),
  TEXTLK_TYPE_FIELD: z.string().default("type"),
  TEXTLK_MESSAGE_TYPE: z.string().default("plain"),
  TEXTLK_TOKEN_MODE: z.enum(["bearer", "query", "body", "none"]).default("bearer")
});

export const config = configSchema.parse(process.env);
