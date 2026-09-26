import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openDatabase } from "../src/db/connection.js";

test(
  "independent SQLite connections cannot overbook under simultaneous contention",
  { timeout: 30000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "codeyoung-concurrency-"));
    const path = join(directory, "booking.sqlite");
    const target = resolve(directory),
      parent = resolve(tmpdir());
    if (
      !target.startsWith(parent + sep) ||
      !target.slice(parent.length + 1).startsWith("codeyoung-concurrency-")
    )
      throw new Error("Unexpected temporary test directory.");
    openDatabase(path).close();
    const allWorkers = [];
    try {
      for (const [start, expected] of [
        ["2026-09-26T10:00:00Z", 10],
        ["2026-09-26T10:30:00Z", 10],
        ["2026-09-26T11:00:00Z", 0],
      ]) {
        const workers = Array.from(
          { length: 4 },
          () =>
            new Worker(
              new URL("./fixtures/booking-worker.js", import.meta.url),
              { workerData: { path, start } },
            ),
        );
        allWorkers.push(...workers);
        await Promise.all(
          workers.map(
            (worker) =>
              new Promise((resolve, reject) => {
                worker.once("message", resolve);
                worker.once("error", reject);
              }),
          ),
        );
        const responses = workers.map(
          (worker) =>
            new Promise((resolve, reject) => {
              worker.once("message", resolve);
              worker.once("error", reject);
            }),
        );
        workers.forEach((worker) => worker.postMessage("go"));
        const results = (await Promise.all(responses)).flat();
        assert.equal(
          results.filter((result) => result === "confirmed").length,
          expected,
        );
        assert.equal(
          results.filter((result) => result === "NO_MENTORS_AVAILABLE").length,
          20 - expected,
        );
      }
      const db = openDatabase(path);
      try {
        assert.equal(
          db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n,
          20,
        );
        assert.equal(
          db
            .prepare(
              "SELECT MAX(n) AS n FROM (SELECT COUNT(*) AS n FROM bookings GROUP BY mentor_id)",
            )
            .get().n,
          2,
        );
      } finally {
        db.close();
      }
    } finally {
      await Promise.all(allWorkers.map((worker) => worker.terminate()));
      rmSync(target, { recursive: true, force: true });
    }
  },
);
