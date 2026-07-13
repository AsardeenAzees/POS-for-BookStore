import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { RoleName } from "@prisma/client";
import { config } from "../config.js";
import { prisma } from "../db.js";

export type AuthUser = {
  id: string;
  email: string;
  role: RoleName;
  branchId: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthUser;
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, include: { role: true } });
    if (!user || !user.active) return res.status(401).json({ error: "Invalid user" });
    req.user = { id: user.id, email: user.email, role: user.role.name, branchId: user.branchId };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRoles(...roles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient role" });
    next();
  };
}
