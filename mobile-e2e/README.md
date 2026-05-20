# GritSync Mobile E2E

Playwright suite that drives the **GritSync web client** under phone-sized viewports (Pixel 7, iPhone 15) to mirror the user journey our React Native app expects from the backend. Because both clients hit the same `/api/*` routes, this catches API-contract regressions before they hit production beta testers.

## What's tested

- `/login` renders + accessibility-of basic auth UI
- `/download` install page (marketing site)
- `/account/delete` cross-subdomain redirect to the canonical URL
- Signed-in flow: login → lands on `/client/...`
- Account Settings → Delete-account modal opens and requires typed confirmation

The signed-in tests are gated behind `GRITSYNC_TEST_PASSWORD` — they auto-skip if you haven't exported the test-account password.

## Setup (one-time)

```bash
cd mobile-e2e
npm install
npx playwright install chromium webkit
```

## Get a test password

The dedicated Play Console reviewer account is rotated by:

```bash
# from the repo root
node scripts/create-playstore-reviewer-account.cjs
```

It prints `Username: playstore-reviewer@gritsync.com` and a fresh `Password: ...`. Copy the password.

## Run

Against production (`https://app.gritsync.com`):

```bash
export GRITSYNC_TEST_PASSWORD="<paste from script output>"
npx playwright test
```

Against a different environment:

```bash
GRITSYNC_BASE="http://localhost:5173" \
GRITSYNC_TEST_PASSWORD="..." \
npx playwright test
```

Specific device:

```bash
npm run test:android     # Pixel 7 emulation
npm run test:ios         # iPhone 15 emulation
npm run test:dark        # iPhone 15 + colorScheme: dark
```

Interactive UI mode:

```bash
npm run test:ui
```

## Hot tips

- Trace + screenshot are captured on retry/failure. Open the latest report with `npm run report`.
- If a selector fails because the layout changed, prefer `getByRole(name)` over CSS — it survives Tailwind class shuffling.
- This suite is **NOT a substitute for native E2E**. For the actual mobile app's screens (which use React Native primitives Playwright can't see), use Detox or Maestro. Adding that is on the launch-polish backlog.
