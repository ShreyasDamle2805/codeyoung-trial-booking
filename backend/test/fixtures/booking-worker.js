import { parentPort, workerData } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { openDatabase } from "../../src/db/connection.js";
import { createBookingService } from "../../src/services/bookingService.js";
const db = openDatabase(workerData.path);
const service = createBookingService(db, () =>
  DateTime.fromISO("2026-09-25T00:00:00Z"),
);
parentPort.postMessage("ready");
parentPort.once("message", () => {
  const results = [];
  try {
    for (let i = 0; i < 5; i++) {
      try {
        service.book(
          {
            name: "Concurrent parent",
            email: `${randomUUID()}@example.com`,
            timezone: "Europe/London",
            start: workerData.start,
          },
          randomUUID(),
        );
        results.push("confirmed");
      } catch (error) {
        results.push(error.code || error.message);
      }
    }
  } finally {
    db.close();
  }
  parentPort.postMessage(results);
});
