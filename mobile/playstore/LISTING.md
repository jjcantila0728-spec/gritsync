# GritSync Mobile — Play Store listing copy

Paste these into Google Play Console → Main store listing → Default
(English / United States). All counts validated against the form's
limits.

## App name (30 chars)
```
GritSync
```
*8 / 30*

## Short description (80 chars)
```
NCLEX application tracker, Q-Bank reviewer & advisor chat — in one app.
```
*71 / 80*

## Full description (4000 chars)
```
GritSync is your end-to-end NCLEX companion. We help internationally educated nurses move through every step of the US licensure process — from filing the application, through document submission, through NCLEX preparation, through state board approval — without the spreadsheet chaos and email back-and-forth.

WHAT YOU GET

⚡ APPLICATION TRACKER
See exactly where you are. Every milestone, every required document, every payment, in one timeline. No more "I emailed you last week about the diploma" — both you and your advisor see the same status in real time.

📄 DOCUMENT VAULT
Snap a photo of your passport, diploma, or any required ID directly from the app. We auto-format, encrypt in transit, and route it to the right slot. Replace any document in two taps if something changes. Web + mobile share one storage — upload from your laptop, see it on your phone, vice versa.

📚 NCLEX REVIEW (CLASSIC + NGN)
The same Q-Banks as our flagship review platform, native to mobile. Practice all ten Next Generation NCLEX question formats — MCQ, SATA, fill-in-the-blank, drop-down, matrix, bow-tie, highlight, drag-and-drop, ordered response. Built-in calculator, mark-for-later, notes, and a question-list navigator.

🧠 ADAPTIVE STUDY SUGGESTIONS
After each tutorial we surface your three weakest topics so the next session targets where you actually need work. Backed by your real exam history, not a generic curriculum.

🎓 LIVE LECTURES + RECORDINGS
Join live instructor sessions from your phone. Miss one? Recordings show up in the Videos section. Pin cheat-sheets to your home screen for quick reference between work shifts.

💬 ADVISOR MESSAGING
Direct chat with your assigned GritSync advisor. Push notifications when they reply. No phone tag, no lost threads.

📅 NCLEX EXAM CALENDAR
Set your test date once and we'll add reminders, study milestones, and payment due-dates to your phone's native calendar — Apple Calendar, Google Calendar, Outlook, whichever you use.

🔐 FACE ID SIGN-IN
After your first password login, opt in to biometric sign-in. Encrypted credentials live in your phone's secure enclave, not on our servers.

🔔 PUSH NOTIFICATIONS
Status changes, advisor messages, payment receipts, and exam-day reminders — opt in once, never miss an update.

💳 BUILT-IN CHECKOUT
Pay for your processing fees and Premium NCLEX subscription right in the app. Stripe-secured cards, Apple Pay, GCash, or BDO bank transfer. Receipts and invoices arrive in your in-app inbox automatically.

WHO IS THIS FOR

GritSync is for internationally educated nurses (especially from the Philippines) pursuing US licensure. If you're working with one of our advisors already, this app is your daily portal. If you're new to GritSync, you can also start an application directly from inside the app.

PRIVACY & TRUST

Your data is encrypted in transit (HTTPS, TLS 1.2+) and at rest. Payment information is processed by Stripe — we never see your card number. You can request a full deletion of your account and personal data at any time from Settings → Sessions → Delete my account.

ABOUT GRITSYNC

GritSync was founded by JJ Cantila, a Filipino nurse who walked the same NCLEX path you're walking now. We process applications for hundreds of nurses every year and have a 98% first-attempt application acceptance rate. Visit gritsync.com to learn more.
```
*≈ 3,140 / 4,000*

## Visual assets

| Asset | File | Location |
|---|---|---|
| App icon (512×512) | `icon-512.png` | `mobile/playstore/icon-512.png` |
| Feature graphic (1024×500) | `feature-1024x500.png` | `mobile/playstore/feature-1024x500.png` |
| Phone screenshots (1080×1920+) | **Take from running app** — at least 4, ideally 8 | Capture from device |

To regenerate icon + feature graphic from `public/gritsync_logo.png`:
```bash
node scripts/generate-playstore-assets.cjs
```

## Phone screenshots — what to capture

Open the installed app on your phone, press **Volume Down + Power** to screenshot each of these. AirDrop / Files / Drive them to your laptop and drag-drop into Play Console.

| # | Screen | Why it sells |
|---|---|---|
| 1 | **Home** (Active application card visible) | First impression — branded hero with progress |
| 2 | **Apply wizard** (step 6 — document slots) | Shows the camera-upload UX |
| 3 | **Timeline** with an active application + steps | "I always know where I stand" |
| 4 | **Review hub** — Q-Banks tab | Hooks the NCLEX-prep audience |
| 5 | **Review → Exam runner** (MCQ question + timer) | Shows the actual study tool |
| 6 | **Messages** thread with an advisor | Personal-support angle |
| 7 | **Settings** showing Face ID sign-in toggle | "It's secure" |
| 8 | **Subscription** screen with Stripe checkout open | Conversion proof |

If you don't have time for all 8 — minimum is **4** for Play Console acceptance (and 4 to be eligible for promotional placement).

## Tablet screenshots

For internal-testing-only releases, tablet shots are technically required but Play Console accepts them missing if you tick "Designed for phone only" in the device settings later. For the production launch, take the same 8 shots above on an Android tablet (or use Android Studio's emulator if you don't have one).

## Video (optional, skip for now)

A 30-second YouTube screen-recording of the app helps conversion ~15% but isn't required for launch. Defer.

## Promotional video — defer

Same as above.
