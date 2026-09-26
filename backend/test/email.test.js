import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { SMTPServer } from "smtp-server";
import nodemailer from "nodemailer";
import { openDatabase } from "../src/db/connection.js";
import { createBookingService } from "../src/services/bookingService.js";
import { createEmailDispatcher } from "../src/services/emailService.js";
import { loadConfig } from "../src/config.js";

const config = {
  mailMode: "smtp",
  mailFrom: "trial@example.com",
  appOrigin: "http://localhost:3001",
};
const now = () => DateTime.fromISO("2026-09-25T00:00:00Z");
function setup(t) {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  const service = createBookingService(db, now, config);
  const result = service.book(
    {
      name: "Alex Taylor",
      email: "alex@example.com",
      timezone: "America/New_York",
      start: "2026-09-26T10:00:00Z",
    },
    randomUUID(),
  );
  return { db, result };
}
test("SMTP delivery sends two local-time confirmations with the same absolute class URL", async (t) => {
  const { db, result } = setup(t);
  const messages = [];
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    logger: false,
    onData(stream, session, callback) {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        messages.push({
          recipients: session.envelope.rcptTo.map((r) => r.address),
          body: Buffer.concat(chunks).toString("utf8").replace(/=\r\n/g, ""),
        });
        callback();
      });
      stream.on("error", callback);
    },
  });
  await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  const sender = nodemailer.createTransport({
    host: "127.0.0.1",
    port: smtp.server.address().port,
    secure: false,
    ignoreTLS: true,
  });
  const dispatcher = createEmailDispatcher(db, config, sender, now);
  try {
    await dispatcher.flush();
    assert.equal(messages.length, 2);
    assert.match(
      messages.find((m) => m.recipients.includes("alex@example.com")).body,
      /America\/New_York/,
    );
    assert.match(
      messages.find((m) => m.recipients.includes("mentor1@example.com")).body,
      /Asia\/Kolkata/,
    );
    for (const message of messages)
      assert.ok(
        message.body.includes(`http://localhost:3001${result.meetingLink}`),
      );
    assert.equal(
      db
        .prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status = 'sent'")
        .get().n,
      2,
    );
    await dispatcher.flush();
    assert.equal(
      messages.length,
      2,
      "sent messages must not be delivered again",
    );
  } finally {
    dispatcher.close();
    await new Promise((resolve) => smtp.close(resolve));
  }
});
test("SMTP outage preserves the booking and retries due messages without duplicating successes", async (t) => {
  const { db } = setup(t);
  let time = now(),
    unavailable = true;
  const delivered = [];
  const sender = {
    async sendMail(message) {
      if (unavailable)
        throw Object.assign(new Error("private server response"), {
          code: "ECONNECTION",
        });
      delivered.push(message);
      return { accepted: [message.to.address] };
    },
  };
  const dispatcher = createEmailDispatcher(db, config, sender, () => time);
  await dispatcher.flush();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n, 1);
  assert.deepEqual(
    db
      .prepare("SELECT status, attempts, last_error FROM email_outbox LIMIT 1")
      .get(),
    Object.assign(Object.create(null), {
      status: "pending",
      attempts: 1,
      last_error: "ECONNECTION",
    }),
  );
  unavailable = false;
  await dispatcher.flush();
  assert.equal(delivered.length, 0);
  time = time.plus({ seconds: 31 });
  await dispatcher.flush();
  await dispatcher.flush();
  assert.equal(delivered.length, 2);
});
test("two workers claim separate messages; expired leases are recoverable", async (t) => {
  const { db } = setup(t);
  const ids = [];
  const sender = {
    async sendMail(message) {
      ids.push(message.messageId);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { accepted: [message.to.address] };
    },
  };
  const first = createEmailDispatcher(db, config, sender, now),
    second = createEmailDispatcher(db, config, sender, now);
  await Promise.all([first.flush(), second.flush()]);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  db.prepare(
    "UPDATE email_outbox SET status = 'sending', lease_until = ? WHERE preview_id = (SELECT preview_id FROM email_outbox LIMIT 1)",
  ).run(now().minus({ minutes: 3 }).toUTC().toISO());
  await first.flush();
  assert.equal(ids.length, 3);
});
test("exhausted delivery retries remain inspectable for manual recovery", async (t) => {
  const { db } = setup(t);
  let time = now();
  const sender = {
    async sendMail() {
      throw new Error("unavailable");
    },
  };
  const dispatcher = createEmailDispatcher(db, config, sender, () => time);
  for (let attempt = 0; attempt < 5; attempt++) {
    await dispatcher.flush();
    time = time.plus({ hours: 1 });
  }
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM email_outbox WHERE status = 'failed' AND attempts = 5",
      )
      .get().n,
    2,
  );
});
test("configuration rejects broken SMTP settings before accepting bookings", () => {
  assert.throws(() => loadConfig({ MAIL_MODE: "smtp" }), /SMTP_HOST/);
  assert.throws(
    () => loadConfig({ APP_ORIGIN: "https://example.com/path" }),
    /APP_ORIGIN/,
  );
  assert.throws(
    () => loadConfig({ MENTOR_EMAILS: "one@example.com" }),
    /ten unique/,
  );
  assert.equal(loadConfig({}).mailMode, "preview");
});
