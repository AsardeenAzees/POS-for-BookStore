import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../config.js";
import { TextLkSmsProvider } from "./notifications.js";

test("Text.lk provider uses the verified API v3 Bearer request", async () => {
  const originalFetch = globalThis.fetch;
  const original = {
    baseUrl: config.TEXTLK_API_BASE_URL,
    endpoint: config.TEXTLK_SEND_ENDPOINT,
    token: config.TEXTLK_API_TOKEN,
    senderId: config.TEXTLK_SENDER_ID,
    dryRun: config.TEXTLK_DRY_RUN,
    messageType: config.TEXTLK_MESSAGE_TYPE
  };
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  config.TEXTLK_API_BASE_URL = "https://app.text.lk/api/v3";
  config.TEXTLK_SEND_ENDPOINT = "/sms/send";
  config.TEXTLK_API_TOKEN = "unit-test-token";
  config.TEXTLK_SENDER_ID = "TextLKDemo";
  config.TEXTLK_DRY_RUN = false;
  config.TEXTLK_MESSAGE_TYPE = "plain";
  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({
      status: "success",
      message: "Your message was successfully delivered",
      data: { uid: "test-uid", to: "94758396064", from: "TextLKDemo", status: "Delivered", cost: "1", sms_count: 1 }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await new TextLkSmsProvider().sendSms({
      to: "0758396064",
      senderId: "TextLKDemo",
      message: "POS SMS API test successful."
    });

    assert.equal(capturedUrl, "https://app.text.lk/api/v3/sms/send");
    assert.equal(capturedInit?.method, "POST");
    assert.deepEqual(capturedInit?.headers, {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer unit-test-token"
    });
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      recipient: "94758396064",
      sender_id: "TextLKDemo",
      type: "plain",
      message: "POS SMS API test successful."
    });
    assert.equal(result.status, "sent");
    assert.equal(result.providerMessageId, "test-uid");
    assert.equal(result.rawStatus, "Delivered");
  } finally {
    globalThis.fetch = originalFetch;
    config.TEXTLK_API_BASE_URL = original.baseUrl;
    config.TEXTLK_SEND_ENDPOINT = original.endpoint;
    config.TEXTLK_API_TOKEN = original.token;
    config.TEXTLK_SENDER_ID = original.senderId;
    config.TEXTLK_DRY_RUN = original.dryRun;
    config.TEXTLK_MESSAGE_TYPE = original.messageType;
  }
});
