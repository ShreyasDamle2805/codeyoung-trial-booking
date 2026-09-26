# Manual acceptance tests

Run this checklist before submitting. Record **Pass / Fail / Not run** and evidence for each row. Expected results are specified below; they are not a claim that you have already performed the manual checks.

Repository: https://github.com/ShreyasDamle2805/codeyoung-trial-booking

## 1. Start the integrated app

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3001**. Use `npm.cmd` instead of `npm` if PowerShell blocks `npm.ps1`. Stop an already-running server with Ctrl+C in its terminal before starting another instance on the same port.

Keep default preview email mode for the initial cases. Use a new private/incognito window when you want an empty browser session. The ordinary app uses a persistent SQLite database; restarting it must not erase bookings.

For development integration separately, stop `npm start`, run `npm run dev`, and open **http://localhost:5173**. The frontend should call the backend through Vite’s `/api` proxy without CORS errors. Repeat UI-03 below.

## 2. Frontend and integrated booking

| ID                         | Steps                                                                                                                                                                                                          | Expected result                                                                                                                                                                                                          | Result / evidence |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| UI-01 Startup              | Open the app and DevTools → Network. Load `/api/health`, `/api/config`, and `/api/mentors` in browser tabs.                                                                                                    | Healthy JSON responses; `preview` mode by default; exactly ten mentors with daily limits of two. Page styles and fonts load locally.                                                                                     |                   |
| UI-02 Timezone/date        | Select New York, then London, then Kolkata. Choose tomorrow in each zone.                                                                                                                                      | Times are labelled in the selected zone with UTC offsets. Continue is disabled until a slot is selected. Changing date or zone clears the old selection.                                                                 |                   |
| UI-03 Happy path           | Choose a future slot → Continue → enter `Shreyas Test` and `parent@example.com` → Confirm. Inspect the booking request in Network.                                                                             | POST returns 201, one booking ID, an assigned mentor, parent-local and mentor-local times, and a `/demo/<id>` link. The UTC instant corresponds to the chosen local slot.                                                |                   |
| UI-04 Exact conversion     | In the frozen lab described below, book `2026-09-27T10:00:00Z` with parent zone `America/New_York`.                                                                                                            | Parent: 27 Sep, **6:00 AM, UTC−04:00**. Mentor: 27 Sep, **3:30 PM, UTC+05:30**. With `Europe/London`, parent time is **11:00 AM, UTC+01:00**.                                                                            |                   |
| UI-05 Required fields      | Try an empty name, empty email, and `invalid-email`. Also try a name containing only spaces.                                                                                                                   | Browser or server rejects invalid input. No confirmation is shown and no booking is created for the failed request.                                                                                                      |                   |
| UI-06 Change time          | Enter a name and email, then use Change or Back to times. Select another slot.                                                                                                                                 | Contact details are retained; the new slot is displayed before submission.                                                                                                                                               |                   |
| UI-07 Preview messages     | On confirmation, expand both email previews.                                                                                                                                                                   | Two recipients: parent and assigned mentor. Each message has that recipient’s local start/end time, timezone, booking reference, and the **same absolute** class URL. UI clearly says no email was sent in preview mode. |                   |
| UI-08 Dummy classroom      | Open the class link, then use Back to booking.                                                                                                                                                                 | A placeholder classroom opens, not a broken/404 page. It makes clear that this is a demo room.                                                                                                                           |                   |
| UI-09 Confirmation refresh | Refresh the confirmation tab.                                                                                                                                                                                  | Same confirmation and booking ID; no new POST request and no duplicate booking. Closing the browser session may clear this tab-scoped recovery.                                                                          |                   |
| UI-10 New booking          | Click Book another trial and complete another reservation. Compare Network request headers.                                                                                                                    | A **new** idempotency key and new booking ID are used. The previous confirmation is not silently reused.                                                                                                                 |                   |
| UI-11 Small screen         | Use responsive mode at 390×844, then 320×720. Choose a slot, fill the form, and confirm.                                                                                                                       | No horizontal scrolling or obscured controls. Calendar, slot list, form, confirmation, and error messages remain usable.                                                                                                 |                   |
| UI-12 Keyboard             | Use Tab / Shift+Tab and Enter through the flow without a mouse.                                                                                                                                                | Visible focus; named controls; date/slot buttons activate; focus moves to the new heading after a step change and after confirmation.                                                                                    |                   |
| UI-13 Availability failure | Set DevTools Network to Offline, then change date. Restore Online and select Try again.                                                                                                                        | A readable loading error, no stale selectable slots, and a working retry.                                                                                                                                                |                   |
| UI-14 Submission failure   | Fill the form; go Offline before confirming; restore Online and retry.                                                                                                                                         | Helpful network error; same request key on retry; one confirmed booking. The automated browser test additionally covers a committed booking whose response is lost.                                                      |                   |
| UI-15 Filled-slot race     | In a fresh real-time lab, select a slot and advance to details. Copy its `start` from the Network slot response. Use the console helper below to book that instant ten times, then submit the still-open form. | Parent gets a structured capacity error and can choose another slot without losing name/email.                                                                                                                           |                   |
| UI-16 Persistence          | In the normal app, record the selected slot’s available count before and after a booking. Stop/restart the backend; open a fresh browser session and inspect that slot again.                                  | Its capacity remains reduced. Existing bookings survive backend restart; the lab intentionally does not persist them.                                                                                                    |                   |

