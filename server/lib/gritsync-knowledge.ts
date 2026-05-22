/**
 * Compact ground-truth knowledge base about GritSync, fed into every AI
 * prompt that writes customer-facing copy.
 *
 * Built by hand from the canonical product surfaces — /faqs (the long-
 * form FAQ page), the live `services` table (the source of truth for
 * current NCLEX pricing), and the homepage marketing claims. Re-derived
 * here as plain text because LLM context windows don't love JSX or DB
 * rows.
 *
 * Keep this tight. Every social-ai call sends it on the wire. Aim under
 * 2 KB. When the product surface changes, edit this file — don't make
 * the LLM guess from outdated training data.
 */
export const GRITSYNC_KB = `GROUND-TRUTH FACTS ABOUT GRITSYNC (use these — never invent claims that contradict them):

WHO WE ARE
- GritSync is an NCLEX application processing platform for Filipino nurses pursuing the US Registered Nurse (USRN) path.
- We handle the paperwork end-to-end so clients can focus on studying.
- Eligibility for NCLEX via GritSync: any Filipino BSN graduate with a nursing diploma. A PRC (Philippine) RN license is NOT required to take NCLEX through us — only graduation from a BSN program + diploma. If the operator-facing materials say "PRC required", that is OUT OF DATE — do not repeat it.

WHAT WE ACTUALLY DO (the service)
- We file NCLEX-RN applications with the New York State Board of Nursing (NYSBON). New York is the ONLY state we currently process.
- We submit credentials directly to NYSED — we do NOT route through CGFNS. This is a key GritSync differentiator versus traditional agencies.
- We register clients with Pearson VUE for the NCLEX exam (handles ATT issuance + scheduling guidance).
- We coordinate the 3 required uploads: 2x2 ID picture, nursing diploma, valid Philippine passport.
- We track applications in real time across 13 stages: Documents Collection → Documents Review → NYSED Document Review → BON Application → BON Processing → Pearson VUE Registration → Mandatory Courses → ATT Issued → Exam Scheduled → Exam Taken → Results Pending → Results Received → License Issued.
- The mobile experience is a PWA installable from any modern browser.

PRICING (New York pathway, current)
- Default product: 2-step staggered payment.
  · Step 1 (paid at application start, ~$377): NY BON application fee, NY mandatory courses, bond fee, GritSync Step 1 service fee.
  · Step 2 (paid when Pearson VUE registration begins, ~$520): Pearson VUE application fee, NCSBN exam fee, GritSync Step 2 service fee, Quick Results.
- Full payment option: ~$867 total (skips the bond fee).
- No hidden fees. /quote shows the live exact figure based on the operator's selections.
- For exact dollar amounts in copy, prefer language like "around $800-$900" or direct readers to /quote.

TIMELINE (use ONLY these ranges — never fabricate tighter specifics)
- NYSED document review: 8-16 weeks.
- NY BON processing: 4-12 weeks after NYSED review.
- ATT issuance: 1-4 weeks after BON approval.
- Typical total to ATT: 6-9 months from complete-application submission.
- ATT validity: 90 days.
- NCLEX Quick Results: ~48 hours after the exam.
- Official NY BON result + license: 4-6 weeks after passing the exam.

NCLEX SPONSORSHIP PROGRAM (real product, separate page)
- Connects qualified Filipino nurses with US healthcare employers who cover all or part of the processing fees, in exchange for a work commitment after license issuance.
- Not a loan — tied to employment, not repayment.
- Sponsorship eligibility varies by employer. Don't quote a fixed checklist (PRC, years of experience, etc.) in replies — direct interested people to https://www.gritsync.com/ or DM the Page so the team can match them to current sponsor requirements.

SUPPORT
- support@gritsync.com
- +1 (509) 270-3437
- All status updates flow through the in-app dashboard + email notifications.

OFFICIAL URLS (use these verbatim — never paraphrase or shorten)
- Website (general):    https://www.gritsync.com/
- Get a personalized quote: https://www.gritsync.com/quote
- Every caption MUST include the website URL. Default to https://www.gritsync.com/.
  Switch to https://www.gritsync.com/quote ONLY when the CTA is explicitly about
  pricing, applying, or getting a custom plan. Place the URL on its OWN line
  immediately before the hashtags (or at the end if there are none).

WHAT WE DO NOT DO — never claim these as GritSync services:
- We do NOT file CGFNS reports, VisaScreen, or any US-immigration paperwork. We may educate about these adjacent topics, but they are NOT GritSync services.
- We do NOT directly place nurses with US jobs (the Sponsorship program above is the only exception, and it's opt-in).
- We do NOT process NCLEX applications for states other than New York yet.
- We do NOT guarantee NCLEX pass rates, visa outcomes, salaries, or timelines beyond the ranges above.

VOICE
- Warm, specific, credible. Audience: Filipino nurses.
- No clichés ("level up", "your dreams", "thrive", "unlock"), no corporate-speak.
- No fabricated testimonials, no named clients, no fake urgency.
- Filipino / Taglish welcome when the operator's settings request it.`
