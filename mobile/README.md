# GritSync Mobile (Android + iOS)

Client-only companion app for the GritSync NCLEX portal, built with Expo SDK 54 + React Native 0.81 + expo-router. One TypeScript codebase produces signed Android (AAB / APK) and iOS (IPA) builds via EAS.

> **Scope.** This app is for end clients. Admin / advisor / affiliate panels stay web-only.

## Tabs

| Tab | Screen | Backend |
|---|---|---|
| HOME | `app/(tabs)/home.tsx` | `GET /api/db/applications`, unread counts (messages, notifications), gradient hero |
| DOCS | `app/(tabs)/docs.tsx` | `GET /api/db/user_documents`, `POST /api/storage/upload`. Three primary placeholder cards (Picture / Passport / Diploma) + per-slot replace |
| TIMELINE | `app/(tabs)/timeline.tsx` | `GET /api/db/application_timeline_steps` |
| REVIEW | `app/(tabs)/review.tsx` | **Native** NCLEX hub (no WebView) — see [Review architecture](#review-architecture) |
| SETTINGS | `app/(tabs)/settings.tsx` | Theme, push, biometric sign-in, support links, sign out |

## Sub-screens (root stack)

| Route | File | Backend |
|---|---|---|
| `/applications/[id]` | `app/applications/[id].tsx` | applications + payments + timeline_steps + share + calendar export |
| `/apply` | `app/apply/index.tsx` | 8-step NCLEX application wizard, `user_details` upsert + `applications` insert |
| `/notifications` | `app/notifications.tsx` | `/api/db/notifications` + mark-as-read |
| `/messages` | `app/messages/index.tsx` | `GET /api/messages/conversations` |
| `/messages/[userId]` | `app/messages/[userId].tsx` | `GET /api/messages/thread/:userId` + `POST /api/messages` (15s poll) |
| `/emails` | `app/emails/index.tsx` | Inbox `/emails/my-received` + sent from `email_logs` + compose via `/emails/send` |
| `/profile-edit` | `app/profile-edit.tsx` | `PUT /api/auth/update` |
| `/(auth)/login` | `app/(auth)/login.tsx` | `POST /api/auth/login` + biometric replay |
| `/(auth)/register` | `app/(auth)/register.tsx` | `POST /api/auth/register` + `verify-otp` |
| `/(auth)/forgot-password` | `app/(auth)/forgot-password.tsx` | email → OTP → new password (3-step) |
| `/review/qbanks/[bank]` | `app/review/qbanks/[bank].tsx` | Q-Bank detail with Statistics / Previous / Remediation sub-tabs |
| `/review/exam/[sessionId]` | `app/review/exam/[sessionId].tsx` | Full-screen exam runner (all 10 formats) |
| `/review/results/[sessionId]` | `app/review/results/[sessionId].tsx` | Readiness pill + donut + category breakdown |
| `/review/review/[sessionId]` | `app/review/review/[sessionId].tsx` | Item-by-item review with filter |

Auth: `POST /api/auth/login` returns `{ user, session: { access_token, refresh_token } }`. Tokens are stored in `expo-secure-store`; 401 triggers a single refresh attempt before sign-out. Last identifier (email/mobile/GRIT ID) is remembered separately so login pre-fills on next launch.

## Review architecture

The REVIEW tab is fully native — no WebView. Sections are switched by horizontal chip selector inside [`app/(tabs)/review.tsx`](app/(tabs)/review.tsx); per-section components live in `src/components/review/`.

| Chip | Component | Source |
|---|---|---|
| Q-Banks | inline in `review.tsx` (lists banks + recent sessions) | `GET /api/nclex/home` |
| Videos | `VideosSection` | `GET /api/nclex/videos` + `expo-av` player |
| Live | `LiveSection` | `GET /api/nclex/live-sessions` + countdown + Join via in-app browser |
| Cheatsheets | `CheatsheetsSection` | `GET /api/nclex/site-settings.cheatsheets`, pinch-zoom image preview, in-app browser for PDFs |
| Calendar | `CalendarSection` | `react-native-calendars` + `PUT /api/nclex/profile/exam-date` |
| Stories | `TestimonialsSection` | `GET /api/nclex/testimonials/approved` |
| Plans | `SubscriptionSection` | Stripe + GCash + BDO — see [Payments](#payments) |

Drilling into a Q-Bank pushes `/review/qbanks/[bank]` with three sub-tabs (Statistics / Previous tests / Remediation) and Tutorial / Readiness CTAs. Starting an exam navigates to `/review/exam/[sessionId]` which renders the **QuestionRenderer** dispatcher.

### Exam runner — supported question formats

`src/components/exam/QuestionRenderer.tsx` dispatches by `question.format`:

- **MCQ** — single-select radio
- **SATA** — multi-select checkbox with "MISSED" markers in review
- **FILL_IN_BLANK** — one or many `{{blank}}` placeholders detected in the stem
- **DROP_DOWN** — inline option pills per blank
- **MATRIX_MCQ / MATRIX_SATA** — scrollable table, row × column selection
- **BOW_TIE** — left actions / center condition / right monitoring, multi-select sides
- **HIGHLIGHT_TEXT** — tap tokens to highlight, correct/wrong tinting on submit
- **DRAG_DROP** — Reanimated 4 + `react-native-gesture-handler`, with tap-to-place fallback for accessibility
- **ORDERED_RESPONSE** — reorderable list with arrow buttons + correct-position green/red diff

Per-question state held locally (mark-for-later, note text, current answer). The runner also includes:

- **Top bar** — exam type, item index/total, elapsed timer, close (abandons after confirm)
- **Tool bar** — Calculator, Flag, Items (question list bottom sheet), Notes
- **Calculator** — custom keypad in `src/components/exam/Calculator.tsx` (basic arithmetic only — matches the NCLEX exam interface)
- **Notes modal** — per-question text held in a local map, keyed by question id
- **Question list bottom sheet** — grid with answered (green) / flagged (yellow) / current (red) badges

Results screen renders a readiness pill, custom donut, and a category breakdown with tone (≥70 green, ≥50 amber, <50 red). Review screen reuses `QuestionRenderer` in `feedback` mode so every format shows the correct option highlighting.

## Payments

The Subscription section ([`src/components/review/SubscriptionSection.tsx`](src/components/review/SubscriptionSection.tsx)) supports three flows:

1. **Stripe Mobile SDK** — `@stripe/stripe-react-native` PaymentSheet.
   - `POST /api/nclex/create-upgrade-intent { planId }` → `clientSecret`
   - `initPaymentSheet` → `presentPaymentSheet`
   - `POST /api/nclex/confirm-stripe-upgrade { intentId, planId }` to flip the user's tier
   - Apple Pay / Google Pay surface automatically through PaymentSheet
2. **GCash** — admin-supplied QR shown to user; they pay in GCash, then upload a screenshot + enter reference, sent to `POST /api/nclex/profile/upgrade-request`
3. **BDO bank transfer** — same as GCash but with displayed bank details instead of a QR

`StripeProvider` is mounted in `app/_layout.tsx`. Publishable key lives in `app.json` → `expo.extra.stripePublishableKey`; the Apple-Pay merchant identifier is in `expo.extra.stripeMerchantId` and the iOS plugin block.

> **Important:** Stripe Mobile SDK has native code. **Expo Go cannot run it.** Use a dev client (`eas build --profile development`) or production build for end-to-end payment testing.

## Branding

- Brand red `#DC2626` (primary), white surfaces, deep grays for text. Lighter `red50/100/200` shades for chips and pills.
- Icon / splash / adaptive icon use [`gritsync_logo.png`](./assets/icon.png).
- Wordmark renders inline (Grit + Sync split colors), matching the website `.logo-text-grit` / `.logo-text-sync`.
- Dark / light / system theme — user-selectable in Settings → Appearance.
- Animated splash with logo pulse + cascading dots ([`src/components/Splash.tsx`](src/components/Splash.tsx)) used during auth boot.
- Custom bottom tab bar with spring-animated pill indicator ([`src/components/TabBar.tsx`](src/components/TabBar.tsx)).

## Auth + security

- Bearer tokens (access + refresh) in `expo-secure-store`
- 401 auto-refresh on a single request, then sign-out
- **Face ID / Touch ID sign-in** — after first password login the app offers to remember credentials (encrypted in SecureStore). Subsequent visits prompt biometrics on the login screen.
- **Web hop SSO** — when [`openUrl()`](src/lib/browser.ts) opens a `app.gritsync.com` or `review.gritsync.com` link, it mints an SSO token via `POST /api/auth/sso/issue` and routes through `/sso?token=…&next=…`. User lands authenticated.
- **Password show/hide eye toggle** ([`PasswordInput.tsx`](src/components/PasswordInput.tsx)) on every password field.

## Other mobile-native features

- **Push notifications** (`expo-notifications`) — opt-in toggle in Settings, registers an Expo Push token and persists via `PUT /api/auth/update { push_token }` (backend route needs `push_token` whitelisted before production).
- **Camera capture** — Apply flow + Docs tab present a 3-choice picker: Take Photo / Choose from Photos / Choose File.
- **Calendar export** — Application detail "Add to Calendar" creates a dedicated GritSync calendar entry per upcoming timeline step (24h + 1h reminders).
- **Native share** — Application detail "Share Status" opens the system share sheet with GRIT ID + status.
- **In-app browser** — `expo-web-browser` SFSafariViewController / Custom Tab with brand-red controls for all external links.

## Local development

```bash
cd mobile
npm install
npm start              # opens Expo dev tools
npm run android        # launches in Android emulator / connected device
npm run ios            # launches in iOS simulator (macOS)
```

By default the app talks to `https://app.gritsync.com`. Override for staging / local API by editing `app.json` → `expo.extra.apiBaseUrl` and `reviewBaseUrl`.

> If you point at a `localhost` API, use the device's reachable IP (`http://10.0.2.2:3001` on Android emulator, your Mac LAN IP on iOS simulator). The Express server already sends permissive CORS.

### Testing Stripe + native modules

Expo Go does **not** include Stripe / Calendar / `react-native-pdf`. For E2E testing of payments and calendar export, build a dev client:

```bash
npm install -g eas-cli
eas login
eas init
eas build --profile development --platform ios   # or android
```

Install the resulting `.ipa` / `.apk` on your device; run `npm start --dev-client` to point Metro at it.

## Production builds

```bash
# Internal preview (APK + ad-hoc IPA) — good for TestFlight / Play Internal
npm run build:preview

# Production
npm run build:android   # AAB for Google Play
npm run build:ios       # IPA for App Store
```

Store submission (after credentials are wired into `eas.json`):

```bash
npm run submit:android
npm run submit:ios
```

### iOS signing

EAS handles certificates automatically when you log in with an Apple ID that owns the bundle ID `com.gritsync.app`. Fill the real `appleId`, `ascAppId`, and `appleTeamId` in `eas.json` before `eas submit`.

For Apple Pay, the merchant identifier in `app.json` (`expo.extra.stripeMerchantId` + the Stripe iOS plugin block) must match a merchant ID registered in your Apple Developer account.

### Android signing

EAS generates and stores a keystore for `com.gritsync.app` on first build. Put the Play service-account JSON at `mobile/google-service-account.json` (or update the path in `eas.json`) before `eas submit`.

## Folder layout

```
mobile/
  app/                          # expo-router file-based routes
    _layout.tsx                 # AuthProvider + StripeProvider + GestureHandlerRootView
    index.tsx                   # redirects based on session
    (auth)/login.tsx
    (auth)/register.tsx
    (auth)/forgot-password.tsx
    (tabs)/_layout.tsx          # custom TabBar
    (tabs)/home.tsx
    (tabs)/docs.tsx
    (tabs)/timeline.tsx
    (tabs)/review.tsx           # native NCLEX hub
    (tabs)/settings.tsx
    apply/index.tsx             # 8-step application wizard
    applications/[id].tsx
    emails/index.tsx
    messages/index.tsx
    messages/[userId].tsx
    notifications.tsx
    profile-edit.tsx
    review/qbanks/[bank].tsx
    review/exam/[sessionId].tsx
    review/results/[sessionId].tsx
    review/review/[sessionId].tsx
  src/
    components/
      Brand.tsx
      Button.tsx
      Card.tsx
      PasswordInput.tsx
      Screen.tsx
      Splash.tsx                # animated brand-gradient loader
      TabBar.tsx                # custom bottom tab bar
      exam/
        QuestionRenderer.tsx    # dispatcher + 10 format components
        Calculator.tsx          # custom keypad modal
        NotesModal.tsx          # per-question notes
        QuestionListSheet.tsx   # bottom sheet jump grid
      review/
        VideosSection.tsx
        CheatsheetsSection.tsx
        LiveSection.tsx
        CalendarSection.tsx
        TestimonialsSection.tsx
        SubscriptionSection.tsx # Stripe + GCash + BDO
    contexts/
      AuthContext.tsx           # signIn, refresh, signOut, biometric forget
      PreferencesContext.tsx    # theme override
    lib/
      api.ts                    # axios + 401 refresh
      db.ts                     # /api/db/:table helper
      nclex.ts                  # full NCLEX API + types
      services.ts               # messages, notifications, emails, storage, auth helpers
      browser.ts                # in-app browser with SSO auto-wrap
      pickers.ts                # camera / library / files unified picker
      biometric.ts              # Face ID helpers
      push.ts                   # expo-notifications wrapper
      calendar.ts               # NCLEX calendar export
      storage.ts                # SecureStore wrapper
      types.ts
    theme.ts                    # palette + override pub/sub + useTheme
  assets/                       # icon.png, splash.png, adaptive-icon.png, gritsync.svg
  app.json                      # Expo + plugins (Stripe, image-picker, calendar, notifications)
  eas.json                      # EAS build / submit profiles
```

## Backend notes for Stripe

The server route `POST /api/nclex/create-upgrade-intent` already exists ([`server/routes/nclex.ts:1435`](../server/routes/nclex.ts)). It returns `{ clientSecret, intentId, amount, currency }`. The mobile flow simply consumes this — no backend changes needed.

For Apple Pay specifically you need to also register your merchant identifier with Stripe (Dashboard → Settings → Apple Pay → register a new domain / merchant ID).
