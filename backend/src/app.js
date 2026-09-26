import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createBookingService } from "./services/bookingService.js";
import { apiRoutes } from "./routes/api.js";

export function createApp(db, clock, config = {}) {
  const app = express(),
    service = createBookingService(db, clock, config);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", apiRoutes(service, config));
  const dist = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) => res.sendFile(`${dist}/index.html`));
  }
  app.use((error, _req, res, _next) => {
    const locked = error.errcode === 5 || error.errcode === 6;
    const status = locked ? 503 : error.status || 500;
    if (status >= 500) console.error(error);
    if (locked) res.set("Retry-After", "1");
    res.status(status).json({
      error: locked
        ? "DATABASE_BUSY"
        : error.status
          ? error.code || "INVALID_REQUEST"
          : "INTERNAL_ERROR",
      message: locked
        ? "The booking service is busy. Please retry your request."
        : status < 500
          ? error.message
          : "Something went wrong. Please try again.",
      ...(error.code === "NO_MENTORS_AVAILABLE"
        ? { suggestion: "Select another time or date." }
        : {}),
    });
  });
  return app;
}
