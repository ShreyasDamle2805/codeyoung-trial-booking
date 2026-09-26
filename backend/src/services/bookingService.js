import { randomUUID, createHash } from "node:crypto";
import { DateTime } from "luxon";
import {
  AppError,
  validateZone,
  dayBounds,
  parseStart,
  utc,
  localLabel,
} from "./timezoneService.js";

export function createBookingService(
  db,
  clock = () => DateTime.utc(),
  config = {},
) {
  const mentors = () =>
    db
      .prepare(
        "SELECT id, name, timezone, max_daily_slots FROM mentors ORDER BY id",
      )
      .all();
  function eligible(start) {
    const end = start.plus({ minutes: 30 });
    return mentors()
      .map((mentor) => {
        let day = start.setZone(mentor.timezone).startOf("day");
        let load = 0;
        // Count a class on every local day it touches; adjacent intervals do not overlap.
        while (day < end) {
          const next = day.plus({ days: 1 });
          const { count } = db
            .prepare(
              "SELECT COUNT(*) AS count FROM bookings WHERE mentor_id = ? AND utc_start_time < ? AND utc_end_time > ?",
            )
            .get(mentor.id, utc(next), utc(day));
          if (count >= mentor.max_daily_slots) return null;
          load = Math.max(load, count);
          day = next;
        }
        const conflict = db
          .prepare(
            "SELECT id FROM bookings WHERE mentor_id = ? AND utc_start_time < ? AND utc_end_time > ? LIMIT 1",
          )
          .get(mentor.id, utc(end), utc(start));
        return conflict ? null : { ...mentor, load };
      })
      .filter(Boolean)
      .sort((a, b) => a.load - b.load || a.id - b.id);
  }
  function slots(date, timezone) {
    const [begin, end] = dayBounds(date, timezone);
    const now = clock();
    if (begin > now.plus({ days: 31 }) || end < now) return [];
    const result = [];
    // Iterate real UTC instants: DST gaps disappear and repeated hours have distinct offsets.
    let cursor = DateTime.fromMillis(
      Math.ceil(begin.toMillis() / 1800000) * 1800000,
      { zone: "utc" },
    );
    for (; cursor < end; cursor = cursor.plus({ minutes: 30 })) {
      if (cursor < now.plus({ hours: 1 }) || cursor > now.plus({ days: 30 }))
        continue;
      const available = eligible(cursor).length;
      const local = cursor.setZone(timezone);
      result.push({
        start: utc(cursor),
        end: utc(cursor.plus({ minutes: 30 })),
        label: local.toFormat("h:mm a"),
        offset: local.toFormat("ZZZZ '(UTC'ZZ')'"),
        available,
      });
    }
    return result;
  }
  function confirmation(id) {
    const row = db
      .prepare(
        `SELECT b.*, p.name AS parent_name, p.email AS parent_email, p.timezone AS parent_timezone, m.name AS mentor_name, m.timezone AS mentor_timezone FROM bookings b JOIN parents p ON p.id = b.parent_id JOIN mentors m ON m.id = b.mentor_id WHERE b.id = ?`,
      )
      .get(id);
    if (!row)
      throw new AppError(404, "NOT_FOUND", "This booking could not be found.");
    return {
      id: row.id,
      start: row.utc_start_time,
      end: row.utc_end_time,
      meetingLink: row.meeting_link,
      notificationMode:
        db
          .prepare(
            "SELECT delivery_mode FROM email_previews WHERE booking_id = ? LIMIT 1",
          )
          .get(id)?.delivery_mode || "preview",
      parent: {
        name: row.parent_name,
        timezone: row.parent_timezone,
        localTime: localLabel(row.utc_start_time, row.parent_timezone),
      },
      mentor: {
        name: row.mentor_name,
        timezone: row.mentor_timezone,
        localTime: localLabel(row.utc_start_time, row.mentor_timezone),
      },
      emailPreviews: db
        .prepare(
          "SELECT recipient, subject, body, delivery_mode FROM email_previews WHERE booking_id = ?",
        )
        .all(id),
    };
  }
  function book(input, key) {
    if (!input || typeof input !== "object")
      throw new AppError(400, "INVALID_INPUT", "Enter your booking details.");
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const email =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (
      !name ||
      name.length > 100 ||
      email.length > 254 ||
      !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(email)
    )
      throw new AppError(
        400,
        "INVALID_INPUT",
        "Enter your name and a valid email address.",
      );
    validateZone(input.timezone);
    const start = parseStart(input.start);
    if (typeof key !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(key))
      throw new AppError(
        400,
        "INVALID_REQUEST_KEY",
        "A valid Idempotency-Key header is required.",
      );
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([name, email, input.timezone, utc(start)]))
      .digest("hex");
    db.exec("BEGIN IMMEDIATE");
    try {
      const existing = db
        .prepare(
          "SELECT id, request_fingerprint FROM bookings WHERE request_key = ?",
        )
        .get(key);
      if (existing) {
        if (existing.request_fingerprint !== fingerprint)
          throw new AppError(
            409,
            "REQUEST_KEY_REUSED",
            "This request key was already used for different booking details.",
          );
        const result = confirmation(existing.id);
        db.exec("COMMIT");
        return result;
      }
      const now = clock();
      if (start < now.plus({ hours: 1 }) || start > now.plus({ days: 30 }))
        throw new AppError(
          400,
          "OUTSIDE_BOOKING_WINDOW",
          "Choose a slot at least one hour ahead and within the next 30 days.",
        );
      const mentor = eligible(start)[0];
      if (!mentor)
        throw new AppError(
          409,
          "NO_MENTORS_AVAILABLE",
          "This time has just filled up. Please choose another time or date.",
        );
      const id = randomUUID(),
        parentId = randomUUID(),
        link = `/demo/${id}`;
      db.prepare(
        "INSERT INTO parents (id, name, email, timezone) VALUES (?, ?, ?, ?)",
      ).run(parentId, name, email, input.timezone);
      db.prepare(
        "INSERT INTO bookings (id, parent_id, mentor_id, utc_start_time, utc_end_time, meeting_link, created_at, request_key, request_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        parentId,
        mentor.id,
        utc(start),
        utc(start.plus({ minutes: 30 })),
        link,
        utc(now),
        key,
        fingerprint,
      );
      const mentorEmail = db
        .prepare("SELECT email FROM mentors WHERE id = ?")
        .get(mentor.id).email;
      for (const recipient of [
        { email, name, zone: input.timezone },
        { email: mentorEmail, name: mentor.name, zone: mentor.timezone },
      ]) {
        const previewId = randomUUID();
        const mode = config.mailMode || "preview";
        const classUrl = new URL(
          link,
          config.appOrigin || "http://localhost:3001",
        ).href;
        db.prepare(
          "INSERT INTO email_previews (id, booking_id, recipient, subject, body, delivery_mode) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
          previewId,
          id,
          recipient.email,
          "Your Codeyoung trial is confirmed",
          `Hi ${recipient.name},\nYour 30-minute trial starts ${localLabel(utc(start), recipient.zone)}.\nEnds: ${localLabel(utc(start.plus({ minutes: 30 })), recipient.zone)}.\nParent: ${name}\nMentor: ${mentor.name}\nClass link: ${classUrl}\nBooking reference: ${id}\n${mode === "preview" ? "This is a demo confirmation preview; no email has been sent." : "Please join using the class link at the scheduled time."}`,
          mode,
        );
        if (mode === "smtp")
          db.prepare(
            "INSERT INTO email_outbox (preview_id, next_attempt_at) VALUES (?, ?)",
          ).run(previewId, utc(now));
      }
      const result = confirmation(id);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return { mentors, slots, book, confirmation };
}
