import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const metaRouter = Router();

metaRouter.get("/branches", requireAuth, async (_req, res) => {
  res.json({ data: await prisma.branch.findMany({ orderBy: { name: "asc" } }) });
});

metaRouter.get("/categories", requireAuth, async (_req, res) => {
  res.json({ data: await prisma.category.findMany({ orderBy: { name: "asc" } }) });
});

metaRouter.get("/audit-logs", requireAuth, async (_req, res) => {
  res.json({
    data: await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } }
    })
  });
});
