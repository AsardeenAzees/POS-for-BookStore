import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: error.flatten() });
  }

  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return res.status(409).json({ error: "A record with the same unique value already exists" });
    if (error.code === "P2025") return res.status(404).json({ error: "Record not found" });
    if (error.code === "P2021") return res.status(503).json({ error: "Database schema is not ready. Apply the latest migrations and retry." });
    if (error.code === "P2028") return res.status(503).json({ error: "The database transaction timed out. Please retry the checkout." });
    if (error.code === "P2034") return res.status(409).json({ error: "Stock changed during checkout. Please review the cart and retry." });
  }

  console.error("[api-error]", {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    error: error instanceof Error ? error.message : String(error)
  });
  res.status(500).json({ error: "Unexpected server error" });
}
