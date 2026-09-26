# Verification record

Verified locally on **25 September 2026** and rechecked before publication on **26 September 2026**, Windows, Node **24.13.1**, with Microsoft Edge through Playwright.

| Check                                            | Observed result                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Backend, HTTP, SQLite contention, and SMTP tests | **15 passed**                                                           |
| Browser tests                                    | **8 passed**                                                            |
| Automated WCAG A/AA scans                        | No detected violations across time selection, details, and confirmation |
| Keyboard booking                                 | Passed, including focus after step changes and confirmation             |
| Lint                                             | Passed                                                                  |
| Prettier formatting                              | Passed                                                                  |
| Production build                                 | Passed                                                                  |
| Desktop/mobile screenshots                       | Inspected; mobile overflow check passed                                 |
| Running app `/api/config`                        | Returned `{ "mailMode": "preview" }`                                    |

The SMTP integration test starts a real SMTP server on loopback, receives both messages, verifies each recipient’s timezone and shared absolute class URL, and checks that sent messages are not sent again during ordinary retries. Separate tests cover outages, expired worker leases, and exhausted retries.

The concurrency test uses four workers with independent connections to the same temporary SQLite file. Each phase makes twenty competing requests: ten succeed in the first slot, ten in the adjacent slot, and none in a third slot after the mentor-local daily allowance is exhausted.

The browser suite covers the full flow, confirmation refresh, a new booking’s fresh request key, failed availability recovery, a 409 capacity conflict, a committed booking whose response is lost, mobile layout, accessibility, and keyboard operation.

The published implementation commit [`c13f371`](https://github.com/ShreyasDamle2805/codeyoung-trial-booking/commit/c13f37175738c0294960e3ddb96c427ba57c6b5c) also passed [GitHub Actions run 36247554371](https://github.com/ShreyasDamle2805/codeyoung-trial-booking/actions/runs/36247554371) on 26 September 2026. That clean Linux run performed `npm ci`, installed Chromium, checked formatting, and ran the complete lint/test/build/browser sequence. This is independently accessible evidence beyond the original local results.

## What these results do not establish

- Remote CI results are available on the [GitHub Actions page](https://github.com/ShreyasDamle2805/codeyoung-trial-booking/actions). Check the result for the exact commit being submitted; the local results above are separate evidence.
- No public deployment or external email-provider delivery has been verified.
- Passing axe checks does not prove full accessibility conformance or replace testing with assistive-technology users.
- The submission email has not been sent, and local test success does not guarantee a hiring outcome.

Reproduce with `npm run format:check` and `npm run check`. Build before running browser tests separately. See the README for local email delivery setup.
