import { parseArgs } from "node:util";
import { DateTime } from "luxon";
import { openDatabase } from "../backend/src/db/connection.js";
import { createApp } from "../backend/src/app.js";

// Explicitly separate from production startup: no .env, external SMTP, or persistent data.
const { values } = parseArgs({
  options: {
    now: { type: "string" },
    port: { type: "string", default: "3012" },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Use a port between 1 and 65535.");
const fixed = values.now
  ? DateTime.fromISO(values.now, { setZone: true })
  : null;
if (fixed && (!fixed.isValid || !values.now.endsWith("Z")))
  throw new Error("--now must be a valid UTC ISO timestamp ending in Z.");
const clock = fixed ? () => fixed.toUTC() : undefined;
const db = openDatabase(":memory:");
const appOrigin = `http://localhost:${port}`;
const server = createApp(db, clock, { mailMode: "preview", appOrigin }).listen(
  port,
  "127.0.0.1",
  () => {
    console.log(`Manual test lab: ${appOrigin}`);
    console.log(
      "Fresh in-memory database, ten mentors, preview email only. Restart to reset.",
    );
    if (fixed)
      console.log(
        `API clock fixed at ${fixed.toUTC().toISO()}. Browser calendar still uses the real date; use API requests for historical/future DST cases.`,
      );
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
