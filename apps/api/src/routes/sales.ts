import { Router } from "express";
import { PaymentMethod, Prisma, RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { branchScope, canAccessBranch, requireAuth, requireRoles } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { buildInvoiceSms, makeInvoiceNumber } from "../services/invoices.js";
import { canSendInvoice, createSmsNotification, notificationToSmsStatus, sendNotification } from "../services/notifications.js";
import { calculateSaleTotals } from "../services/sales.js";
import { getBusinessSettings, isInvoiceSmsEnabled } from "../services/settings.js";
import { normalizeSriLankanPhone } from "../services/phone.js";

export const salesRouter = Router();

const saleSchema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).default("CASH"),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    discount: z.coerce.number().min(0).default(0)
  })).min(1)
}).superRefine((input, context) => {
  const ids = new Set<string>();
  input.items.forEach((item, index) => {
    if (ids.has(item.productId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["items", index, "productId"], message: "Each product can appear only once per sale" });
    ids.add(item.productId);
  });
});

const salesRoles = requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.CASHIER, RoleName.DEMO_VIEWER);

salesRouter.get("/", requireAuth, salesRoles, async (req, res) => {
  const branchId = branchScope(req.user!);
  res.json({
    data: await prisma.sale.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true, customer: true, user: { select: { name: true } }, items: { include: { product: true } }, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  });
});

salesRouter.get("/:id", requireAuth, salesRoles, async (req, res, next) => {
  try {
    const sale = await findAccessibleSale(req.params.id, req.user!, false);
    res.json({ data: sale });
  } catch (error) {
    next(error);
  }
});

salesRouter.get("/:id/receipt", requireAuth, salesRoles, async (req, res, next) => {
  try {
    const [sale, settings] = await Promise.all([findAccessibleSale(req.params.id, req.user!, true), getBusinessSettings()]);
    res.json({ data: { sale, settings } });
  } catch (error) {
    next(error);
  }
});

salesRouter.post("/:id/send-invoice-sms", requireAuth, requireRoles(RoleName.ADMIN), async (req, res, next) => {
  try {
    const input = z.object({
      phone: z.string().trim().max(30).optional(),
      customerName: z.string().trim().max(120).optional()
    }).parse(req.body ?? {});
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: req.params.id }, include: { branch: true, customer: true, payments: true } });
    const savedPhone = sale.customer?.phone ? normalizeSriLankanPhone(sale.customer.phone) : null;
    const suppliedPhone = input.phone ? normalizeSriLankanPhone(input.phone) : null;
    if (input.phone && !suppliedPhone) throw new HttpError(400, "Invalid Sri Lankan mobile number");
    if (!savedPhone && !suppliedPhone) throw new HttpError(400, "Customer phone number is required");

    const customer = savedPhone
      ? sale.customer!
      : await saveAndLinkWalkInContact(sale.id, sale.customer, suppliedPhone!, input.customerName);
    const recipient = savedPhone ?? suppliedPhone!;
    if (!canSendInvoice(customer.notificationPreference)) throw new HttpError(400, "Customer is unsubscribed");
    const settings = await getBusinessSettings();
    const notification = await createSmsNotification({
      event: "invoice_created",
      recipient,
      message: buildInvoiceSms({ businessName: settings.businessName, invoiceNumber: sale.invoiceNumber, total: Number(sale.total), paymentMethod: sale.payments[0]?.method ?? "CASH", contact: settings.phone }),
      customerId: customer.id,
      saleId: sale.id,
      createdById: req.user!.id,
      payload: { invoiceNumber: sale.invoiceNumber, total: Number(sale.total) },
      sendNow: true
    });
    const sent = notification.status === "PENDING" ? await sendNotification(notification.id) : notification;
    const smsStatus = notificationToSmsStatus(sent);
    const message = smsStatus === "dry_run"
      ? "Invoice SMS logged successfully in dry-run mode."
      : smsStatus === "sent"
        ? "Invoice SMS sent successfully."
        : smsStatus === "failed"
          ? `Invoice SMS failed. The customer contact was saved.${sent.errorMessage ? ` ${sent.errorMessage}` : ""}`
          : `Invoice SMS was not sent${sent.errorMessage ? `: ${sent.errorMessage}` : "."}`;
    res.json({ message, data: { ...sent, smsStatus, message } });
  } catch (error) {
    next(error);
  }
});

