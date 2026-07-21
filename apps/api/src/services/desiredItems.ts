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
  const requests = await prisma.desiredItemRequest.findMany({
    where: {
      status: "OPEN",
      notifyBySms: true,
      AND: [
        { OR: [{ branchId: null }, { branchId: input.branchId }] },
        { OR: [
          { requestedItemName: { equals: input.product.name, mode: "insensitive" } },
          { requestedItemName: { contains: input.product.name, mode: "insensitive" } },
          { requestedItemName: { contains: input.product.sku, mode: "insensitive" } },
          ...(input.product.barcode ? [{ requestedItemName: { contains: input.product.barcode, mode: "insensitive" as const } }] : []),
          { matchedProductId: input.product.id }
        ] }
      ]
    },
    include: { customer: true }
  });

  const partialMatches = requests.filter((request) => {
    return isDesiredItemMatch(request.requestedItemName, input.product) || request.matchedProductId === input.product.id;
  });

  for (const request of partialMatches) {
    const claimed = await prisma.desiredItemRequest.updateMany({
      where: { id: request.id, status: "OPEN" },
      data: { matchedProductId: input.product.id, branchId: request.branchId ?? input.branchId, status: "PENDING_REVIEW" }
    });
    if (claimed.count === 1) {
      await createDesiredItemNotification({ ...request, matchedProductId: input.product.id, branchId: request.branchId ?? input.branchId, status: "PENDING_REVIEW" }, input.product, input.userId);
    }
  }
}

export function isDesiredItemMatch(requestedItemName: string, product: Pick<Product, "name" | "sku" | "barcode">) {
  const requested = requestedItemName.trim().toLowerCase();
  if (!requested) return false;
  const terms = [product.name, product.sku, product.barcode].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());
  return terms.some((value) => requested.includes(value) || value.includes(requested));
}

export async function createDesiredItemNotification(request: DesiredItemRequest & { customer?: { notificationPreference: string } | null }, product: Product, userId?: string, explicitApproval = false) {
  const phone = normalizeSriLankanPhone(request.phone);
  const settings = await getBusinessSettings();
  const preference = request.customer?.notificationPreference ?? "STOCK_ALERTS";
  const allowed = canSendStockAlert(preference);
  const needsApproval = settings.requireApprovalBeforeDesiredItemSms && !request.adminApproved;
  const autoSendEnabled = explicitApproval ? settings.smsEnabled : await isDesiredItemSmsEnabled();
  const sendNow = Boolean(phone && allowed && !needsApproval && autoSendEnabled);

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
      status: notification.status === "SENT" ? "NOTIFIED" : "PENDING_REVIEW"
    }
  });

  return notification;
}
