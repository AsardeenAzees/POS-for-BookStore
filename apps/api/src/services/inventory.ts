import { StockMovementType } from "@prisma/client";
import { prisma } from "../db.js";
import { createSmsNotification } from "./notifications.js";
import { findAndNotifyDesiredItemMatches } from "./desiredItems.js";
import { getBusinessSettings } from "./settings.js";

export async function changeStock(input: {
  branchId: string;
  productId: string;
  userId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  reference?: string;
}) {
  if (!input.reason?.trim()) throw new Error("Stock movement reason is required");
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be positive");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryStock.upsert({
      where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
      create: { branchId: input.branchId, productId: input.productId, quantity: 0 },
      update: {}
    });

    const signed = input.type === "STOCK_IN" || input.type === "RETURN" ? input.quantity : -input.quantity;
    const afterQty = existing.quantity + signed;
    if (afterQty < 0) throw new Error("Insufficient stock");

    const updated = await tx.inventoryStock.update({
      where: { id: existing.id },
      data: { quantity: afterQty }
    });

    await tx.stockMovement.create({
      data: {
        branchId: input.branchId,
        productId: input.productId,
        userId: input.userId,
        type: input.type,
        quantity: input.quantity,
        beforeQty: existing.quantity,
        afterQty,
        reason: input.reason,
        reference: input.reference
      }
    });

    return updated;
  }).then(async (stock) => {
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if ((input.type === "STOCK_IN" || input.type === "ADJUSTMENT") && stock.quantity > 0 && product) {
      await findAndNotifyDesiredItemMatches({ product, branchId: input.branchId, userId: input.userId });
    }

    if (stock.quantity <= stock.lowStockLevel) {
      const settings = await getBusinessSettings();
      await createSmsNotification({
        event: "low_stock_alert",
        recipient: settings.phone ?? "+94770000000",
        message: `Low stock: ${product?.name ?? input.productId} has ${stock.quantity} left.`,
        payload: { branchId: input.branchId, productId: input.productId, quantity: stock.quantity },
        createdById: input.userId,
        sendNow: settings.smsEnabled && settings.lowStockSmsAutoSend
      });
    }
    return stock;
  });
}
