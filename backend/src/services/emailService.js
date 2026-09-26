import nodemailer from "nodemailer";
import { DateTime } from "luxon";
import { utc } from "./timezoneService.js";

// The booking transaction owns message creation. Network delivery happens only after commit.
export function createEmailDispatcher(
  db,
  config,
  transport = null,
  clock = () => DateTime.utc(),
) {
  const sender =
    transport ||
    (config.mailMode === "smtp"
      ? nodemailer.createTransport(config.smtp)
      : null);
  let active = null;
  async function deliver() {
    if (!sender) return;
    for (let i = 0; i < 40; i++) {
      const now = clock();
      // A single UPDATE claims one message, including an expired claim after a crash.
      const row = db
        .prepare(
          `UPDATE email_outbox SET status = 'sending', attempts = attempts + 1, lease_until = ?
        WHERE preview_id = (SELECT preview_id FROM email_outbox WHERE
          (status = 'pending' AND next_attempt_at <= ?) OR (status = 'sending' AND lease_until <= ?)
          ORDER BY next_attempt_at, preview_id LIMIT 1)
        RETURNING *`,
        )
        .get(utc(now.plus({ minutes: 2 })), utc(now), utc(now));
      if (!row) break;
      const message = db
        .prepare("SELECT * FROM email_previews WHERE id = ?")
        .get(row.preview_id);
      try {
        const result = await sender.sendMail({
          from: config.mailFrom,
          to: { address: message.recipient, name: "" },
          subject: message.subject,
          text: message.body,
          messageId: `<${message.id}@codeyoung-trial.local>`,
        });
        if (!result.accepted?.length || result.rejected?.length)
          throw new Error("SMTP_RECIPIENT_REJECTED");
        db.prepare(
          "UPDATE email_outbox SET status = 'sent', sent_at = ?, lease_until = NULL, last_error = NULL WHERE preview_id = ? AND lease_until = ?",
        ).run(utc(clock()), message.id, row.lease_until);
      } catch (error) {
        // Store a diagnostic code only: SMTP errors can contain credentials or addresses.
        const code =
          typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
            ? error.code
            : "DELIVERY_FAILED";
        db.prepare(
          "UPDATE email_outbox SET status = ?, next_attempt_at = ?, lease_until = NULL, last_error = ? WHERE preview_id = ? AND lease_until = ?",
        ).run(
          row.attempts >= 5 ? "failed" : "pending",
          utc(
            clock().plus({
              seconds: Math.min(3600, 30 * 2 ** (row.attempts - 1)),
            }),
          ),
          code,
          message.id,
          row.lease_until,
        );
      }
    }
  }
  function flush() {
    if (!active)
      active = deliver().finally(() => {
        active = null;
      });
    return active;
  }
  return { flush, close: () => sender?.close?.() };
}
