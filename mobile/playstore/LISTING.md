# GritSync Mobile — Play Store listing copy

Paste these into Google Play Console → Main store listing → Default
(English / United States). All counts validated against the form's
limits.

## App name (30 chars max)
```
GritSync
```
*8 / 30*

## Short description (80 chars max)
```
Filipino nurses' guide to becoming a USRN: NCLEX prep + processing, simplified.
```
*79 / 80*

## Full description (4000 chars max)
```
Becoming a US Registered Nurse from the Philippines isn't just one exam — it's a maze. CGFNS credential evaluation, IELTS or TOEFL iBT, NBI clearance with DFA apostille, original transcripts from your old nursing school, Visa Screen, NCLEX-RN through Pearson VUE, state-board endorsement, EAD and SSN once you arrive, and the NCLEX itself in its new Next Generation format with ten question types Filipino nursing schools rarely teach.

If you're a Filipino BSN graduate dreaming of practicing in California, Texas, New York, Hawaii, Georgia, Illinois, or anywhere across the US, GritSync is built specifically for you.

BUILT BY FILIPINO NURSES WHO ALREADY DID THIS

GritSync was founded by a Filipino RN who navigated the exact same gauntlet. Every confusion we hit on that journey — "CGFNS Cert or CES Report?" "Why did Texas reject my TOR?" "Visa Screen before or after NCLEX?" — we turned into a tool inside this app. Every advisor on our team is bilingual and understands the practical reality of apostilling at DFA Pasay or fitting an IELTS retake to your state board's window.

WHAT YOU GET

🗂 STATE-BY-STATE APPLICATION TRACKER
Every US state has its own paperwork, fees, and surprises. We map your chosen state's requirements onto a step-by-step timeline you can actually follow. No more decoding 40-page legalese PDFs. See exactly what's due next, what's pending payment, and what your advisor is working on right now.

📄 DOCUMENT VAULT WITH CAMERA CAPTURE
Snap your PRC license, TOR, diploma, NBI clearance, IELTS result, and passport directly from your phone. Encrypted, routed to the right state form, and visible to your advisor the second it lands. Web portal and mobile app share one source of truth.

📚 NCLEX REVIEW BUILT FOR NGN
The Next Generation NCLEX (April 2023+) introduced ten question formats most Filipino nursing schools never covered: bow-tie, drag-and-drop, matrix MCQ / SATA, highlight text, drop-down cloze, ordered response, fill-in-the-blank, plus the new case-study structure. We have practice for every single format, written by Filipino nurse educators who passed NCLEX on first attempt. Detailed rationale in plain English.

🎯 ADAPTIVE PRACTICE
After every tutorial, we surface your three weakest topics so the next session targets exactly where you need work. No random practice that misses your blind spots.

🎓 LIVE LECTURES IN MANILA TIME
Live NCLEX review sessions in Manila evening hours so you can attend after your hospital shift. Recordings appear automatically for anyone who misses.

💬 BILINGUAL ADVISOR MESSAGING
Direct chat with your assigned advisor in Tagalog or English. Push notifications when status changes — even if you're on duty in a different timezone.

📅 NCLEX EXAM COUNTDOWN
Pearson VUE seats in Manila, Cebu, Saipan, Guam, and Dubai get booked months ahead. Set your target exam date once and we calculate daily practice targets and warn you when registration windows close.

🔐 FACE ID SIGN-IN
Opt in to biometric sign-in after your first password login. Credentials stay in your phone's secure enclave — never on our servers.

💳 LOCAL PAYMENT METHODS
Visa / MasterCard (Stripe-secured), GCash, BDO bank transfer, or USD wire. BIR-compliant invoices arrive in your in-app inbox automatically.

WHY FILIPINO NURSES CHOOSE GRITSYNC

• 98% first-attempt application acceptance rate
• Specialist coverage of CA, TX, NY, GA, HI, IL — plus 30 more US states
• Direct Pearson VUE registration coordination
• Post-arrival SSN, EAD, and Visa Screen support
• Sponsorship matching with US healthcare employers actively recruiting Filipino RNs

PRIVACY

Encrypted in transit and at rest. Payments handled by Stripe — we never see your card. Request a full deletion of your account anytime from Settings → Sessions → Delete my account.

GET STARTED

Sign up free. Talk to a Filipino advisor. See your state-board timeline within 24 hours. Visit gritsync.com.

Salamat for trusting us with your USRN journey.
```

## Visual assets

| Asset | File | Location |
|---|---|---|
| App icon (512×512) | `icon-512.png` | `mobile/playstore/icon-512.png` |
| Feature graphic (1024×500) | `feature-1024x500.png` | `mobile/playstore/feature-1024x500.png` |
| Phone screenshots (1080×1920) | `screenshot-01-home.png` through `screenshot-06-login.png` | `mobile/playstore/` |

To regenerate icon + feature graphic + screenshots from source:
```bash
node scripts/generate-playstore-assets.cjs
```

## Phone screenshots — recommended capture order

The six SVG-rasterized PNGs in `mobile/playstore/` are usable for launch. For the v1 → v2 polish, replace each with a real device screenshot in this order:

| # | Screen | Why it sells (especially to Filipino nurses) |
|---|---|---|
| 1 | **Home** — active application card showing progress | "I always know where I stand in the maze" |
| 2 | **Apply wizard** at the Documents step | Camera-capture USP — no scanner needed |
| 3 | **Timeline** with steps to state-board endorsement | Demystifies the gauntlet |
| 4 | **Review hub** — Q-Banks tab | Hooks the NCLEX-prep audience |
| 5 | **Review → Exam runner** with a bow-tie question + timer | Proves NGN coverage |
| 6 | **Messages** thread with a bilingual advisor (Tagalog/English mixed) | Bilingual support hook |
| 7 | **Settings** showing Face ID sign-in toggle | "It's secure" |
| 8 | **Subscription** screen with GCash/BDO selected | Local payments differentiator |

Capture from a real Android device for the cleanest result. Minimum 4 screenshots are needed for Play Console submission and to qualify for promotional placement.

## Tablet screenshots (defer for now)

For Internal Testing release, you can either upload the same 1080×1920 phone shots into the tablet slots or tick "Designed for phone" in device targeting later. Either is acceptable.

## Video (defer)

A 30-second YouTube screen-recording lifts conversion ~15% but isn't required for launch. Add post-v1.
