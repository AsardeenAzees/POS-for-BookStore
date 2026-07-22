import "dotenv/config";
import { config } from "../src/config.js";
import { sendSmsDirect } from "../src/services/notifications.js";
import { normalizeSriLankanPhone } from "../src/services/phone.js";

const inputPhone = process.argv[2];
const message = process.argv.slice(3).join(" ").trim() || "POS SMS API test successful.";

function printResult(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  if (!inputPhone) {
    console.error("Usage: npm run test:textlk-sms --workspace @pos/api -- 0758396064 [optional message]");
    process.exitCode = 1;
    return;
  }

  const recipient = normalizeSriLankanPhone(inputPhone);
  if (!recipient) {
    console.error("Invalid Sri Lankan mobile number. Use 07XXXXXXXX, +947XXXXXXXX, or 947XXXXXXXX.");
    process.exitCode = 1;
    return;
  }

  console.log(`Text.lk mode: ${config.TEXTLK_DRY_RUN ? "dry-run (no SMS will be sent)" : "live"}`);
  console.log(`Endpoint: ${config.TEXTLK_API_BASE_URL.replace(/\/+$/, "")}/${config.TEXTLK_SEND_ENDPOINT.replace(/^\/+/, "")}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Sender ID: ${config.TEXTLK_SENDER_ID}`);

  const result = await sendSmsDirect({
    provider: "textlk",
    to: recipient,
    message,
    senderId: config.TEXTLK_SENDER_ID
  });

  console.log("Text.lk result:");
  printResult(result);

  if (result.status === "failed" || result.status === "skipped") process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Text.lk SMS test failed");
  process.exitCode = 1;
});
