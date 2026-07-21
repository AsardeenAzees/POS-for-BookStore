import type { NextFunction, Request, Response } from "express";

const sensitiveKeys = new Set([
  "authorization",
  "password",
  "passwordHash",
  "token",
  "apiToken",
  "TEXTLK_API_TOKEN",
  "textlkApiToken",
  "jwt",
  "secret"
]);

export function apiLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.on("finish", () => {
    if (!req.originalUrl.startsWith("/api") && req.originalUrl !== "/health") return;

    const entry = {
      time: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.id,
      request: { queryKeys: Object.keys(req.query), bodyKeys: objectKeys(req.body) }
    };

    console.log(`[http] ${JSON.stringify(entry)}`);
  });

  next();
}

function objectKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).map((key) => isSensitiveKey(key) ? "[sensitive]" : key);
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return sensitiveKeys.has(key) || sensitiveKeys.has(normalized) || normalized.includes("token") || normalized.includes("secret") || normalized.includes("password");
}
