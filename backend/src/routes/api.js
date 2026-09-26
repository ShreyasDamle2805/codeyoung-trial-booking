import { Router } from "express";

export function apiRoutes(service, config) {
  const router = Router();
  router.get("/health", (_req, res) => res.json({ status: "ok" }));
  router.get("/config", (_req, res) =>
    res.json({ mailMode: config.mailMode || "preview" }),
  );
  router.get("/mentors", (_req, res) =>
    res.json({ mentors: service.mentors() }),
  );
  router.get("/slots", (req, res) =>
    res.json({ slots: service.slots(req.query.date, req.query.timezone) }),
  );
  router.post("/bookings", (req, res) =>
    res.status(201).json(service.book(req.body, req.get("Idempotency-Key"))),
  );
  router.use((_req, res) =>
    res
      .status(404)
      .json({ error: "NOT_FOUND", message: "API route not found." }),
  );
  return router;
}
