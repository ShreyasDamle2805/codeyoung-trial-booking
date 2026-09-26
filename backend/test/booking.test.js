import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { openDatabase } from "../src/db/connection.js";
import { createBookingService } from "../src/services/bookingService.js";
import { createApp } from "../src/app.js";

function setup(t, now = "2026-09-25T00:00:00Z") {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  return {
    db,
    service: createBookingService(db, () => DateTime.fromISO(now)),
    clock: () => DateTime.fromISO(now),
  };
}
const input = (start = "2026-09-26T10:00:00Z") => ({
  name: "Test Parent",
  email: "parent@example.com",
  timezone: "America/New_York",
  start,
});

test("seeds ten mentors and confirms local times with two email previews", (t) => {
  const { service } = setup(t);
  assert.equal(service.mentors().length, 10);
  const result = service.book(input(), randomUUID());
  assert.match(result.parent.localTime, /6:00 AM/);
  assert.match(result.mentor.localTime, /3:30 PM/);
  assert.equal(result.emailPreviews.length, 2);
  assert.equal(result.meetingLink, `/demo/${result.id}`);
});
test("ten simultaneous slots fill and adjacent slots permit twenty total bookings", (t) => {
  const { service, db } = setup(t);
  for (let i = 0; i < 10; i++) service.book(input(), randomUUID());
  assert.throws(() => service.book(input(), randomUUID()), {
    code: "NO_MENTORS_AVAILABLE",
  });
  for (let i = 0; i < 10; i++)
    service.book(input("2026-09-26T10:30:00Z"), randomUUID());
  assert.throws(
    () => service.book(input("2026-09-26T12:00:00Z"), randomUUID()),
    { code: "NO_MENTORS_AVAILABLE" },
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n, 20);
  assert.equal(
    db
      .prepare(
        "SELECT MAX(n) AS n FROM (SELECT COUNT(*) AS n FROM bookings GROUP BY mentor_id)",
      )
      .get().n,
    2,
  );
});
test("daily cap resets at mentor midnight rather than UTC midnight", (t) => {
  const { service, db } = setup(t);
  db.exec("DELETE FROM mentors WHERE id > 1");
  service.book(input("2026-09-26T17:30:00Z"), randomUUID());
  service.book(input("2026-09-26T18:00:00Z"), randomUUID());
  assert.throws(
    () => service.book(input("2026-09-26T17:00:00Z"), randomUUID()),
    { code: "NO_MENTORS_AVAILABLE" },
  );
  assert.ok(service.book(input("2026-09-26T18:30:00Z"), randomUUID()));
});
test("classes touching midnight count against both local dates", (t) => {
  const { service, db } = setup(t);
  db.exec(
    "DELETE FROM mentors WHERE id > 1; UPDATE mentors SET timezone = 'Asia/Kathmandu' WHERE id = 1",
  );
  service.book(input("2026-09-26T18:00:00Z"), randomUUID());
  service.book(input("2026-09-26T18:30:00Z"), randomUUID());
  assert.throws(
    () => service.book(input("2026-09-26T19:00:00Z"), randomUUID()),
    { code: "NO_MENTORS_AVAILABLE" },
  );
});
test("retries are idempotent, changed payloads reject, and failed bookings roll back", (t) => {
  const { service, db } = setup(t),
    key = randomUUID();
  const first = service.book(input(), key);
  assert.equal(service.book(input(), key).id, first.id);
  assert.throws(() => service.book({ ...input(), name: "Changed" }, key), {
    code: "REQUEST_KEY_REUSED",
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM bookings").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM parents").get().n, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM email_previews").get().n,
    2,
  );
});
test("invalid input, off-grid timestamps, past times, and distant times reject", (t) => {
  const { service } = setup(t);
  for (const body of [
    null,
    { ...input(), name: "" },
    { ...input(), email: "bad" },
    { ...input(), timezone: "bad" },
    input("2026-09-26T10:01:00Z"),
    input("2026-09-26T10:00:00"),
    input("2026-09-24T10:00:00Z"),
    input("2027-09-26T10:00:00Z"),
  ]) {
    assert.throws(
      () => service.book(body, randomUUID()),
      (error) => error.status === 400,
    );
  }
  assert.throws(() => service.slots("2026-02-30", "Europe/London"), {
    code: "INVALID_DATE",
  });
});
test("failure saving confirmations rolls back the parent and booking together", (t) => {
  const { service, db } = setup(t);
  db.exec(
    "CREATE TRIGGER reject_preview BEFORE INSERT ON email_previews BEGIN SELECT RAISE(ABORT, 'preview unavailable'); END",
  );
  assert.throws(
    () => service.book(input(), randomUUID()),
    /preview unavailable/,
  );
  for (const table of ["parents", "bookings", "email_previews"])
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  db.exec("DROP TRIGGER reject_preview");
  assert.ok(service.book(input(), randomUUID()));
});
test("US and UK spring days omit nonexistent times; fall days expose both offsets", () => {
  for (const [zone, spring, fall, repeatedHour] of [
    ["America/New_York", "2026-03-08", "2026-11-01", "1:00 AM"],
    ["Europe/London", "2026-03-29", "2026-10-25", "1:00 AM"],
  ]) {
    const db = openDatabase(":memory:");
    try {
      const springService = createBookingService(db, () =>
        DateTime.fromISO(spring).minus({ days: 2 }).toUTC(),
      );
      const springSlots = springService.slots(spring, zone);
      assert.equal(springSlots.length, 46);
      const missingHour = zone === "Europe/London" ? "1:00 AM" : "2:00 AM";
      assert.equal(
        springSlots.filter((slot) => slot.label === missingHour).length,
        0,
      );
      const fallService = createBookingService(db, () =>
        DateTime.fromISO(fall).minus({ days: 2 }).toUTC(),
      );
      const fallSlots = fallService.slots(fall, zone);
      assert.equal(fallSlots.length, 50);
      const repeated = fallSlots.filter((slot) => slot.label === repeatedHour);
      assert.equal(repeated.length, 2);
      assert.notEqual(repeated[0].offset, repeated[1].offset);
      assert.notEqual(repeated[0].start, repeated[1].start);
      for (const slot of repeated)
        assert.ok(
          fallService.book(
            { ...input(slot.start), timezone: zone },
            randomUUID(),
          ),
        );
    } finally {
      db.close();
    }
  }
});
test("API accepts only ten competing requests for one slot and returns structured conflicts", async (t) => {
  const { db, clock } = setup(t);
  const server = createApp(db, clock).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        fetch(`${url}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify(input()),
        }),
      ),
    );
    assert.equal(responses.filter((r) => r.status === 201).length, 10);
    assert.equal(responses.filter((r) => r.status === 409).length, 10);
    assert.equal(
      (await responses.find((r) => r.status === 409).json()).error,
      "NO_MENTORS_AVAILABLE",
    );
    const invalid = await fetch(`${url}/api/slots?date=oops&timezone=bad`);
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
