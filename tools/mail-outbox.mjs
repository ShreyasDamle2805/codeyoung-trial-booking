import { openDatabase } from "../backend/src/db/connection.js";
import { loadProjectEnv } from "../backend/src/config.js";
loadProjectEnv();
const db = openDatabase();
try {
  if (process.argv.includes("--retry-failed")) {
    const result = db
      .prepare(
        "UPDATE email_outbox SET status = 'pending', attempts = 0, next_attempt_at = ?, last_error = NULL WHERE status = 'failed'",
      )
      .run(new Date().toISOString());
    console.log(
      `Requeued ${result.changes} failed messages. The SMTP worker will retry while the app is running.`,
    );
  }
  console.table(
    db
      .prepare(
        "SELECT status, COUNT(*) AS messages FROM email_outbox GROUP BY status",
      )
      .all(),
  );
} finally {
  db.close();
}
