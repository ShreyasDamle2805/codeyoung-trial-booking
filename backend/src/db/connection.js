import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function openDatabase(
  path = process.env.DB_PATH ||
    fileURLToPath(new URL("../../data/booking.sqlite", import.meta.url)),
  { mentorEmails } = {},
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  const insert = db.prepare(
    "INSERT OR IGNORE INTO mentors (id, name, email) VALUES (?, ?, ?)",
  );
  [
    "Aarav Sharma",
    "Ananya Rao",
    "Rohan Mehta",
    "Diya Patel",
    "Arjun Nair",
    "Isha Kapoor",
    "Kabir Singh",
    "Meera Iyer",
    "Vivaan Shah",
    "Sana Khan",
  ].forEach((name, i) => insert.run(i + 1, name, `mentor${i + 1}@example.com`));
  if (mentorEmails) {
    db.exec("BEGIN IMMEDIATE");
    try {
      // Clear existing addresses first so swapping two configured addresses is valid.
      for (let i = 0; i < 10; i++)
        db.prepare("UPDATE mentors SET email = ? WHERE id = ?").run(
          `temporary-${i}@invalid.local`,
          i + 1,
        );
      mentorEmails.forEach((email, i) =>
        db
          .prepare("UPDATE mentors SET email = ? WHERE id = ?")
          .run(email, i + 1),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  return db;
}
