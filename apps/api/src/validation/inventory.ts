import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sku: z.string().trim().min(2).max(64),
  barcode: optionalText(64),
  categoryId: z.string().trim().min(1),
  brand: optionalText(120),
  publisher: optionalText(120),
  author: optionalText(160),
  grade: optionalText(80),
  imageUrl: z.string().url().max(2_048).optional().nullable(),
  sellingPrice: z.coerce.number().nonnegative().max(1_000_000_000),
  costPrice: z.coerce.number().nonnegative().max(1_000_000_000),
  active: z.boolean().default(true)
});

export const inventoryItemUpdateSchema = z.object({
  product: productSchema,
  quantity: z.coerce.number().int().nonnegative().max(1_000_000_000),
  lowStockLevel: z.coerce.number().int().nonnegative().max(1_000_000),
  adjustmentReason: z.string().trim().max(240).optional().default("")
});
