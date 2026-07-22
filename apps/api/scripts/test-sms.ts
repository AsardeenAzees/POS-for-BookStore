import "dotenv/config";
import { config } from "../src/config.js";
import { normalizeSriLankanPhone } from "../src/services/phone.js";
import { sendSmsDirect } from "../src/services/notifications.js";

const phone = process.argv[2] ?? "0758396064";
const message = process.argv.slice(3).join(" ").trim() || "POS SMS API test successful.";
const normalized = normalizeSriLankanPhone(phone);

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function main() {
  if (!normalized) {
    console.error(`Invalid Sri Lankan mobile number: ${phone}`);
    process.exitCode = 1;
    return;
  }

  console.log(`SMS provider: ${config.SMS_PROVIDER}`);
  console.log(`Text.lk dry run: ${config.TEXTLK_DRY_RUN}`);
  console.log(`Recipient: ${normalized}`);

  const result = await sendSmsDirect({
    provider: config.SMS_PROVIDER,
    to: normalized,
    message,
    senderId: config.TEXTLK_SENDER_ID || "TextLKDemo"
  });

  console.log("SMS result:");
  console.log(safeJson(result));

  if (result.status === "failed" || result.status === "skipped") {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "SMS test failed");
  process.exitCode = 1;
});
