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
  const staffUsers = [
    { name: "Admin User", email: "admin@bookshop.lk", role: RoleName.ADMIN, branchId: colombo.id },
    { name: "Manager User", email: "manager@bookshop.lk", role: RoleName.MANAGER, branchId: colombo.id },
    { name: "Kandy Branch Manager", email: "manager.kandy@bookshop.lk", role: RoleName.MANAGER, branchId: kandy.id },
    { name: "Cashier User", email: "cashier@bookshop.lk", role: RoleName.CASHIER, branchId: colombo.id },
    { name: "Kandy Cashier", email: "cashier.kandy@bookshop.lk", role: RoleName.CASHIER, branchId: kandy.id },
    { name: "Colombo Inventory Staff", email: "inventory.colombo@bookshop.lk", role: RoleName.INVENTORY_STAFF, branchId: colombo.id },
    { name: "Inventory User", email: "inventory@bookshop.lk", role: RoleName.INVENTORY_STAFF, branchId: kandy.id },
    { name: "Colombo Delivery Staff", email: "delivery.colombo@bookshop.lk", role: RoleName.DELIVERY_STAFF, branchId: colombo.id },
    { name: "Delivery User", email: "delivery@bookshop.lk", role: RoleName.DELIVERY_STAFF, branchId: kandy.id }
  ] as const;

  for (const { name, email, role, branchId } of staffUsers) {
    await prisma.user.upsert({
      where: { email },
      update: { name, roleId: roleId(role), branchId, active: true },
      create: { name, email, passwordHash, roleId: roleId(role), branchId }
    });
  }
  const configuredDemoPassword = process.env.DEMO_VIEWER_PASSWORD?.trim();
  if (!configuredDemoPassword && process.env.NODE_ENV === "production") {
    throw new Error("DEMO_VIEWER_PASSWORD is required when seeding a production environment");
  }
  const demoPassword = configuredDemoPassword ?? "DemoView@2026!";
  if (!configuredDemoPassword) {
    console.warn("Using the documented local/demo viewer password. Set DEMO_VIEWER_PASSWORD when seeding a deployed database.");
  }
  const demoPasswordHash = await bcrypt.hash(demoPassword, 10);
  await prisma.user.upsert({
    where: { email: "demo@bookshop.lk" },
    update: {
      name: "Demo Viewer",
      passwordHash: demoPasswordHash,
      roleId: roleId(RoleName.DEMO_VIEWER),
      branchId: null,
      active: true
    },
    create: {
      name: "Demo Viewer",
      email: "demo@bookshop.lk",
      passwordHash: demoPasswordHash,
      roleId: roleId(RoleName.DEMO_VIEWER),
      branchId: null,
      active: true
    }
  });

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
      update: {},
      create: item
    });
    await prisma.inventoryStock.upsert({
      where: { branchId_productId: { branchId: colombo.id, productId: product.id } },
      update: {},
      create: { branchId: colombo.id, productId: product.id, quantity: product.sku.includes("PEN") ? 250 : 30, lowStockLevel: product.sku.includes("PEN") ? 50 : 8 }
    });
    await prisma.inventoryStock.upsert({
      where: { branchId_productId: { branchId: kandy.id, productId: product.id } },
      update: {},
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