## 3. Isolated API lab

Use this lab for capacity tests so ordinary bookings are untouched. It runs the **same Express app, services, schema, and compiled React frontend**, with a fresh in-memory database and email previews only.

```sh
npm run manual:server
```

Open **http://localhost:3012**. Stop with Ctrl+C and restart to reset all lab bookings. For deterministic API examples below, restart with a frozen backend clock:

```sh
npm run manual:server -- --now=2026-09-26T00:00:00Z
```

The frozen clock only affects the lab API. The browser calendar continues to use your device’s real date, so use direct API calls for the historical/future examples. No production endpoint can change the clock.

In the browser DevTools Console **on localhost:3012**, define this helper. It refuses to run on the normal app’s port. Read the code before executing it; it creates bookings only when you call `book`.

```js
if (location.port !== "3012")
  throw new Error("Use the isolated lab on port 3012");
window.lab = {
  async request(path, options = {}) {
    const response = await fetch(`/api${path}`, options);
    return { status: response.status, body: await response.json() };
  },
  slots(date, timezone) {
    return this.request(
      `/slots?date=${date}&timezone=${encodeURIComponent(timezone)}`,
    );
  },
  book(start, key = crypto.randomUUID(), overrides = {}) {
    return this.request("/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({
        name: "Manual Parent",
        email: "manual@example.com",
        timezone: "America/New_York",
        start,
        ...overrides,
      }),
    });
  },
};
```

Basic call:

```js
await lab.book("2026-09-27T10:00:00Z");
```

Inspect the returned `status` and `body`, not only whether `fetch` resolved. HTTP 400/409 responses are expected outcomes in negative tests.

## 4. Validation and retries

Use the frozen September lab. Restart it first if you previously exhausted capacity.

| ID                         | Console call / steps                                                                                     | Expected result                                                                        | Result / evidence |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------- |
| API-01 Seed/config         | `await lab.request('/mentors')` and `await lab.request('/config')`                                       | 200, ten mentors, each cap two; preview mode.                                          |                   |
| API-02 Invalid timezone    | `await lab.slots('2026-09-27', 'Invalid/Zone')`                                                          | 400, `INVALID_TIMEZONE`.                                                               |                   |
| API-03 Invalid date        | `await lab.slots('2026-02-30', 'Europe/London')`                                                         | 400, `INVALID_DATE`.                                                                   |                   |
| API-04 Missing UTC marker  | `await lab.book('2026-09-27T10:00:00')`                                                                  | 400, `INVALID_TIME`; local wall-clock strings are not guessed.                         |                   |
| API-05 Off-grid start      | `await lab.book('2026-09-27T10:15:00Z')`                                                                 | 400, `INVALID_TIME`; starts must be on the UTC half-hour grid.                         |                   |
| API-06 Lead time           | `await lab.book('2026-09-26T00:30:00Z')`, then `await lab.book('2026-09-26T01:00:00Z')`                  | First is 400 (`OUTSIDE_BOOKING_WINDOW`); second is 201 at the exact one-hour boundary. |                   |
| API-07 Horizon             | `await lab.book('2026-10-26T00:00:00Z')`, then `await lab.book('2026-10-26T00:30:00Z')`                  | Exact thirty-day boundary is 201; thirty days plus thirty minutes is 400.              |                   |
| API-08 Invalid parent      | `await lab.book('2026-09-27T10:00:00Z', crypto.randomUUID(), {email:'bad'})`                             | 400, `INVALID_INPUT`; no booking. Repeat with `{name:' '}`.                            |                   |
| API-09 Invalid request key | `await lab.book('2026-09-27T10:00:00Z', 'short')`                                                        | 400, `INVALID_REQUEST_KEY`.                                                            |                   |
| API-10 Malformed JSON      | `await lab.request('/bookings', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{'})` | 400 with JSON error response, no server crash.                                         |                   |
| API-11 Unknown route       | `await lab.request('/not-a-real-route')`                                                                 | 404, structured JSON.                                                                  |                   |

