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
- +63 969 153 3239
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

/**
 * Distilled image-craft knowledge fed into Lensa (the art-director agent)
 * on every /image-templates/orchestrate call. Built from current (2026)
 * prompting guides for gpt-image-1.5, Midjourney V7, Gemini "nano-banana",
 * Grok image, and Kling v1-5, plus Meta's safe-zone specs.
 *
 * Lensa already knows the GritSync brand from GRITSYNC_KB above — this
 * second KB teaches her HOW to write image-template prompts that survive
 * real renderers and look like brand assets, not stock-photo flatness.
 *
 * Keep this practical. Every line should change what Lensa writes.
 */
export const LENSA_IMAGE_CRAFT_KB = `IMAGE-CRAFT GROUND TRUTH FOR LENSA (apply on every template you design):

PROMPT FORMULA — write in this exact order so the renderer weights the right things first:
SUBJECT → ENVIRONMENT → COMPOSITION → LIGHTING → STYLE → CAMERA → TYPOGRAPHY → BRAND ELEMENTS → NEGATIVE PROMPT.
Image models weight earlier words more heavily — lead with the subject and medium ("photoreal editorial portrait of a Filipino nurse…"), not with mood adjectives.

STRUCTURED, NOT FLOWERY:
- Use labelled sections separated by line breaks. One long purple paragraph reads worse than seven tight labelled lines.
- Be specific. "Modern" is vague; "clean editorial sans-serif, restrained warm palette, shallow depth-of-field" is not.
- A template will be rendered against MANY different captions. Describe a KIND of moment ("a quiet study scene at golden hour") — never a single literal scene.

TEXT RENDERING — the #1 failure mode for brand images. Apply ALL of these:
- Wrap every literal on-canvas word in straight double quotes. Renderers treat quoted strings as letterforms to reproduce verbatim.
- Spell brand strings letter-by-letter the first time they appear in the prompt: "GritSync" (G-r-i-t-S-y-n-c, one word, capital G and capital S) and "gritsync.com" (lowercase g-r-i-t-s-y-n-c dot c-o-m). This is the single biggest fix for "GritSinc"/"GritSink"/"Grit Sync" misreads.
- Keep on-canvas copy SHORT: headlines ≤6 words, CTAs ≤4 words, max 2 stacked lines. Long sentences turn into glyph soup.
- Specify font traits explicitly: "clean modern sans-serif", "geometric grotesque", "bold weight for headline, regular for body". Avoid script or handwritten faces unless the template's whole identity is built around them.
- Repeat the brand-string variants in the Negative prompt ("never 'GritSink', 'GritSinc', 'Grit Sync', 'gritsync com'") so the renderer is reminded what NOT to draw.

COMPOSITION:
- Name one framing keyword up front: portrait headshot / medium close-up / environmental wide / candid documentary / over-the-shoulder / top-down flat-lay / hero centered.
- Anchor focal point on a rule-of-thirds intersection — call it out ("subject's eyes on the upper-third line").
- Always reserve negative space for caption overlay — name where it lives ("clean upper-left third reserved for caption overlay").
- For portrait templates, specify depth-of-field: f/1.8 to f/2.8 — soft creamy background, tack-sharp eyes.

LIGHTING:
- Name a lighting style: soft window light / golden hour rim / overcast diffuse / single-source dramatic / studio softbox key + bounce fill. Vague lighting collapses into the flat default AI look.
- Filipino skin tones render best at warm 3500-4500K with gentle highlights — avoid harsh midday sun and cold blue casts.

PALETTE — anchor explicitly:
- GritSync palette with hex anchors: deep red #B81D24, clean white #FFFFFF, soft black #1A1A1A, restrained warm gold accent #C8A24C.
- Keep accent colours ≤10% of the frame so the brand red stays dominant.

PHOTOREAL CAMERA LANGUAGE — every photoreal template should name a camera + lens:
- "shot on Sony A7 IV, 50mm f/1.8" or "Fujifilm X-T5, 35mm f/2".
- For editorial banner looks: "editorial magazine photography, Kodak Portra 400 grain, subtle film tone".
- Naming a camera body sticks the render away from CGI/illustration into the photoreal corner.

ASPECT RATIO & SAFE ZONES — pick ONE primary ratio per template and write the prompt around it:
- 1:1 (1080x1080) — feed staple. Centered subject. Keep ~120px breathing margin on all sides.
- 4:5 (1080x1350) — Meta's preferred portrait, occupies ~33% more mobile screen than 1:1. Subject at upper-third intersection. Keep critical content inside the central 1080x1080 region — survives the profile-grid square crop.
- 9:16 (1080x1920) — Reels/Stories. Vertical hero with text in the central band. NEVER put headline copy in the top 250px or bottom 340px — Instagram/Facebook UI chrome covers them.
- 16:9 (1920x1080) — banners, YouTube thumbs. Horizontal lockup. Brand wordmark in one corner, headline + subject split left/right.

NEGATIVE PROMPT — always include something like:
"garbled text, extra letters, misspelled words, double-printed type, distorted hands, warped fingers, plastic skin, AI artifacts, watermark, stock-photo flatness, cluttered background, low contrast, off-brand palette, fake bokeh, oversaturated colors, non-Filipino subject".

RENDERER-SPECIFIC NOTES — tune the prompt to the renderer the operator picked:
- OpenAI gpt-image-1 (default, quality: high) — best text + photoreal subjects in one call. Accepts ~32K input tokens so write the full multi-paragraph labelled prompt without compression. Strongest typography of any current model. ALWAYS spell brand strings letter-by-letter for this renderer.
- Gemini "nano-banana" (gemini-2.5-flash-image) — clean editorial composition, crisp typography. Prefers shorter, sharply labelled prompts. Strong at preserving exact quoted strings.
- Grok image (grok-2-image) — photoreal but weaker at fine typography. Prefer minimal on-canvas copy: rely on the wordmark + URL only, skip the headline.
- Kling v1-5 — cinematic colour grading and gorgeous skin tones, weak at small text. Keep typography big and bold, or omit the headline entirely and let the caption do the talking.

REUSABILITY GUARDRAIL:
- The template prompt will be rendered hundreds of times against different captions. Avoid one-shot specifics ("holding a coffee cup that says Monday"). Describe categories ("holding a study aid that anchors the lower-left") so the same prompt produces a coherent series across many posts.

════════════════════════════════════════════════════════════════════════
DEEP TYPOGRAPHY — when an image carries text, treat it like a designer
════════════════════════════════════════════════════════════════════════

TYPE SYSTEM (pick ONE per template — don't mix more than 2 type families):
- "Editorial sans-serif" — clean modern grotesque, geometric, slightly condensed. Reference faces in spirit: Söhne, Inter, GT America, Aktiv Grotesk. The default brand voice.
- "Display serif" — sharp high-contrast serif for premium / authoritative templates. Reference in spirit: Canela, Tiempos Headline, Recoleta. Use sparingly — on hero banners, milestone announcements.
- "Mono accent" — a single line of monospaced caption (IBM Plex Mono, JetBrains Mono in spirit) for "process / data / behind-the-scenes" templates.
- NEVER specify Comic Sans, Papyrus, Bradley Hand, or any decorative script unless the template's identity is built around handwritten warmth (rare).

WEIGHT + HIERARCHY:
- Headline: bold (700-800) weight. ≤6 words. Tracks tight (-2% to -4% tracking).
- Subhead: regular (400) or medium (500). ≤8 words. Tracks normal.
- Microcopy / URL / disclaimer: regular at small size. Tracks +4-8% (wider letterspacing improves legibility at small sizes).
- Two-line stacked headline rule: the SECOND line should be shorter than the first, or one significant word longer — never the same length (looks like a paragraph break, not a headline).

KERNING + LETTERSPACING (renderers won't honor exact values, but naming them tightens the result):
- Display headlines: "tight tracking, optically kerned, balanced rag".
- ALL CAPS lockups: "+5% tracking minimum" — uppercase needs more breathing room than mixed case.
- Single-word logos / wordmarks: "optically kerned, custom letterfit". Helps the model render brand strings without garbling.

CASE TREATMENT — pick one per text element:
- Mixed case ("Sentence case" or "Title Case") — warm, human, default for headlines.
- ALL CAPS — authoritative, formal, banner energy. Always pair with extra letterspacing.
- lowercase — modern, intimate, lifestyle. Use for subheads, never headlines.

TEXT LAYOUT PATTERNS — name one per template:
- "Left-aligned stack" — headline + subhead flush-left in the upper-left third. Most editorial-feeling.
- "Centered axial lockup" — symmetric, anthem-style. Hero banners, milestone celebrations.
- "Anchor + tag" — large headline anchored bottom-left, small tag/CTA top-right. Action-poster energy.
- "Window caption" — short headline at the bottom over a darker scrim strip across the lower 25% of the frame.
- "Lateral spine" — headline runs vertically up the right edge (use only for 9:16 templates; never crops on grid).
- "Margin + body" — a wide upper margin reserved for headline + a body block flush-left in the middle third.

TEXT LEGIBILITY OVER IMAGERY — name the strategy:
- "Subtle gradient scrim" — a soft black-to-transparent gradient where the text sits (top 20% or bottom 30%). Most invisible, most editorial.
- "Frosted glass band" — a translucent white band with 60% opacity behind the headline. Premium feel.
- "Knockout block" — solid GritSync deep red rectangle behind the headline, white text. High-impact for CTAs.
- "Outline + drop" — text in white with a 1-2px soft drop shadow, no scrim. Only over already-dark or uniform backgrounds.
- "In-scene placement" — text reads on a real-world surface (notebook page, signage, magazine spread). The most "designed in" feel; reserve for templates that explicitly stage a surface for it.

ON-CANVAS COPY SPECIFY:
- The literal headline string IF the template fixes one (e.g. "USRN starts here") — wrap in straight double quotes.
- A length budget if the template will accept a per-render caption ("headline placeholder for ≤6 words, 2 stacked lines max, will be filled per-post").
- Color + scrim treatment for the headline (per the strategies above).
- Position with rule-of-thirds language ("headline sits along the upper third, flush-left, with a 60px gutter from the left edge").

════════════════════════════════════════════════════════════════════════
BACKGROUNDS — half the image is the background; design it as carefully as the subject
════════════════════════════════════════════════════════════════════════

BACKGROUND CATEGORIES (pick ONE):
- "Clean studio" — seamless paper backdrop in a brand-anchored color (deep red #B81D24, warm cream, soft charcoal). Premium and isolating. Subject reads as the only thing.
- "Environmental context" — a real-world setting that anchors the brand story: a quiet study desk near a window, a kitchen table at golden hour with study materials, a hospital corridor in soft focus, an airport boarding area with a passport on the foreground. Pick environments tied to the NCLEX / USRN journey.
- "Editorial blurred backdrop" — a real environment thrown WAY out of focus (f/1.4-f/1.8, 85mm) so the background is a creamy color field with light orbs (window bokeh, lamp halos, computer screen glow).
- "Narrative dual-frame" — split the canvas (left/right or top/bottom) with two related vignettes that imply a before/after, study/celebration, Philippines/US, etc.
- "Gradient + texture overlay" — a single brand-color gradient (deep red top → soft black bottom) with a subtle photographic texture (linen weave, paper grain, soft film noise). Modern editorial-poster feel.
- "Hero banner backdrop" — a wide environmental scene (skyline silhouette, hospital exterior, sunset) compressed to 16:9 with the subject + headline lockup overlaid.
- "Top-down flat-lay" — bird's-eye view on a wooden / linen / marble surface with study aids, a passport, an ID lanyard, a coffee cup arranged in negative-space-aware composition.

BACKGROUND COLOR / TONE:
- ALWAYS specify a dominant background hue ("warm cream #F1ECE2 backdrop", "deep red #B81D24 scrim wall", "out-of-focus golden-hour window").
- Ensure subject-to-background contrast: a fair-skinned subject in soft-black scrubs reads cleanly against a cream or red backdrop; against another dark wall it gets muddy. Call out the contrast plan explicitly.
- Keep background palette to ≤3 colors. More than 3 splits the eye and looks like stock photography.

DEPTH LAYERS — name three:
- "Foreground anchor" — a soft prop / object in the lower third that adds depth without distracting (an out-of-focus stethoscope, a notebook corner, a coffee mug at the edge of the frame).
- "Midground subject" — where the subject lives, in sharp focus.
- "Background field" — soft, simplified, supporting. Out-of-focus environmental detail or solid color scrim.

ATMOSPHERE — small touches that lift a render from "AI image" to "shot photo":
- "Soft window haze" — gentle atmospheric mist that catches sidelight. Adds film realism without feeling staged.
- "Dust motes" — visible only in the rim-lit air near a window. Editorial documentary feel.
- "Light orbs / bokeh balls" — pleasing background lights for environmental templates (string lights, distant car headlights, screen glows).
- "Lens flare" — only if the light source is in or near the frame; specify "subtle anamorphic flare" not "heavy flare".
- "Subsurface skin glow" — for portraits, call out "soft subsurface scattering on skin, gentle highlights along jawline + cheekbone".

BACKGROUND-AS-MESSAGE — design backgrounds that REINFORCE the brand story:
- Study scenes → quiet desk with NCLEX-style prep materials (handwritten notes, marked-up textbook, highlighter, mug). Never an actual NCLEX booklet (trademarked).
- Celebration / pass scenes → soft confetti out-of-focus background, warm interior light, family / phone-call energy.
- Process / paperwork scenes → clean white desk with a passport, ID photos, manila envelope, fountain pen, a laptop showing the GritSync dashboard (described as "a generic teal-and-red dashboard UI on the laptop screen — no specific UI strings").
- Migration / arrival scenes → airport gate, boarding area, US skyline silhouette out-of-focus, packed suitcase as foreground anchor.
- Sponsorship / employer scenes → professional handshake in a brightly-lit US-style hospital lobby, ID lanyards visible.

════════════════════════════════════════════════════════════════════════
PROPS, WARDROBE, SET DRESSING — the details that say "real, not AI"
════════════════════════════════════════════════════════════════════════

WARDROBE — Filipino nurses, photoreal, brand-aligned:
- Scrub colors: navy, deep teal, burgundy (NOT pure brand-red — too saturated for scrubs), soft black, or "ceil blue" (the actual US-hospital scrub color). Avoid pastel pink/lavender which read as cosplay.
- Scrub style: short-sleeve V-neck top + matching pants, modern fit. Drawstring waist visible. Quality fabric — no shiny synthetic look.
- Accessories: thin gold or steel watch, a single delicate ring at most, simple stud earrings, no large jewelry. ID-card lanyard with a generic photo ID (face turned away or blurred — never a recognizable named person).
- Hair: dark brown to black, healthy texture, tied back in a low bun for working scenes, loose with natural waves for portraits. Specify "natural Filipina hair texture, glossy, not over-straightened, no extreme styling".
- Makeup: light natural — tinted moisturizer, soft brow, hint of cream blush, neutral lip. Never heavy contour, never glam, never bridal.
- For study scenes: comfortable casual instead of scrubs — Filipino-style oversized white tee or soft knit, dark jeans or relaxed trousers.

PROPS — the "study scene" toolkit (mix + match per template):
- Hardback textbook (no logos, marked-up margins, sticky tabs in muted colors).
- Spiral notebook open to a handwritten page (the handwriting should be a careful adult cursive in dark blue ink — not the rendered-looking print AI defaults to).
- A highlighter (pastel yellow or pink) capped, lying parallel to the notebook spine.
- A ceramic mug — matte white, plain, half-full of coffee. Not a branded chain cup.
- A laptop (silver MacBook-style or generic dark-aluminum) on the desk, lid open, screen showing a soft warm UI mockup — never specific recognizable software.
- Reading glasses, folded, resting on the textbook.
- A glass of water with condensation, off to the side.

PROPS — the "USRN journey" toolkit:
- Philippine passport (the maroon cover with the gold seal). Specify "a Philippine passport, maroon cover, gold seal, lying closed on a wooden desk".
- A 2x2 ID photo card, white background, formal pose.
- A manila envelope, slightly creased.
- A USCIS-style government letter (no specific logos / no recognizable seal — just "an official-looking government letter on letterhead").
- A printed ATT-style authorization document (generic blue-bordered letterhead, no specific NCSBN branding).
- A boarding pass mock-up (no airline branding) showing PH → US route.

SET DRESSING DETAILS THAT SELL REALISM:
- Slight asymmetry in object placement. Perfectly aligned props read as CGI.
- Subtle wear: a folded textbook page corner, a coffee ring on a napkin, ink fading at the edge of a handwritten note.
- A few crumbs or eraser shavings near study materials.
- A small live plant (snake plant, pothos, monstera) softly out-of-focus in the corner — humanizes any desk.
- Visible cable management in tech scenes — never floating laptops with no power cable.

PROPS — the "celebration" toolkit:
- A phone face-up showing a generic "Pass" notification screen (without literal NCSBN strings — describe as "a soft green-tinted result-style notification, no specific app branding").
- Soft white tissue paper or a folded uniform on a bed.
- A small bouquet of mixed white + yellow flowers (no specific florist branding).
- A laptop showing a results page (generic, no logos).
- Tear glistening on cheek + smile — emotional, not staged.

════════════════════════════════════════════════════════════════════════
LIGHTING + COLOR GRADING — the layer that makes a render feel cinematic
════════════════════════════════════════════════════════════════════════

LIGHTING SETUPS — name one explicitly with this vocabulary:

- "Soft window light" — single large window source from frame-left or frame-right. Soft fall-off across the face. White lace curtain optional for diffusion. Best for intimate study / contemplation templates.
- "Golden hour rim" — late-afternoon sun BEHIND the subject creating a warm rim light along hair + shoulders. Front fill from a bounce card or window. Best for milestone / arrival templates.
- "Overcast diffuse" — flat soft daylight, no directional shadows. Best for documentary / process templates where mood should be neutral.
- "Single-source dramatic" — one hard light from 45° front-left. Deep shadows on the off-side. Best for hero portraits / "determination" energy.
- "Studio softbox key + bounce fill" — large softbox 45° camera-left, white bounce on camera-right at 60% to fill shadows. Editorial portrait standard.
- "Practical interior glow" — warm tungsten lamps, computer screen glow, string lights. Night study scenes, late-night prep energy.
- "Hospital fluorescent corrected" — cool 5500K overhead with warm fill to neutralize green cast. Use SPARINGLY — fluorescents make any image look clinical.

COLOR GRADING — name a film stock or grade pattern:
- "Kodak Portra 400 grade" — warm skin tones, soft contrast, slightly desaturated greens, creamy highlights. Editorial default. Works for almost any GritSync template.
- "Fujifilm Pro 400H" — cooler, slightly green-shifted, very gentle on skin. Good for documentary / process templates.
- "Cinestill 800T tungsten" — green-orange teal shift, halated highlights around light sources. Use for night / interior practical-light templates only.
- "Modern editorial grade" — clean contrast, true neutrals, slightly lifted blacks, no film grain. Hero banners + tech-forward templates.
- "Warm documentary grade" — golden midtones, slightly crushed blacks, very gentle highlight roll-off. Family / human-story templates.

LIGHTING DIRECTION CHEAT SHEET — name angle + ratio:
- Key light 45° front-left, fill 60% from right. Standard editorial portrait.
- Key 90° side, no fill — dramatic single-source.
- Backlight + bounce-card fill — golden-hour silhouette with face visible.
- Top-down soft — flat-lay table-top, single overhead diffuse with no harsh shadows.

════════════════════════════════════════════════════════════════════════
SUBJECT DIRECTION — pose, gaze, emotion
════════════════════════════════════════════════════════════════════════

POSE LANGUAGE — specify ONE:
- "Three-quarter turn, body slightly off-axis from camera". Most flattering.
- "Direct frontal, shoulders square". Authoritative, hero-banner energy.
- "Profile" (side view). Reflective, contemplative.
- "Over-the-shoulder, glancing back". Narrative, journey-energy.
- "Seated, leaning forward over a desk". Study scenes.
- "Standing, weight on one hip". Casual portrait, relaxed energy.

GAZE — specify ONE:
- "Direct eye contact with the camera". Connection, recruitment-poster energy.
- "Gaze down at the work in their hands". Focused study scenes.
- "Gaze slightly off-camera at a mid-distance". Reflective, narrative.
- "Gaze upward toward a window or light source". Hopeful, arrival energy.

EMOTION VOCABULARY — pick one mood, never combine more than two:
- "Quiet determination" — focused but not strained. Working-toward-goal energy.
- "Calm preparation" — settled, ready, no anxiety. Study templates.
- "Joyful relief" — soft genuine smile, slightly teary eyes. Pass moments.
- "Triumphant celebration" — open laugh, eyes closed in relief. License-issued moments.
- "Focused concentration" — eyes narrowed slightly, lips parted, in flow.
- "Tender support" — two-person scene, one hand on the other's shoulder, mutual gaze. Family / sponsor support scenes.
- "Bicultural pride" — subject in scrubs holding a small Philippine flag pin OR positioned between Philippine and US symbols (a maroon passport + a US visa stamp visible).

AGE + DEMOGRAPHIC RANGE:
- Working-age Filipino nurses: 24-34 most common, but design templates that ALSO read for 35-44 (career changers / retakers) and 45-55 (experienced PRC RNs pursuing USRN late). Avoid templates that lock to one age range.
- Skin tones: warm medium (most common Filipina), warm light, warm deep — span all three across the template library. Specify "warm medium Filipina skin tone, healthy undertone" or similar.
- Body type: realistic — NOT model-thin, NOT artificially curvy. "Average healthy adult build" is the right anchor.

════════════════════════════════════════════════════════════════════════
SCENE PATTERNS — proven template archetypes Lensa can ship variations of
════════════════════════════════════════════════════════════════════════

Each is a starting shape, NOT a literal scene. Vary specifics across the library.

1) "QUIET STUDY SCENE"
   Subject: single Filipina nurse, late 20s, casual loungewear, seated at a wooden desk.
   Action: handwriting notes in a spiral notebook.
   Setting: home interior near a soft afternoon window, indoor plant out-of-focus background.
   Lighting: soft window light from frame-left.
   Style: Kodak Portra 400 grade, gentle film grain.
   Props: open NCLEX-style prep book, highlighter, half-full white mug, glasses folded on the desk.
   Negative space: upper-right third reserved for headline overlay.

2) "ATT-INBOX MOMENT"
   Subject: medium close-up of a Filipina nurse looking at her phone screen, soft genuine smile beginning.
   Action: reading what's clearly good news on the phone.
   Setting: home kitchen counter, morning light from a window behind her shoulder.
   Lighting: golden hour rim, warm front fill.
   Style: warm documentary grade.
   Props: coffee mug on the counter, blurred-out passport visible at the edge.
   Negative space: upper third reserved for caption.

3) "HERO BANNER LOCKUP"
   Subject: Filipina nurse in clean scrubs, three-quarter turn, direct eye contact.
   Action: standing still, arms at side, calm confident posture.
   Setting: clean studio backdrop in deep red #B81D24, soft seamless.
   Lighting: studio softbox key + bounce fill.
   Style: modern editorial grade, no film grain.
   Props: ID lanyard with generic photo card visible.
   Typography: "Anchor + tag" layout — large headline anchored bottom-left, small tag/CTA top-right.

4) "GOLDEN HOUR PASS"
   Subject: Filipina nurse outdoors, late afternoon, eyes closed, soft tearful smile.
   Action: holding her phone loosely in one hand at her side, the other hand near her chest.
   Setting: residential outdoor scene, soft suburban or apartment-balcony backdrop, throw-out-of-focus.
   Lighting: golden hour rim from behind, warm front fill from a bounce.
   Style: Kodak Portra 400, lifted blacks.
   Props: phone with a generic green-tinted "results" notification visible if the angle permits.
   Negative space: centered axial axis with breathing room above and below the subject.

5) "TOP-DOWN FLAT-LAY"
   Subject: no human — hands optional in the upper margin.
   Action: bird's-eye view of an arrangement on a wooden or linen surface.
   Setting: warm wood desk OR cream linen tablecloth.
   Props: Philippine passport, 2x2 ID photo card, manila envelope, fountain pen, a corner of a notebook, mug, lanyard, NO actual brand logos.
   Lighting: top-down soft, single overhead diffuse.
   Style: Fujifilm Pro 400H grade.
   Negative space: center-right reserved for headline overlay.

6) "NEWSROOM DOCUMENTARY"
   Subject: Filipina nurse, candid mid-action.
   Action: in conversation with another person off-camera, the moment of being mid-sentence.
   Setting: hospital corridor, employer office, or USRN orientation room. Soft fluorescent corrected to warm.
   Lighting: practical interior with a key window source.
   Style: Fujifilm Pro 400H, gentle desaturation.
   Props: clipboard, stethoscope visible at neck, ID lanyard.
   Negative space: bottom 30% reserved for "Window caption" scrim + headline.

7) "BEFORE / AFTER SPLIT"
   Composition: vertical split — left half "Philippines, studying", right half "USA, working".
   Lighting: warm tungsten on the left, cool corrected fluorescent on the right.
   Style: matched Kodak Portra grade across both halves.
   Subjects: same Filipina nurse on both sides — left in casual clothes with study materials, right in clean scrubs with ID lanyard.
   Negative space: thin vertical center seam with a small headline running across it.

8) "FAMILY SUPPORT SCENE"
   Subject: Filipina nurse + parent / sibling / partner — two-figure composition.
   Action: hug, hand-on-shoulder, or shared looking-at-phone moment.
   Setting: warm home interior, soft evening light.
   Lighting: practical interior glow + window fill.
   Style: warm documentary grade.
   Props: phone showing soft generic notification screen.
   Emotion: "tender support" or "joyful relief".

════════════════════════════════════════════════════════════════════════
PROMPT QUALITY CHECKLIST — Lensa reviews her own draft against this list
════════════════════════════════════════════════════════════════════════

Before finalizing the template, the produced prompt MUST have:
☐ A single named SUBJECT category (Filipina nurse + role-specific dress / context).
☐ A specific named LIGHTING setup from the vocabulary above (not just "good lighting").
☐ A specific BACKGROUND category + dominant hue + contrast plan.
☐ A specific TYPOGRAPHY layout pattern + weight + tracking direction.
☐ A specific COLOR GRADE / film-stock reference.
☐ A named CAMERA + LENS (e.g. "Sony A7 IV, 50mm f/1.8").
☐ At least 2 named PROPS / set dressing items appropriate to the scene.
☐ A specific COMPOSITION framing keyword + rule-of-thirds anchor.
☐ ASPECT RATIO + safe-zone notes for the primary ratio.
☐ NEGATIVE PROMPT including brand misspelling guards + at least 6 anti-artifact terms.
☐ Reusability check: no one-shot specifics that won't generalize across many captions.
☐ Brand integration: instruction to NATURALLY INCORPORATE the provided GritSync logo into the scene as a real-world object (badge, lanyard, embroidery, signage, notebook sticker).

If any checkbox is missing, Lensa rewrites that section BEFORE returning the template.`
