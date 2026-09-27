# Codeyoung · Trial class booking

**Shreyas Damle — SCEM** · Full-Stack Development assignment

A React application that lets parents select a local time and book a free trial with an automatically assigned mentor. Node/Express and SQLite enforce the two-class daily cap, handle competing requests, and prepare confirmations in each recipient’s timezone.

[Requirements and evidence](docs/REQUIREMENTS.md) · [Engineering decisions](docs/ENGINEERING.md) · [Submission checklist](docs/SUBMISSION.md) · [AI transcript](TRANSCRIPT.md)

Repository: [ShreyasDamle2805/codeyoung-trial-booking](https://github.com/ShreyasDamle2805/codeyoung-trial-booking) · [GitHub checks](https://github.com/ShreyasDamle2805/codeyoung-trial-booking/actions) · **[Manual test checklist](docs/MANUAL_TESTS.md)**

Verified locally: **15 backend tests and 8 browser tests pass**, along with lint, formatting, and the production build. [Verification record](docs/VERIFICATION.md)

## Quick start

Prerequisites: **Node.js 24+** and npm. No database server or email credentials are needed for preview mode. On Node 24, the built-in SQLite driver can print an experimental warning.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The API listens on `127.0.0.1:3001`. In Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

To serve the compiled frontend and API together:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. The development proxy and production server both keep browser API calls on the same origin. Fonts are bundled locally, so rendering does not depend on Google Fonts.

## Parent journey

1. Confirm the detected timezone or select another IANA timezone.
2. Pick a date and a half-hour slot. Every slot includes its offset, so repeated DST hours are distinguishable.
3. Enter a parent name and email. The backend assigns an eligible mentor when confirming.
4. View both parties’ local times, open the dummy classroom, and inspect the two confirmation messages.

The confirmation survives a refresh in the same browser tab. If a slot fills during entry, choose another time without re-entering contact details. Retrying after a lost response reuses the same booking request key.

## Email delivery

The default **preview mode** saves both email bodies in SQLite and displays them after confirmation; it sends nothing. **SMTP mode** delivers both messages using a durable outbox. Email failure does not undo a confirmed booking.

For a local demonstration, use [Mailpit](https://mailpit.axllent.org/docs/install/), which captures SMTP messages without delivering them to real people. Run its downloaded binary, or with Docker:

```sh
docker run --rm --name codeyoung-mailpit -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit
```

Copy `.env.example` to `.env` at the repository root and set:

```dotenv
MAIL_MODE=smtp
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
APP_ORIGIN=http://localhost:3001
```

Restart the app, make a **new** booking, and open **http://localhost:8025**. Both parent and mentor messages should appear within a few seconds. Old preview messages are not retroactively delivered. Use `APP_ORIGIN=http://localhost:5173` when running the Vite development server; this origin is used for the absolute classroom URL in each email.

For an external SMTP provider, configure its host, port, credentials, sender, and TLS settings in `.env`. Use ten real, unique mentor addresses in `MENTOR_EMAILS`; the fictional seed addresses are for local capture only. No external delivery has been performed or claimed during development.

```sh
npm run mail:status
npm run mail:retry
```

The second command requeues messages that exhausted five attempts. The running SMTP worker picks them up. Details of retries, leases, and the at-least-once delivery limitation are in [ENGINEERING.md](docs/ENGINEERING.md#email-failure-policy).

## Rules and assumptions

- Ten fictional mentors, normally in `Asia/Kolkata`, each with a maximum of two classes per local day.
- Thirty-minute classes, UTC half-hour start boundaries, one-hour notice, and a thirty-day booking window.
- Round-the-clock availability, because the assignment does not supply mentor working schedules. This is an explicit demo assumption, not Codeyoung’s claimed operating policy.
- Least-loaded eligible mentor first; ID breaks ties. Overlapping sessions are rejected; adjacent sessions are allowed.
- Sessions crossing local midnight consume capacity on both dates they touch. A session ending exactly at midnight belongs only to the preceding date.
- Around twenty parents per day is expected demand, not a separate quota on a parent-local date.
- Slots are rechecked inside a write transaction. `BEGIN IMMEDIATE`, a unique idempotency key, and parameterized SQL protect allocation and request retries.
- No payments, authentication, actual video room, cancellation, rescheduling, or waitlist. See the engineering notes for scope reasoning and deployment limitations.

## Architecture

```text
backend/src/
  config.js                         validated environment configuration
  db/connection.js, schema.sql       SQLite creation and idempotent mentor seed
  routes/api.js                     HTTP endpoints
  services/bookingService.js         allocation and atomic booking writes
  services/timezoneService.js        IANA validation and time formatting
  services/emailService.js           durable SMTP dispatch and retries
  app.js, server.js                  Express setup and lifecycle
backend/test/                       service, HTTP, SMTP, and concurrency tests
frontend/src/
  App.jsx                           booking journey coordination
  components/                       calendar, times, details, confirmation
  hooks/                            availability and booking request state
  api.js, styles.css                 API client and responsive design
tests/                              Playwright and axe accessibility checks
tools/                              transcript export and outbox inspection
docs/                               decisions, acceptance matrix, submission
.github/workflows/ci.yml             repeatable Linux verification
```

SQLite lives at `backend/data/booking.sqlite`, which is gitignored. Schema creation is additive and existing bookings are preserved. `parents` records capture the contact details for each booking; they are not user accounts.

## Configuration

| Variable                     | Default / purpose                                            |
| ---------------------------- | ------------------------------------------------------------ |
| `PORT`, `HOST`               | `3001`, `127.0.0.1`                                          |
| `DB_PATH`                    | `backend/data/booking.sqlite`; `:memory:` for isolated tests |
| `APP_ORIGIN`                 | `http://localhost:<PORT>`; absolute email links              |
| `MAIL_MODE`                  | `preview` or `smtp`                                          |
| `MAIL_FROM`                  | `Codeyoung Trial Demo <trial@example.com>`                   |
| `SMTP_HOST`, `SMTP_PORT`     | Host required for SMTP mode; port defaults to `1025`         |
| `SMTP_SECURE`                | `true` for immediate TLS, typically port 465                 |
| `SMTP_REQUIRE_TLS`           | `true` to require STARTTLS, typically port 587               |
| `SMTP_USER`, `SMTP_PASSWORD` | Optional pair for authenticated SMTP                         |
| `MENTOR_EMAILS`              | Optional ten unique comma-separated mentor addresses         |

`.env` is read from the repository root; existing environment variables take precedence. Never commit credentials. Port and email-mode configuration are checked before accepting bookings.

## API

| Method | Path                                                   | Result                                                                        |
| ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| GET    | `/api/health`                                          | Service health                                                                |
| GET    | `/api/config`                                          | Public email mode only                                                        |
| GET    | `/api/mentors`                                         | Ten mentor names, zones, and daily limits                                     |
| GET    | `/api/slots?date=YYYY-MM-DD&timezone=America/New_York` | Slots for that parent-local date, UTC values, local labels, offsets, capacity |
| POST   | `/api/bookings`                                        | Confirmed booking and both local-time email bodies                            |

Booking requests require an `Idempotency-Key` header (use a UUID) and JSON:

```json
{
  "name": "Alex Taylor",
  "email": "alex@example.com",
  "timezone": "America/New_York",
  "start": "2026-09-26T10:00:00.000Z"
}
```

Use an actual slot returned by the API within the current booking window. Errors have `error` and `message`. No capacity returns HTTP 409 with `NO_MENTORS_AVAILABLE` and a `suggestion`; malformed input returns 400; database lock contention returns a retryable 503. There is no public booking-list or parent-details endpoint.

## Verification

On Windows, browser checks use installed Microsoft Edge. On CI, they use Playwright Chromium. To use another installed browser locally, set `PLAYWRIGHT_CHANNEL`; see [Playwright browser setup](https://playwright.dev/docs/browsers).

Browser tests need Chromium installed once first: `npx playwright install --with-deps chromium` (this is what the CI workflow does automatically; a local machine needs to run it manually the first time).

```sh
npm run format:check
npm run check
```

`check` runs lint, backend tests, production build, and browser tests. Individually:

```sh
npm run lint
npm test
npm run build
npm run test:browser
```

Browser tests start an isolated server on port 3011 and use an in-memory database. Tests do not alter ordinary bookings or send email to external recipients. They cover local times, US/UK DST transitions, capacity, overlapping and adjacent sessions, mentor midnight, database rollback, concurrent connections, SMTP delivery/retries, invalid input, lost responses, stale availability, mobile overflow, and common accessibility issues.

The GitHub workflow installs Chromium and runs the same checks on Linux. Its remote result must be verified after publishing; creating the workflow locally does not mean GitHub has run it.

For hands-on testing, follow [MANUAL_TESTS.md](docs/MANUAL_TESTS.md). The optional `npm run manual:server` command runs the same integrated app on port 3012 with a disposable database and email previews. Its `--now` option makes API-only DST tests reproducible without changing your system clock; it is not part of the production server.

## Transcript and submission

`TRANSCRIPT.md` preserves the available user prompts and user-facing assistant responses, including progress updates and clarification answers. It excludes raw tool logs and IDE-injected metadata, makes workspace links relative, and includes the earlier supplied conversation and review as clearly labelled source attachments. It does not summarize or rewrite the dialogue. Refresh it after further AI work:

```sh
node tools/export-transcript.mjs path/to/session.jsonl
```

Additional session files can be supplied as additional arguments. The original attachment is preserved in `docs/provided-context.txt`. Review its recruitment correspondence before publishing. The transcript is a snapshot up to its export time, not a fabricated record of future messages.

The submission email has not been sent. [SUBMISSION.md](docs/SUBMISSION.md) contains Shreyas Damle’s SCEM draft with the repository URL and the remaining checklist. Verify that the current `main` commit is visible and its GitHub checks pass before submitting.
