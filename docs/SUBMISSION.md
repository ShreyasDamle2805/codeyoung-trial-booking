# Submission preparation — Shreyas Damle, SCEM

The supplied email specifies **28 September 2026, 6:00 PM IST**. Submit before that deadline.

## Final checklist

- [ ] Run `npm ci`, `npm run format:check`, and `npm run check` from a clean checkout.
- [ ] Follow the README without relying on any locally installed project dependencies.
- [ ] Review `ENGINEERING.md` and be able to explain the transaction, timezone boundaries, retry behavior, and scope decisions.
- [ ] Regenerate `TRANSCRIPT.md` after the final AI exchange. Include any separate AI sessions not present in this workspace export.
- [ ] Review the supplied correspondence and transcript before publishing; they include the original recruitment contact details.
- [ ] Verify [codeyoung-trial-booking](https://github.com/ShreyasDamle2805/codeyoung-trial-booking) opens in a logged-out browser and `main` contains the source, README, lockfile, docs, and transcript.
- [ ] Confirm the CI workflow passes on GitHub. Local tests do not prove the remote workflow has run.
- [ ] Complete the [manual test checklist](MANUAL_TESTS.md) and record any remaining defects.
- [ ] Send the email and verify it appears in Sent. The app and coding agent have not sent this submission.

Database files, dependency folders, `.env`, and test artifacts are gitignored. A live deployment is optional; do not add a live-demo link unless it is tested and reachable.

## Email draft

**To:** campus.ka@talentiseglobal.com

**Subject:** Codeyoung Assignment Task - Shreyas Damle - SCEM

Dear Selection Team,

Please find my submission for the Codeyoung Full-Stack Development assignment.

GitHub repository: https://github.com/ShreyasDamle2805/codeyoung-trial-booking

The repository includes the React frontend, Node.js/Express backend, SQLite schema and seed data, local setup instructions, automated tests, engineering decisions, and the AI interaction transcript.

The application handles parent and mentor timezones, daylight saving transitions, automatic mentor assignment, a maximum of two classes per mentor-local day, booking conflicts, and unique demo classroom links. It includes configurable SMTP confirmations with a durable retry queue and a zero-setup email-preview mode.

The README contains the commands to run and verify the project.

Regards,
Shreyas Damle
SCEM

## Suggested evaluator demonstration

1. Start the compiled app using `npm run build` and `npm start`.
2. Select `America/New_York`, choose tomorrow, and book a slot.
3. Show the parent-local and India-local times, both email previews, and the demo room.
4. For actual SMTP, start Mailpit using the README instructions, switch to SMTP mode, restart, and make a new booking. Show both messages in its local inbox.
5. Run the automated checks to demonstrate capacity, race handling, DST, and failure recovery. Avoid manually creating twenty repetitive bookings just to demonstrate a tested rule.
