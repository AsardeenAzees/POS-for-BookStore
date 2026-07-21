import { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "../db.js";
import { createSmsNotification } from "./notifications.js";
import { findAndNotifyDesiredItemMatches } from "./desiredItems.js";
import { getBusinessSettings } from "./settings.js";
import { HttpError } from "../middleware/errors.js";

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
  if (!Number.isInteger(input.quantity) || input.quantity < 0 || (input.type !== "ADJUSTMENT" && input.quantity === 0)) throw new HttpError(400, "Quantity must be positive");

  const result = await runSerializable(() => prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryStock.upsert({
      where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
      create: { branchId: input.branchId, productId: input.productId, quantity: 0 },
      update: {}
    });

    const afterQty = input.type === "ADJUSTMENT"
      ? input.quantity
      : existing.quantity + (input.type === "STOCK_IN" || input.type === "RETURN" ? input.quantity : -input.quantity);
    if (afterQty < 0) throw new HttpError(400, "Insufficient stock");

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
        quantity: input.type === "ADJUSTMENT" ? Math.abs(afterQty - existing.quantity) : input.quantity,
        beforeQty: existing.quantity,
        afterQty,
        reason: input.reason,
        reference: input.reference
      }
    });

    return { stock: updated, increased: afterQty > existing.quantity };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  const { stock, increased } = result;
  try {
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (increased && stock.quantity > 0 && product) {
      await findAndNotifyDesiredItemMatches({ product, branchId: input.branchId, userId: input.userId });
    }

    if (stock.quantity <= stock.lowStockLevel) {
      const settings = await getBusinessSettings();
      await createSmsNotification({
        event: "low_stock_alert",
        recipient: settings.phone ?? "",
        message: `Low stock: ${product?.name ?? input.productId} has ${stock.quantity} left.`,
        payload: { branchId: input.branchId, productId: input.productId, quantity: stock.quantity },
        createdById: input.userId,
        sendNow: settings.smsEnabled && settings.lowStockSmsAutoSend
      });
    }
  } catch (error) {
    console.error("[post-stock-notification]", { productId: input.productId, branchId: input.branchId, error: error instanceof Error ? error.message : String(error) });
  }
  return stock;
}

async function runSerializable<T>(operation: () => Promise<T>) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 3) continue;
      throw error;
    }
  }
  throw new HttpError(409, "Stock changed concurrently; please retry");
}
