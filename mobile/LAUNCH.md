# GritSync Mobile — Launch Checklist

Run this **in order**. Anything tagged 🔒 is a one-time action that blocks the next step.

---

## 0. Prerequisites

- [x] Apple Developer account ($99/yr) owning bundle id `com.gritsync.app`
- [x] Google Play Console account ($25 one-time)
- [x] Expo account (free at https://expo.dev)
- [x] Stripe live keys ready (publishable + secret)

---

## 1. Backend (server-side, one-time)

### Run the push-token migration

```bash
node scripts/run-migration.cjs scripts/migrations/2026-05-16_users_push_token.sql
```

Adds `users.push_token`, `users.push_platform`, `users.push_token_updated_at`, plus an index and an updated-at trigger.

### Verify push-token route is whitelisted

`PUT /api/auth/update` now accepts `push_token` and `push_platform` (see `server/routes/auth.ts:735`). Test:

```bash
curl -X PUT https://app.gritsync.com/api/auth/update \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"push_token":"ExponentPushToken[xxxxx]","push_platform":"ios"}'
```

Expect `{ "user": {...} }`.

### Switch notification callsites to `notifyUser`

Anywhere the codebase currently does

```ts
await query(`INSERT INTO notifications ...`)
```

…replace with

```ts
import { notifyUser } from '../lib/notify'

await notifyUser({
  userId,
  title: 'Your application was approved',
  message: '...',
  type: 'application',          // 'application' | 'payment' | 'message' | 'document' | 'system'
  data: { applicationId },      // routed by the mobile deep-link handler
})
```

This is grep-replace work; the existing INSERTs will still work but won't fire pushes until migrated.

### Set Stripe environment variables

```bash
# .env on the server
STRIPE_SECRET_KEY=sk_live_xxxxx
```

The server uses this for `POST /api/nclex/create-upgrade-intent` (see `server/routes/nclex.ts:1435`).

---

## 2. Mobile config (one-time)

### 🔒 Stripe publishable key

Open `mobile/app.json` and replace:

```json
"stripePublishableKey": "pk_test_replace_me",
```

…with your real publishable key (`pk_live_xxxxx`).

Apple Pay merchant id stays as `merchant.com.gritsync.app` unless you registered a different one in your Apple Developer account.

### 🔒 EAS project id

```bash
cd mobile
npm install -g eas-cli
eas login
eas init
```

This writes the real `projectId` back into `app.json` under `expo.extra.eas.projectId`. The placeholder we had previously (`00000000-...`) was removed because Expo CLI rejected it.

### 🔒 iOS submit credentials

Open `mobile/eas.json`. In `submit.production.ios`, replace:

```json
"appleId": "owner@gritsync.com",
"ascAppId": "0000000000",
"appleTeamId": "XXXXXXXXXX"
```

…with the real Apple ID, ASC app id (from App Store Connect after registering the app), and Team ID (Apple Developer → Membership).

### 🔒 Android submit credentials

Place the Google Play service-account JSON at `mobile/google-service-account.json` (already gitignored). To create one:

1. Google Play Console → Setup → API access
2. Create a service account in Google Cloud → grant "Release manager" role
3. Download the JSON key → put it at the path above

---

## 3. Dev build (test Stripe + push end-to-end)

Stripe Mobile SDK and `expo-notifications` push tokens **don't work in Expo Go** — they need a native build. Use the EAS development profile:

```bash
cd mobile
eas build --profile development --platform ios       # or --platform android
```

When the build finishes (~15-20 min on EAS free tier):

- iOS: install via the link in the build page or `eas build:run --profile development`
- Android: download the `.apk` and install via `adb install`

Then point Metro at the dev client:

```bash
npx expo start --dev-client
```

Open the installed dev client app, scan the QR.

**Test cases:**

- [ ] Sign in → Settings → Notifications → toggle on → check `users.push_token` is populated in DB
- [ ] Plans tab → upgrade with Stripe → PaymentSheet opens → test card `4242 4242 4242 4242` → tier flips to Premium
- [ ] Send yourself a push (use Expo's push tool: https://expo.dev/notifications) targeting your token → app receives banner → tap → app opens
- [ ] Subscription → Order history → see the payment row

---

## 4. Internal preview (TestFlight + Play Internal)

```bash
cd mobile
npm run build:preview
# == eas build --profile preview --platform all
```

Outputs:
- iOS: ad-hoc IPA you can drag into Diawi or TestFlight
- Android: signed APK ready for sideload

Then submit to internal tracks:

```bash
npm run submit:android   # uploads APK/AAB to Play Internal track
npm run submit:ios       # uploads IPA to TestFlight
```

Add internal testers in App Store Connect / Play Console.

---

## 5. App Store / Play Console listings

### Required assets

| Asset | Spec | Notes |
|---|---|---|
| App icon | 1024×1024 PNG, no alpha | use `assets/icon.png` (1024×1024 source) |
| Adaptive icon | foreground 432×432, background `#DC2626` | `assets/adaptive-icon.png` |
| iOS screenshots | 6.7" (1290×2796), 6.1" (1170×2532) | take from iPhone 15 Pro Max + 14 simulators |
| Android screenshots | phone (1080×1920+), tablet (1200×1920+) | 7-inch + 10-inch tablets |
| App Store privacy details | what data we collect | see Privacy Manifest below |
| Privacy policy URL | https://gritsync.com/privacy | already exists |
| Demo account | for App Store review team | create a test client account, document creds |

### Privacy Manifest (iOS)

We collect:
- **Contact Info** (email, phone) — for account creation
- **Identifiers** (user id, GRIT ID) — linked to user
- **Diagnostics** (crash logs) — not linked

Tracking: **None.**

### Suggested copy

> **Title:** GritSync — NCLEX
>
> **Subtitle:** Your NCLEX application & review companion
>
> **Description:**
> Take your NCLEX preparation everywhere. GritSync Mobile mirrors the full
> GritSync client portal: track your application timeline, upload documents
> with your camera, message your advisor, and study with our adaptive Q-Banks
> — all from your phone.
>
> Features:
> • Application tracker with live status updates
> • Document capture with auto-crop
> • NCLEX Q-Banks: Classic + NGN, all 10 question formats
> • Calculator, notes, mark-for-later, question list
> • Live lectures with countdown + one-tap join
> • Cheatsheets viewer
> • Study calendar with exam-date reminders
> • Face ID sign-in
> • Push notifications for status changes, messages, payment receipts

---

## 6. Production build + release

When TestFlight / Internal testing looks good:

```bash
cd mobile
npm run build:android   # AAB for Google Play production track
npm run build:ios       # IPA for App Store production
```

Then promote in App Store Connect / Play Console from internal → production.

---

## Open items that aren't blockers

- [ ] In-app subscription cancelation (currently deep-links to web)
- [ ] Stripe webhook → server reconciliation on subscription expiry
- [ ] Push notifications for instructor announcements (admin UI on web)
- [ ] Offline read cache (deferred from earlier plan)
- [ ] i18n (Tagalog + Spanish)
