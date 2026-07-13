import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email(), password: z.string().min(6) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email }, include: { role: true, branch: true } });
    if (!user || !user.active || !(await bcrypt.compare(input.password, user.passwordHash))) {
      await prisma.auditLog.create({ data: { action: "LOGIN_FAILED", entity: "auth", metadata: { email: input.email }, ipAddress: req.ip, userAgent: req.header("user-agent") } });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const authUser = { id: user.id, email: user.email, role: user.role.name, branchId: user.branchId };
    await prisma.auditLog.create({ data: { userId: user.id, action: "LOGIN_SUCCESS", entity: "auth", metadata: { email: user.email }, ipAddress: req.ip, userAgent: req.header("user-agent") } });
    res.json({
      data: {
        token: signToken(authUser),
        user: { id: user.id, name: user.name, email: user.email, role: user.role.name, branch: user.branch }
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { role: true, branch: true }
  });
  res.json({ data: user && { id: user.id, name: user.name, email: user.email, role: user.role.name, branch: user.branch } });
});
