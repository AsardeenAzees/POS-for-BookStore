import { Router } from "express";
import { RoleName } from "@prisma/client";
import { prisma } from "../db.js";
import { branchScope, requireAuth, requireRoles } from "../middleware/auth.js";

export const metaRouter = Router();

metaRouter.get("/branches", requireAuth, async (req, res) => {
  const branchId = branchScope(req.user!);
  res.json({ data: await prisma.branch.findMany({ where: branchId ? { id: branchId } : undefined, orderBy: { name: "asc" } }) });
});

metaRouter.get("/categories", requireAuth, async (_req, res) => {
  res.json({ data: await prisma.category.findMany({ orderBy: { name: "asc" } }) });
});

metaRouter.get("/audit-logs", requireAuth, requireRoles(RoleName.ADMIN), async (_req, res) => {
  res.json({
    data: await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } }
    })
  });
});