For API-12, run these sequentially:

```js
var retryKey = crypto.randomUUID();
var original = await lab.book("2026-09-27T11:00:00Z", retryKey);
var retried = await lab.book("2026-09-27T11:00:00Z", retryKey);
console.log(
  original.status,
  retried.status,
  original.body.id === retried.body.id,
);
await lab.book("2026-09-27T11:00:00Z", retryKey, { name: "Changed Parent" });
```

**Expected:** both unchanged calls return 201 and the equality is `true`; changing the payload with the same key returns **409 `REQUEST_KEY_REUSED`**. Only one booking and one pair of confirmations exist for that key.

## 5. Overlap, concurrent requests, daily capacity, and midnight

Restart the frozen September lab and re-create the helper. These steps must run on a **fresh** lab database. Run each block in order.

```js
// CAP-01: Twenty parents compete for the same instant.
var first = await Promise.all(
  Array.from({ length: 20 }, (_, i) =>
    lab.book("2026-09-27T10:00:00Z", crypto.randomUUID(), {
      email: `parent-${i}@example.com`,
    }),
  ),
);
console.log("Accepted:", first.filter((r) => r.status === 201).length);
console.log("Rejected:", first.filter((r) => r.status === 409).length);
```

**Expected:** exactly **10 accepted, 10 rejected**. The ten successes have ten distinct mentor names; no mentor teaches overlapping classes.

```js
// CAP-02: Adjacent classes are allowed.
var second = await Promise.all(
  Array.from({ length: 10 }, (_, i) =>
    lab.book("2026-09-27T10:30:00Z", crypto.randomUUID(), {
      email: `second-parent-${i}@example.com`,
    }),
  ),
);
console.log("Accepted:", second.filter((r) => r.status === 201).length);
var perMentor = {};
for (var result of [...first, ...second].filter((r) => r.status === 201)) {
  var mentor = result.body.mentor.name;
  perMentor[mentor] = (perMentor[mentor] || 0) + 1;
}
console.table(perMentor);
```

**Expected:** ten more successes, **twenty confirmed bookings total**, and exactly **two per mentor**.

```js
// CAP-03: A different time on the same India-local day is still full.
await lab.book("2026-09-27T17:00:00Z");
// CAP-04: India midnight resets capacity, although the UTC date has not changed.
await lab.book("2026-09-27T18:30:00Z");
```

**Expected:** first returns **409 `NO_MENTORS_AVAILABLE`** with a suggestion. Second returns **201** because it starts at **28 September 00:00 in Kolkata**. Open the slot response for 27 September in Kolkata: remaining future slots on that exhausted local day have zero capacity. An all-zero day produces the UI’s no-times-available state.

The automatic unit suite additionally checks a class spanning midnight in a quarter-hour-offset timezone. The default mentors are all in Kolkata, where half-hour classes align with midnight, so that extra scenario needs an injected mentor fixture rather than manual production data edits.

## 6. Daylight saving: four exact cases

For each row, stop the lab, start it with that row’s `--now`, and recreate the Console helper. Do **not** change your operating-system clock. The requested day is safely within thirty days of the lab clock.

