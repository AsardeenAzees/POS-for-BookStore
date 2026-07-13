import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function auditLogger(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (!writeMethods.has(req.method) || res.statusCode >= 400) return;
    void prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: `${req.method} ${req.route?.path ?? req.path}`,
        entity: req.baseUrl.replace("/api/", "") || req.path.split("/")[2] || "system",
        entityId: typeof req.params.id === "string" ? req.params.id : undefined,
        metadata: { body: JSON.parse(JSON.stringify(sanitize(req.body) ?? null)), statusCode: res.statusCode },
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      }
    }).catch(() => undefined);
  });
  next();
}

function sanitize(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const copy = { ...(value as Record<string, unknown>) };
  delete copy.password;
  delete copy.passwordHash;
  return copy;
}
