import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: error.flatten() });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message.includes("Insufficient stock") || message.includes("required") ? 400 : 500;
  res.status(status).json({ error: message });
}