salesRouter.post("/", requireAuth, salesRoles, async (req, res, next) => {
  try {
    const input = saleSchema.parse(req.body);
    if (!canAccessBranch(req.user!, input.branchId)) throw new HttpError(403, "You can only create sales for your assigned branch");

    const sale = await runSerializable(async () => prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({ where: { id: input.branchId } });
      if (!branch?.active) throw new HttpError(400, "Branch is not active");

      const products = await tx.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) }, active: true } });
      if (products.length !== input.items.length) throw new HttpError(400, "One or more products are missing or inactive");
      const prices = new Map(products.map((product) => [product.id, Number(product.sellingPrice)]));
      const totals = calculateSaleTotals(input.items.map((item) => ({ ...item, unitPrice: prices.get(item.productId)! })), input.discount);

      const now = new Date();
      const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const sequence = await tx.invoiceSequence.upsert({
        where: { branchId_dateKey: { branchId: branch.id, dateKey } },
        create: { branchId: branch.id, dateKey, lastValue: 1 },
        update: { lastValue: { increment: 1 } }
      });
      const invoiceNumber = makeInvoiceNumber(branch.code, sequence.lastValue);

      const stocks = new Map<string, { id: string; quantity: number }>();
      for (const item of totals.lines) {
        const stock = await tx.inventoryStock.findUnique({ where: { branchId_productId: { branchId: branch.id, productId: item.productId } } });
        if (!stock || stock.quantity < item.quantity) throw new HttpError(400, "Insufficient stock for one or more products");
        stocks.set(item.productId, stock);
      }

      const created = await tx.sale.create({
        data: {
          invoiceNumber,
          branchId: branch.id,
          customerId: input.customerId ?? undefined,
          userId: req.user!.id,
          subtotal: totals.subtotal,
          discount: input.discount,
          total: totals.total,
          digitalReceipt: { invoiceNumber, source: "POS", items: totals.lines, total: totals.total },
          items: { create: totals.lines.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, total: item.total })) },
          payments: { create: { method: input.paymentMethod, amount: totals.total, status: input.paymentMethod === "DIGITAL" ? "PENDING" : "PAID" } }
        },
        include: { items: { include: { product: true } }, customer: true, branch: true, payments: true }
      });

      for (const item of totals.lines) {
        const stock = stocks.get(item.productId)!;
        const changed = await tx.inventoryStock.updateMany({ where: { id: stock.id, quantity: { gte: item.quantity } }, data: { quantity: { decrement: item.quantity } } });
        if (changed.count !== 1) throw new HttpError(400, "Insufficient stock for one or more products");
        await tx.stockMovement.create({ data: { branchId: branch.id, productId: item.productId, userId: req.user!.id, type: "SALE", quantity: item.quantity, beforeQty: stock.quantity, afterQty: stock.quantity - item.quantity, reason: `Sale ${invoiceNumber}`, reference: created.id } });
      }
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    if (sale.customer?.phone && canSendInvoice(sale.customer.notificationPreference)) {
      try {
        const settings = await getBusinessSettings();
        await createSmsNotification({
          event: "invoice_created",
          recipient: sale.customer.phone,
          message: buildInvoiceSms({ businessName: settings.businessName, invoiceNumber: sale.invoiceNumber, total: Number(sale.total), paymentMethod: sale.payments[0]?.method ?? input.paymentMethod, contact: settings.phone }),
          customerId: sale.customer.id,
          saleId: sale.id,
          createdById: req.user!.id,
          payload: { invoiceNumber: sale.invoiceNumber, total: Number(sale.total) },
          sendNow: await isInvoiceSmsEnabled()
        });
      } catch (error) {
        console.error("[post-sale-notification]", { saleId: sale.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    res.status(201).json({ data: sale });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("discount") || error.message.includes("subtotal"))) return next(new HttpError(400, error.message));
    next(error);
  }
});

async function findAccessibleSale(id: string, user: NonNullable<Express.Request["user"]>, withNotifications: boolean) {
  const branchId = branchScope(user);
  const sale = await prisma.sale.findFirst({
    where: { id, ...(branchId ? { branchId } : {}) },
    include: { branch: true, customer: true, user: { select: { name: true } }, items: { include: { product: true } }, payments: true, ...(withNotifications ? { notifications: true } : {}) }
  });
  if (!sale) throw new HttpError(404, "Sale not found");
  return sale;
}

async function saveAndLinkWalkInContact(
  saleId: string,
  linkedCustomer: { id: string; name: string; phone: string; isWalkIn: boolean; notificationPreference: string } | null,
  phone: string,
  customerName?: string
) {
  const localPhone = `0${phone.slice(2)}`;
  const canonicalCustomer = await prisma.customer.findUnique({ where: { phone } });
  const matchingCustomer = canonicalCustomer ?? await prisma.customer.findFirst({
    where: { phone: { in: [`+${phone}`, localPhone] } }
  });

  let customer;
  if (matchingCustomer) {
    customer = await prisma.customer.update({
      where: { id: matchingCustomer.id },
      data: {
        phone,
        ...(matchingCustomer.isWalkIn && customerName ? { name: customerName } : {})
      }
    });
  } else if (linkedCustomer) {
    customer = await prisma.customer.update({
      where: { id: linkedCustomer.id },
      data: {
        phone,
        ...(linkedCustomer.isWalkIn && customerName ? { name: customerName } : {})
      }
    });
  } else {
    customer = await prisma.customer.create({
      data: {
        name: customerName || `Walk-in customer ${phone.slice(-4)}`,
        phone,
        isWalkIn: true
      }
    });
  }

  await prisma.sale.update({ where: { id: saleId }, data: { customerId: customer.id } });
  return customer;
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
  throw new HttpError(409, "Sale could not be completed because stock changed; please retry");
}
