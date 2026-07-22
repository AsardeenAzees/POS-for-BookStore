import { Router } from "express";
import { RoleName } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { branchScope } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireRoles(RoleName.ADMIN, RoleName.MANAGER, RoleName.DEMO_VIEWER));

reportsRouter.get("/daily-sales", requireAuth, async (req, res) => {
  const date = req.query.date ? new Date(String(req.query.date)) : new Date();
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid report date");
  const branchId = branchScope(req.user!);
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  const sales = await prisma.sale.findMany({ where: { createdAt: { gte: start, lte: end }, status: "COMPLETED", ...(branchId ? { branchId } : {}) }, include: { branch: true, user: { select: { name: true } }, payments: true } });
  res.json({ data: { sales, total: sales.reduce((sum, sale) => sum + Number(sale.total), 0), count: sales.length } });
});

reportsRouter.get("/product-sales", requireAuth, async (req, res) => {
  const branchId = branchScope(req.user!);
  const items = await prisma.saleItem.groupBy({ by: ["productId"], where: { sale: { status: "COMPLETED", ...(branchId ? { branchId } : {}) } }, _sum: { quantity: true, total: true }, orderBy: { _sum: { quantity: "desc" } }, take: 50 });
  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  res.json({ data: items.map((item) => ({ ...item, product: products.find((p) => p.id === item.productId) })) });
});

reportsRouter.get("/low-stock", requireAuth, async (req, res) => {
  const branchId = branchScope(req.user!);
  const rows = await prisma.inventoryStock.findMany({
    where: { quantity: { lte: prisma.inventoryStock.fields.lowStockLevel }, ...(branchId ? { branchId } : {}) },
    include: { branch: true, product: true },
    orderBy: { quantity: "asc" }
  });
  res.json({ data: rows });
});

reportsRouter.get("/branch-stock", requireAuth, async (req, res) => {
  const branchId = branchScope(req.user!);
  res.json({ data: await prisma.inventoryStock.findMany({ where: branchId ? { branchId } : undefined, include: { branch: true, product: true }, orderBy: [{ branch: { name: "asc" } }, { product: { name: "asc" } }] }) });
});

reportsRouter.get("/employee-sales", requireAuth, async (req, res) => {
  const branchId = branchScope(req.user!);
  const sales = await prisma.sale.groupBy({ by: ["userId"], where: { status: "COMPLETED", ...(branchId ? { branchId } : {}) }, _sum: { total: true }, _count: true, orderBy: { _sum: { total: "desc" } } });
  const users = await prisma.user.findMany({ where: { id: { in: sales.map((s) => s.userId) } }, select: { id: true, name: true, email: true } });
  res.json({ data: sales.map((sale) => ({ ...sale, user: users.find((u) => u.id === sale.userId) })) });
});

reportsRouter.get("/dashboard-summary", requireAuth, async (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const branchId = branchScope(req.user!);
  const [sales, lowStock, pendingDesired, recentSales, recentMovements, smsSummary, topItems] = await Promise.all([
    prisma.sale.findMany({ where: { createdAt: { gte: start }, status: "COMPLETED", ...(branchId ? { branchId } : {}) } }),
    prisma.inventoryStock.findMany({ where: { quantity: { lte: prisma.inventoryStock.fields.lowStockLevel }, ...(branchId ? { branchId } : {}) } }),
    prisma.desiredItemRequest.count({ where: { status: "PENDING_REVIEW", ...(branchId ? { branchId } : {}) } }),
    prisma.sale.findMany({ where: { status: "COMPLETED", ...(branchId ? { branchId } : {}) }, include: { customer: true, branch: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.stockMovement.findMany({ where: branchId ? { branchId } : undefined, include: { product: true, branch: true, user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.notification.groupBy({ by: ["status"], where: branchId ? { OR: [{ sale: { branchId } }, { desiredItemRequest: { branchId } }, { createdBy: { branchId } }] } : undefined, _count: true }),
    prisma.saleItem.groupBy({ by: ["productId"], where: { sale: { status: "COMPLETED", ...(branchId ? { branchId } : {}) } }, _sum: { quantity: true, total: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 })
  ]);
  const products = await prisma.product.findMany({ where: { id: { in: topItems.map((item) => item.productId) } } });
  res.json({
    data: {
      todaySales: sales.reduce((sum, sale) => sum + Number(sale.total), 0),
      todayInvoices: sales.length,
      lowStockCount: lowStock.length,
      pendingDesired,
      recentSales,
      recentMovements,
      smsSummary,
      topProducts: topItems.map((item) => ({ ...item, product: products.find((product) => product.id === item.productId) }))
    }
  });
});

reportsRouter.get("/export/:type", requireAuth, async (req, res) => {
  const type = req.params.type;
  const rows = await exportRows(type, branchScope(req.user!));
  if (!rows) return res.status(404).json({ error: "Unknown export type" });
  const csv = toCsv(rows);
  res.header("Content-Type", "text/csv");
  res.attachment(`${type}-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(`\uFEFF${csv}`);
});

async function exportRows(type: string, branchId?: string) {
  if (type === "daily-sales") {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return (await prisma.sale.findMany({ where: { createdAt: { gte: start }, status: "COMPLETED", ...(branchId ? { branchId } : {}) }, include: { branch: true, customer: true, user: { select: { name: true } } } }))
      .map((sale) => ({ invoice: sale.invoiceNumber, branch: sale.branch.name, customer: sale.customer?.name ?? "Walk-in", cashier: sale.user.name, total: sale.total, date: sale.createdAt.toISOString() }));
  }
  if (type === "branch-stock") {
    return (await prisma.inventoryStock.findMany({ where: branchId ? { branchId } : undefined, include: { branch: true, product: true } }))
      .map((row) => ({ branch: row.branch.name, sku: row.product.sku, product: row.product.name, quantity: row.quantity, lowStockLevel: row.lowStockLevel }));
  }
  if (type === "product-list") {
    return (await prisma.product.findMany({ include: { category: true } }))
      .map((row) => ({ sku: row.sku, barcode: row.barcode ?? "", name: row.name, category: row.category.name, price: row.sellingPrice, active: row.active }));
  }
  if (type === "customers") {
    return (await prisma.customer.findMany()).map((row) => ({ name: row.name, phone: row.phone, whatsapp: row.whatsapp ?? "", preference: row.notificationPreference }));
  }
  if (type === "desired-item-requests") {
    return (await prisma.desiredItemRequest.findMany({ where: branchId ? { branchId } : undefined, include: { branch: true } }))
      .map((row) => ({ item: row.requestedItemName, phone: row.phone, branch: row.branch?.name ?? "", status: row.status, createdAt: row.createdAt.toISOString() }));
  }
  if (type === "sms-logs") {
    return (await prisma.notification.findMany({ where: branchId ? { OR: [{ sale: { branchId } }, { desiredItemRequest: { branchId } }, { createdBy: { branchId } }] } : undefined }))
      .map((row) => ({ event: row.event, provider: row.provider, recipient: row.recipient, status: row.status, attempts: row.attempts, createdAt: row.createdAt.toISOString() }));
  }
  return null;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    const safe = /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
    return `"${safe.replace(/"/g, "\"\"")}"`;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}