| ID               | Start command suffix            | Slot date    | Timezone           | Expected slots and local labels                                          | Result / evidence |
| ---------------- | ------------------------------- | ------------ | ------------------ | ------------------------------------------------------------------------ | ----------------- |
| DST-01 US spring | `-- --now=2026-03-06T00:00:00Z` | `2026-03-08` | `America/New_York` | **46** slots; no `2:00 AM` or `2:30 AM`.                                 |                   |
| DST-02 US fall   | `-- --now=2026-10-30T00:00:00Z` | `2026-11-01` | `America/New_York` | **50** slots; `1:00 AM` occurs twice, once UTC−04:00 and once UTC−05:00. |                   |
| DST-03 UK spring | `-- --now=2026-03-27T00:00:00Z` | `2026-03-29` | `Europe/London`    | **46** slots; no `1:00 AM` or `1:30 AM`.                                 |                   |
| DST-04 UK fall   | `-- --now=2026-10-23T00:00:00Z` | `2026-10-25` | `Europe/London`    | **50** slots; `1:00 AM` occurs twice, once UTC+01:00 and once UTC+00:00. |                   |

Example for US fall:

```sh
npm run manual:server -- --now=2026-10-30T00:00:00Z
```

```js
var day = await lab.slots("2026-11-01", "America/New_York");
console.log(day.status, day.body.slots.length); // 200, 50
var repeated = day.body.slots.filter((slot) => slot.label === "1:00 AM");
console.table(repeated); // distinct UTC starts and offsets
await lab.book(repeated[0].start);
await lab.book(repeated[1].start);
```

**Expected:** both bookings succeed, with different UTC starts and correct parent-local offsets. For the UK case pass `{timezone:'Europe/London'}` as the third `book` argument. Use `console.table(day.body.slots)` to inspect every label.

## 7. Actual email delivery and outage recovery

These cases use the **normal app**, not the preview-only lab. Use [Mailpit setup in the README](../README.md#email-delivery). Configure local SMTP in `.env`, restart the app, and open Mailpit at **http://localhost:8025**. The messages remain local; real email accounts are unnecessary.

| ID                        | Steps                                                                                                                         | Expected result                                                                                                                                                                    | Result / evidence |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| MAIL-01 Delivery          | Set `MAIL_MODE=smtp`, local SMTP host/port, and correct `APP_ORIGIN`. Start Mailpit, restart app, create a new booking.       | Within a few seconds, Mailpit captures **two** messages. Each has its recipient’s local date/time, and both link to the same working classroom URL.                                |                   |
| MAIL-02 Delivery record   | Run `npm run mail:status` after delivery.                                                                                     | The two new outbox entries are `sent`, meaning accepted by SMTP; this is not a guarantee of external inbox delivery.                                                               |                   |
| MAIL-03 SMTP outage       | Stop Mailpit, then book another class while the app remains running.                                                          | Booking still succeeds. `mail:status` shows pending messages; the booking is not lost or rolled back because SMTP is unavailable.                                                  |                   |
| MAIL-04 Recovery          | Restart Mailpit within the retry period and wait until the next attempt.                                                      | Only pending messages are delivered; previously sent ones are not routinely sent again. First retry is about 30 seconds later, then 60, 120, and 240 seconds, plus worker polling. |                   |
| MAIL-05 Exhausted retries | Keep Mailpit stopped through five attempts (roughly 8 minutes). Run `mail:status`; restart Mailpit; run `npm run mail:retry`. | Failed messages are visible, can be requeued, then delivered by the running worker. Reservation remains confirmed throughout.                                                      |                   |
| MAIL-06 Preview mode      | Return `.env` to `MAIL_MODE=preview`, restart, and create a new booking.                                                      | Two preview bodies appear; no new SMTP messages are queued or delivered.                                                                                                           |                   |

If you restart Mailpit without persistent storage, its captured inbox may be empty even though the app correctly records earlier sends. Track the new booking reference, not only the total inbox count. Outbox counts may include earlier tests. Reset `.env` to your preferred mode afterward; it is gitignored.

## 8. Regression commands and sign-off

```sh
npm run format:check
npm run check
```

These cover transaction rollback, independent SQLite connections, worker leases, SMTP failures, and accessibility details that are cumbersome to reproduce manually. The automated test databases are isolated from ordinary bookings.

| Sign-off                               | Value                                              |
| -------------------------------------- | -------------------------------------------------- |
| Tester                                 | Shreyas Damle                                      |
| Tested commit                          | Record `git rev-parse --short HEAD`                |
| Date/browser                           | Fill in                                            |
| Manual cases passed / failed / not run | Fill in                                            |
| Remaining defects                      | Fill in; do not mark unresolved failures as passed |

Passing these tests verifies the assignment behavior. It does not send the submission email or replace checking the real GitHub repository link in a logged-out browser.
