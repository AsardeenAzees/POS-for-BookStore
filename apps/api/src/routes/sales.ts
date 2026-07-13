import { Router } from "express";
import { PaymentMethod, RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { buildInvoiceSms, makeInvoiceNumber } from "../services/invoices.js";
import { canSendInvoice, createSmsNotification, sendNotification } from "../services/notifications.js";
import { getBusinessSettings, isInvoiceSmsEnabled } from "../services/settings.js";

export const salesRouter = Router();

const saleSchema = z.object({
  branchId: z.string(),
  customerId: z.string().optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).default("CASH"),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    discount: z.coerce.number().min(0).default(0)
  })).min(1)
});

salesRouter.get("/", requireAuth, async (_req, res) => {
  res.json({
    data: await prisma.sale.findMany({
      include: { branch: true, customer: true, user: { select: { name: true } }, items: { include: { product: true } }, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  });
});

salesRouter.get("/:id", requireAuth, async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { branch: true, customer: true, user: { select: { name: true } }, items: { include: { product: true } }, payments: true }
  });
  res.json({ data: sale });
});

salesRouter.get("/:id/receipt", requireAuth, async (req, res) => {
  const [sale, settings] = await Promise.all([
    prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { branch: true, customer: true, user: { select: { name: true } }, items: { include: { product: true } }, payments: true, notifications: true }
    }),
    getBusinessSettings()
  ]);
  res.json({ data: { sale, settings } });
});

salesRouter.post("/:id/send-invoice-sms", requireAuth, requireRoles(RoleName.ADMIN), async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { branch: true, customer: true, payments: true }
    });
    if (!sale.customer?.phone) return res.status(400).json({ error: "Sale has no customer phone number" });
    if (!canSendInvoice(sale.customer.notificationPreference)) return res.status(400).json({ error: "Customer is unsubscribed" });
    const settings = await getBusinessSettings();
    const message = buildInvoiceSms({
      businessName: settings.businessName,
      invoiceNumber: sale.invoiceNumber,
      total: Number(sale.total),
      paymentMethod: sale.payments[0]?.method ?? "CASH",
      contact: settings.phone
    });
    const notification = await createSmsNotification({
      event: "invoice_created",
      recipient: sale.customer.phone,
      message,
      customerId: sale.customer.id,
      saleId: sale.id,
      createdById: req.user!.id,
      payload: { invoiceNumber: sale.invoiceNumber, total: Number(sale.total) },
      sendNow: true
    });
    const sent = notification.status === "PENDING" ? await sendNotification(notification.id) : notification;
    res.json({ data: sent });
  } catch (error) {
    next(error);
  }
});

salesRouter.post("/", requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.CASHIER), async (req, res, next) => {
  try {
    const input = saleSchema.parse(req.body);
    const branch = await prisma.branch.findUniqueOrThrow({ where: { id: input.branchId } });
    const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
    const total = Math.max(0, subtotal - input.discount);
    const countToday = await prisma.sale.count({
      where: { branchId: input.branchId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
    });
    const invoiceNumber = makeInvoiceNumber(branch.code, countToday + 1);

    const sale = await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const stock = await tx.inventoryStock.findUnique({
          where: { branchId_productId: { branchId: input.branchId, productId: item.productId } }
        });
        if (!stock || stock.quantity < item.quantity) throw new Error("Insufficient stock for one or more products");
      }

      const created = await tx.sale.create({
        data: {
          invoiceNumber,
          branchId: input.branchId,
          customerId: input.customerId ?? undefined,
          userId: req.user!.id,
          subtotal,
          discount: input.discount,
          total,
          digitalReceipt: { invoiceNumber, source: "POS", items: input.items, total },
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.quantity * item.unitPrice - item.discount
            }))
          },
          payments: { create: { method: input.paymentMethod, amount: total, status: input.paymentMethod === "DIGITAL" ? "PENDING" : "PAID" } }
        },
        include: { items: { include: { product: true } }, customer: true, branch: true, payments: true }
      });

      for (const item of input.items) {
        const stock = await tx.inventoryStock.findUniqueOrThrow({
          where: { branchId_productId: { branchId: input.branchId, productId: item.productId } }
        });
        await tx.inventoryStock.update({ where: { id: stock.id }, data: { quantity: stock.quantity - item.quantity } });
        await tx.stockMovement.create({
          data: {
            branchId: input.branchId,
            productId: item.productId,
            userId: req.user!.id,
            type: "SALE",
            quantity: item.quantity,
            beforeQty: stock.quantity,
            afterQty: stock.quantity - item.quantity,
            reason: `Sale ${invoiceNumber}`,
            reference: created.id
          }
        });
      }

      return created;
    });

    if (sale.customer?.phone && canSendInvoice(sale.customer.notificationPreference)) {
      const settings = await getBusinessSettings();
      const message = buildInvoiceSms({
        businessName: settings.businessName,
        invoiceNumber,
        total,
        paymentMethod: sale.payments[0]?.method ?? input.paymentMethod,
        contact: settings.phone
      });
      await createSmsNotification({
        event: "invoice_created",
        recipient: sale.customer.phone,
        message,
        customerId: sale.customer.id,
        saleId: sale.id,
        createdById: req.user!.id,
        payload: { invoiceNumber, total },
        sendNow: await isInvoiceSmsEnabled()
      });
    }

    res.status(201).json({ data: sale });
  } catch (error) {
    next(error);
  }
});
