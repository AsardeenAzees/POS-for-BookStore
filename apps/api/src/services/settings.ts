import { config } from "../config.js";
import { prisma } from "../db.js";

export async function getBusinessSettings() {
  return prisma.businessSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      smsProvider: config.SMS_PROVIDER,
      invoiceSmsAutoSend: config.SMS_AUTO_SEND_INVOICE,
      desiredItemSmsAutoSend: config.SMS_AUTO_SEND_STOCK_ALERT,
      lowStockSmsAutoSend: config.SMS_AUTO_SEND_STOCK_ALERT,
      textlkTokenConfigured: Boolean(config.TEXTLK_API_TOKEN)
    }
  });
}

export async function isInvoiceSmsEnabled() {
  const settings = await getBusinessSettings();
  return settings.smsEnabled && settings.invoiceSmsAutoSend;
}

export async function isDesiredItemSmsEnabled() {
  const settings = await getBusinessSettings();
  return settings.smsEnabled && settings.desiredItemSmsAutoSend;
}
