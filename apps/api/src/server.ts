import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { auditLogger } from "./middleware/audit.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { inventoryRouter } from "./routes/inventory.js";
import { customersRouter } from "./routes/customers.js";
import { salesRouter } from "./routes/sales.js";
import { reportsRouter } from "./routes/reports.js";
import { notificationsRouter } from "./routes/notifications.js";
import { metaRouter } from "./routes/meta.js";
import { settingsRouter } from "./routes/settings.js";
import { desiredItemsRouter } from "./routes/desiredItems.js";

const app = express();

app.use(helmet());
const corsOrigins = config.CORS_ORIGIN.split(",").map((origin) => origin.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, limit: 300 }));
const authLimiter = rateLimit({ windowMs: 60_000, limit: 20 });
const smsLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authLimiter, authRouter);
app.use("/api", metaRouter);
app.use(auditLogger);
app.use("/api/products", productsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/customers", customersRouter);
app.use("/api/sales", salesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/settings", smsLimiter, settingsRouter);
app.use("/api/desired-items", desiredItemsRouter);
app.use(notFound);
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`POS API listening on http://localhost:${config.PORT}`);
});
