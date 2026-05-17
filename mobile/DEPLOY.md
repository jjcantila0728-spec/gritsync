# GritSync Mobile — Production Deploy

The mobile app is feature-complete and type-checks clean. To get an installable
APK in your clients' hands while iOS / Android stores are reviewing, you'll
run **two commands** total. Both happen on Expo's cloud infrastructure
(EAS) — your laptop just kicks them off.

> ⏱ **Time estimate:** 5 min of setup + ~25 min of EAS build time per platform.
> You don't have to babysit it; EAS emails you when each build finishes.

---

## Pre-flight (one-time, ~5 min)

You have already done most of this implicitly. Verify each item:

```bash
# 1. Run the push-token migration on production DB
node scripts/run-migration.cjs scripts/migrations/2026-05-16_users_push_token.sql

# 2. Set production Stripe secret on the server
#    (this lives in your existing .env / Vercel env vars)
echo $STRIPE_SECRET_KEY   # should start with sk_live_

# 3. EAS account + CLI
npm install -g eas-cli
eas login
```

If `mobile/app.json` still has the placeholder `pk_test_replace_me`, swap it
for your live Stripe publishable key first:

```jsonc
// mobile/app.json
"extra": {
  ...
  "stripePublishableKey": "pk_live_xxxxx",
  ...
}
```

---

## Step 1 — Initialize EAS project (one-time, 30s)

```bash
cd mobile
eas init
```

This writes your real Expo project id back into `app.json` under
`expo.extra.eas.projectId`. (We removed the placeholder previously because
expo-cli rejected a fake UUID — this command puts a real one back.)

Same time, configure EAS Update for over-the-air JS updates:

```bash
eas update:configure
```

This sets `expo.updates.url` and locks the runtime-version policy. After
this, future minor JS-only changes can ship instantly via
`eas update --branch production` without a new app-store submission.

---

## Step 2 — Build the APK and IPA (one command, ~25 min)

```bash
cd mobile
npm run build:preview
# == eas build --profile preview --platform all
```

When this completes, EAS prints two URLs:

```
✔ Build finished
- iOS:     https://expo.dev/artifacts/eas/xxx.ipa
- Android: https://expo.dev/artifacts/eas/yyy.apk
```

The Android URL is a directly downloadable APK your clients can install on
any Android device. The iOS URL is an ad-hoc-signed IPA for TestFlight.

### What `preview` gives you

| Platform | Output | Distribution |
|---|---|---|
| Android | Signed APK (release build) | Public — share the URL with anyone |
| iOS | Ad-hoc IPA | Limited to devices in your Apple Developer Account, or TestFlight |

For the App Store **production** build (when you're ready to publish):

```bash
npm run build:android   # AAB for Google Play
npm run build:ios       # IPA for App Store
```

---

## Step 3 — Make the APK downloadable from the website (2 min)

Paste the URLs from step 2 into [src/pages/Download.tsx](src/pages/Download.tsx):

```tsx
const MOBILE_APP_LINKS = {
  appStore: '',                                                  // empty until Apple approves
  testFlight: 'https://testflight.apple.com/join/XXXXXX',        // your TestFlight public link
  playStore: '',                                                 // empty until Google approves
  apk: 'https://expo.dev/artifacts/eas/yyy.apk',                 // ← paste from EAS
  playInternal: 'https://play.google.com/apps/internaltest/XXX', // your Play Internal link
}
```

Commit + deploy the website. Clients can now go to
**gritsync.com/download** on their phone:

- iOS users → TestFlight link
- Android users → tap "Get it on Google Play" *or* "Direct APK download"

The page detects platform automatically. On desktop it shows both options.

---

## Step 4 — Submit to App Store / Play Console (when listings are ready)

These two commands upload directly to TestFlight + Play Internal track:

```bash
cd mobile
npm run submit:android
npm run submit:ios
```

Prerequisites:
- `mobile/eas.json` → `submit.production.ios.appleId` / `ascAppId` / `appleTeamId` filled in
- `mobile/google-service-account.json` exists (downloaded from Google Play Console)

After Apple / Google approve, paste the public store URLs into
`MOBILE_APP_LINKS.appStore` and `MOBILE_APP_LINKS.playStore` — the page
flips to the official badges automatically.

---

## Step 5 — OTA updates after launch

Any future JS-only change (no native modules added/removed) ships instantly:

```bash
cd mobile
eas update --branch production --message "Fix DOCS upload flow"
```

Users get the update on their next app cold start. No store review needed.
Native changes (new `expo install <native-module>`) still require a new
build.

---

## Automating: GitHub Actions

[.github/workflows/mobile-build.yml](.github/workflows/mobile-build.yml) is
set up so every tag matching `v*.*.*` triggers a production EAS build.

To enable:

1. Settings → Secrets and variables → Actions → New repository secret
   - Name: `EXPO_TOKEN`
   - Value: from https://expo.dev/accounts/[org]/settings/access-tokens

2. Tag a release:
   ```bash
   git tag v1.0.0 && git push --tags
   ```

3. GitHub → Actions → "Mobile build" → fresh build runs.

The workflow also publishes an EAS Update on every production build, so JS
patches go out instantly.

You can also trigger preview builds manually from the Actions UI without
tagging anything.

---

## Stripe & Apple Pay

In production:

1. Stripe Dashboard → Apple Pay → register your Apple Pay merchant
   identifier `merchant.com.gritsync.app` (the value already in
   `mobile/app.json` → `expo.extra.stripeMerchantId`).
2. Stripe Dashboard → Developers → API keys → use the `pk_live_*` key
   in `mobile/app.json` → `expo.extra.stripePublishableKey`.

The PaymentSheet inside [SubscriptionSection.tsx](src/components/review/SubscriptionSection.tsx)
will surface Apple Pay automatically when both are configured.

---

## Smoke test checklist (before submitting to stores)

Install the APK on a real Android device + Run the dev build on an iPhone:

- [ ] Onboarding tour shows on first launch, "Skip" works
- [ ] Login screen pre-fills last identifier; Face ID prompt fires after first password login
- [ ] HOME loads applications + unread badges
- [ ] DOCS — three primary cards (Picture / Passport / Diploma) render; camera + library pickers work
- [ ] TIMELINE shows steps for the active application
- [ ] REVIEW: Q-Banks list loads; tutorial exam runs end-to-end through MCQ
- [ ] REVIEW → Plans → Stripe PaymentSheet opens (use card `4242 4242 4242 4242`)
- [ ] Settings → Subscription → Order history shows the payment
- [ ] Settings → Notifications → toggle on → check `users.push_token` in DB
- [ ] Push from Expo's notification tool (https://expo.dev/notifications) lands and tap deep-links to the right screen

If all eleven pass: you're production-ready.

---

## Open items requiring no code (just your time)

- [ ] App Store screenshots (6.7" + 6.1")
- [ ] Play Store screenshots (phone + 7-inch + 10-inch)
- [ ] App icon + adaptive icon final review (already at 1024×1024)
- [ ] Store listings: name, description, keywords, demo account creds
- [ ] Apple Developer → register merchant ID for Apple Pay
- [ ] Google Play → upload Play Console service-account JSON
