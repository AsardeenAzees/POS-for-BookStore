import bcrypt from "bcryptjs";
import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, description: name.replace("_", " ").toLowerCase() }
      })
    )
  );
  const roleId = (name: RoleName) => roles.find((role) => role.name === name)!.id;

  const colombo = await prisma.branch.upsert({
    where: { code: "CMB" },
    update: {},
    create: { name: "Colombo Main Bookshop", code: "CMB", address: "Galle Road, Colombo 04", phone: "+94112500000" }
  });
  const kandy = await prisma.branch.upsert({
    where: { code: "KDY" },
    update: {},
    create: { name: "Kandy City Branch", code: "KDY", address: "Dalada Veediya, Kandy", phone: "+94812200000" }
  });

  const configuredSeedPassword = process.env.SEED_USER_PASSWORD?.trim();
  if (!configuredSeedPassword && process.env.NODE_ENV === "production") {
    throw new Error("SEED_USER_PASSWORD is required when seeding a production environment");
  }
  const seedPassword = configuredSeedPassword ?? "Password123!";
  if (!configuredSeedPassword) console.warn("Using the documented local-development seed password. Never use it in a deployed environment.");
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const users = [
    ["Admin User", "admin@bookshop.lk", RoleName.ADMIN, colombo.id],
    ["Manager User", "manager@bookshop.lk", RoleName.MANAGER, colombo.id],
    ["Cashier User", "cashier@bookshop.lk", RoleName.CASHIER, colombo.id],
    ["Inventory User", "inventory@bookshop.lk", RoleName.INVENTORY_STAFF, kandy.id],
    ["Delivery User", "delivery@bookshop.lk", RoleName.DELIVERY_STAFF, kandy.id]
  ] as const;

  for (const [name, email, role, branchId] of users) {
    await prisma.user.upsert({
      where: { email },
      update: { roleId: roleId(role), branchId },
      create: { name, email, passwordHash, roleId: roleId(role), branchId }
    });
  }

  const school = await prisma.category.upsert({ where: { name: "School Books" }, update: {}, create: { name: "School Books" } });
  const stationery = await prisma.category.upsert({ where: { name: "Stationery" }, update: {}, create: { name: "Stationery" } });
  const fiction = await prisma.category.upsert({ where: { name: "Fiction" }, update: {}, create: { name: "Fiction" } });

  const products = [
    {
      name: "Master Guide Grade 10 Mathematics",
      sku: "BOOK-MG-MATH-G10",
      barcode: "4791001000010",
      categoryId: school.id,
      publisher: "Master Guide",
      author: "Master Guide Editorial",
      grade: "Grade 10",
      sellingPrice: 1450,
      costPrice: 1050
    },
    {
      name: "Gunasena Sinhala Hodiya",
      sku: "BOOK-GUN-SIN-HODIYA",
      barcode: "4791001000027",
      categoryId: school.id,
      publisher: "M.D. Gunasena",
      grade: "Primary",
      sellingPrice: 420,
      costPrice: 300
    },
    {
      name: "Atlas Chooty Blue Pen",
      sku: "STAT-ATL-PEN-BLUE",
      barcode: "4791001000034",
      categoryId: stationery.id,
      brand: "Atlas",
      sellingPrice: 60,
      costPrice: 38
    },
    {
      name: "CR Book 120 Pages Single Rule",
      sku: "STAT-CR-120-SR",
      barcode: "4791001000041",
      categoryId: stationery.id,
      brand: "Richard",
      sellingPrice: 260,
      costPrice: 190
    },
    {
      name: "Madol Doova",
      sku: "BOOK-MD-SIN-FIC",
      barcode: "4791001000058",
      categoryId: fiction.id,
      publisher: "Sarasavi",
      author: "Martin Wickramasinghe",
      sellingPrice: 950,
      costPrice: 650
    }
  ];

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: item,
      create: item
    });
    await prisma.inventoryStock.upsert({
      where: { branchId_productId: { branchId: colombo.id, productId: product.id } },
      update: { quantity: product.sku.includes("PEN") ? 250 : 30, lowStockLevel: product.sku.includes("PEN") ? 50 : 8 },
      create: { branchId: colombo.id, productId: product.id, quantity: product.sku.includes("PEN") ? 250 : 30, lowStockLevel: product.sku.includes("PEN") ? 50 : 8 }
    });
    await prisma.inventoryStock.upsert({
      where: { branchId_productId: { branchId: kandy.id, productId: product.id } },
      update: { quantity: product.sku.includes("PEN") ? 150 : 12, lowStockLevel: product.sku.includes("PEN") ? 40 : 6 },
      create: { branchId: kandy.id, productId: product.id, quantity: product.sku.includes("PEN") ? 150 : 12, lowStockLevel: product.sku.includes("PEN") ? 40 : 6 }
    });
  }

  await prisma.customer.upsert({
    where: { phone: "+94771234567" },
    update: {},
    create: { name: "Nimali Perera", phone: "+94771234567", whatsapp: "+94771234567", address: "Nugegoda", notificationPreference: "INVOICE_ONLY" }
  });
  await prisma.customer.upsert({
    where: { phone: "+94777654321" },
    update: {},
    create: { name: "Kasun Silva", phone: "+94777654321", address: "Kandy", notificationPreference: "STOCK_ALERTS" }
  });

  await prisma.businessSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      businessName: "Book Mart",
      address: "Galle Road, Colombo 04",
      phone: "94770000000",
      email: "hello@bookmart.lk",
      receiptFooterText: "Thank you for shopping with Book Mart.",
      defaultCurrency: "LKR",
      smsEnabled: true,
      smsProvider: "mock",
      invoiceSmsAutoSend: false,
      desiredItemSmsAutoSend: false,
      requireApprovalBeforeDesiredItemSms: true
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
