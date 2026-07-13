import { DesiredItemRequest, Product } from "@prisma/client";
import { prisma } from "../db.js";
import { normalizeSriLankanPhone } from "./phone.js";
import { canSendStockAlert, createSmsNotification } from "./notifications.js";
import { getBusinessSettings, isDesiredItemSmsEnabled } from "./settings.js";

export async function findAndNotifyDesiredItemMatches(input: {
  product: Product;
  branchId: string;
  userId: string;
}) {
  const term = input.product.name.toLowerCase();
  const requests = await prisma.desiredItemRequest.findMany({
    where: {
      status: "OPEN",
      notifyBySms: true,
      OR: [
        { requestedItemName: { equals: input.product.name, mode: "insensitive" } },
        { requestedItemName: { contains: input.product.name, mode: "insensitive" } },
        { requestedItemName: { contains: input.product.sku, mode: "insensitive" } },
        input.product.barcode ? { requestedItemName: { contains: input.product.barcode, mode: "insensitive" } } : {},
        { matchedProductId: input.product.id }
      ]
    },
    include: { customer: true }
  });

  const partialMatches = requests.filter((request) => {
    const requested = request.requestedItemName.toLowerCase();
    return requested.includes(term) || term.includes(requested) || request.matchedProductId === input.product.id;
  });

  for (const request of partialMatches) {
    await createDesiredItemNotification(request, input.product, input.userId);
  }
}

export async function createDesiredItemNotification(request: DesiredItemRequest & { customer?: { notificationPreference: string } | null }, product: Product, userId?: string) {
  const phone = normalizeSriLankanPhone(request.phone);
  const settings = await getBusinessSettings();
  const preference = request.customer?.notificationPreference ?? "STOCK_ALERTS";
  const allowed = canSendStockAlert(preference);
  const needsApproval = settings.requireApprovalBeforeDesiredItemSms && !request.adminApproved;
  const sendNow = Boolean(phone && allowed && !needsApproval && await isDesiredItemSmsEnabled());

  const message = `Good news. ${product.name} is now available at ${settings.businessName}. Contact: ${settings.phone ?? ""}`.trim();
  const notification = await createSmsNotification({
    event: "desired_item_available",
    recipient: request.phone,
    message,
    customerId: request.customerId ?? undefined,
    desiredItemRequestId: request.id,
    createdById: userId,
    payload: { productId: product.id, requestedItemName: request.requestedItemName },
    sendNow
  });

  await prisma.desiredItemRequest.update({
    where: { id: request.id },
    data: {
      matchedProductId: product.id,
      branchId: request.branchId ?? undefined,
      status: sendNow ? "NOTIFIED" : "PENDING_REVIEW"
    }
  });

  return notification;
}
