/**
 * Mika's "draft a quote inside a Messenger DM" capability.
 *
 * Flow (mirrors the public /quote page):
 *   1. Mika detects quote intent in the inbound message.
 *   2. She slot-fills across turns — first name, last name, email, mobile,
 *      taker type (first-time | retaker), payment type (full | staggered).
 *   3. Once every required slot is filled, the server creates the quotation
 *      directly in Postgres, fires the /send-quote email, and returns the
 *      quote URL so Mika can paste it back into the chat.
 *
 * Slot state is persisted in `social_quote_drafts` keyed by thread_id so a
 * mid-conversation server restart doesn't lose progress and a thread that
 * already has a created quote isn't re-served.
 *
 * The line-item / pricing logic is a verbatim port of the constants used on
 * the public /quote page (src/pages/Quote/constants.ts + handleSubmitQuote
 * in Quote.tsx). If the public flow ever changes (new step, new fee, tax
 * shift) update both places in lockstep.
 */
import { query } from '../db'
import { fbPost } from '../routes/social-meta'
import { findCachedReply } from './social-autopilot'

// Heuristic: does this inbound look like the client is asking about pricing
// or applying? Quote-intent triggers the stateful slot-fill flow; anything
// else can short-circuit through learned-knowledge cache and skip the LLM.
//
// We keep the regex simple + lowercase. False positives are fine (we'll
// just call the LLM, which then decides intent='chat'); false negatives
// are the bad case (we skip the quote flow when we shouldn't), so the
// vocabulary leans intentionally broad.
function looksLikeQuoteIntent(text: string): boolean {
  const t = text.toLowerCase()
  return /\b(magkano|magkakano|kuanto|quote|quotation|price|presyo|presyong|bayad|bayaran|payment|fees?|charge|cost|kuwota|how much|tuition|apply|application|enroll|sign[- ]?up|interested|sponsor)\b/.test(t)
}

// ── Pricing constants — mirror src/pages/Quote/constants.ts ─────────────
const TAX_RATE = 0.12
const NCLEX_STEP1_ITEMS = [
  { description: 'NCLEX NY BON Application Fee', amount: 143, taxable: false },
  { description: 'NCLEX NY Mandatory Courses', amount: 54.99, taxable: false },
  { description: 'NCLEX NY Bond Fee', amount: 70, taxable: false },
]
const NCLEX_STEP2_ITEMS = [
  { description: 'NCLEX PV Application Fee', amount: 200, taxable: false },
  { description: 'NCLEX PV NCSBN Exam Fee', amount: 150, taxable: false },
  { description: 'NCLEX GritSync Service Fee', amount: 150, taxable: false },
  { description: 'NCLEX NY Quick Results', amount: 8, taxable: false },
]

// ── Types ──────────────────────────────────────────────────────────────
export type TakerType = 'first-time' | 'retaker'
export type PaymentType = 'full' | 'staggered'

export interface QuoteSlots {
  firstName?: string
  lastName?: string
  email?: string
  mobile?: string
  takerType?: TakerType
  paymentType?: PaymentType
}

interface DraftRow {
  thread_id: string
  account_id: string | null
  status: 'collecting' | 'created' | 'cancelled'
  slots: QuoteSlots
  quote_id: string | null
}

// ── Slot persistence ───────────────────────────────────────────────────
export async function getDraft(threadId: string): Promise<DraftRow | null> {
  const r = await query(
    `SELECT thread_id, account_id, status, slots, quote_id
       FROM social_quote_drafts WHERE thread_id = $1`,
    [threadId]
  )
  return r.rows[0] || null
}

export async function upsertDraft(args: {
  thread_id: string
  account_id: string
  slots: QuoteSlots
  status?: 'collecting' | 'created' | 'cancelled'
  quote_id?: string | null
  last_message_id?: string | null
}): Promise<void> {
  await query(
    `INSERT INTO social_quote_drafts (thread_id, account_id, status, slots, quote_id, last_message_id, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
     ON CONFLICT (thread_id)
     DO UPDATE SET account_id = EXCLUDED.account_id,
                   status = COALESCE($3, social_quote_drafts.status),
                   slots = social_quote_drafts.slots || EXCLUDED.slots,
                   quote_id = COALESCE(EXCLUDED.quote_id, social_quote_drafts.quote_id),
                   last_message_id = COALESCE(EXCLUDED.last_message_id, social_quote_drafts.last_message_id),
                   updated_at = NOW()`,
    [
      args.thread_id,
      args.account_id,
      args.status || 'collecting',
      JSON.stringify(args.slots || {}),
      args.quote_id || null,
      args.last_message_id || null,
    ]
  )
}

// ── Quote creation ─────────────────────────────────────────────────────
export interface CreatedQuote {
  quote_id: string
  gq_id: string
  amount: number
  quote_url: string
}

// Mirrors `quotationsAPI.generateGQId` (src/lib/api-service.ts) so the GQ
// format we render in the email + chat matches what the /quote page would
// produce for the same UUID. Kept verbatim to avoid drift.
export function generateGQId(uuid: string): string {
  if (!uuid) return 'N/A'
  if (uuid.startsWith('GQ') && uuid.length === 14) return uuid
  const alphanumeric = uuid.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  let chars = ''
  const charsNeeded = 12
  for (let i = 0; i < charsNeeded; i++) chars += alphanumeric[i % alphanumeric.length]
  if (chars.length < charsNeeded) {
    const repeat = Math.ceil(charsNeeded / chars.length)
    chars = chars.repeat(repeat).substring(0, charsNeeded)
  }
  return `GQ${chars.substring(0, 12)}`
}

// Build the line items + totals from the slot set. NCLEX-only for now — the
// /quote page supports other services but Mika only offers NCLEX in DMs.
function buildLineItems(slots: QuoteSlots): {
  items: Array<{ id: string; description: string; quantity: number; unitPrice: number; total: number; payLater: boolean; taxable: boolean }>
  subtotal: number
  tax: number
  total: number
} {
  let raw: Array<{ description: string; amount: number; taxable: boolean; payLater: boolean }> = []
  if (slots.takerType === 'retaker') {
    raw = NCLEX_STEP2_ITEMS.map((i) => ({ ...i, payLater: false }))
  } else if (slots.paymentType === 'full') {
    raw = [
      ...NCLEX_STEP1_ITEMS.map((i) => ({ ...i, payLater: false })),
      ...NCLEX_STEP2_ITEMS.map((i) => ({ ...i, payLater: false })),
    ]
  } else {
    raw = [
      ...NCLEX_STEP1_ITEMS.map((i) => ({ ...i, payLater: false })),
      ...NCLEX_STEP2_ITEMS.map((i) => ({ ...i, payLater: true })),
    ]
  }
  const items = raw.map((i, idx) => ({
    id: `item-${idx}`,
    description: i.description,
    quantity: 1,
    unitPrice: i.amount,
    total: i.amount,
    payLater: i.payLater,
    taxable: i.taxable,
  }))
  const subtotal = items.reduce((s, it) => s + it.total, 0)
  const tax = items.reduce((s, it) => s + (it.taxable ? it.total * TAX_RATE : 0), 0)
  const total = subtotal + tax
  return { items, subtotal, tax, total }
}

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://www.gritsync.com').replace(/\/$/, '')

export async function createQuoteFromSlots(slots: QuoteSlots): Promise<CreatedQuote> {
  if (!slots.firstName || !slots.lastName || !slots.email || !slots.mobile) {
    throw new Error('Missing required client details')
  }
  if (slots.takerType !== 'first-time' && slots.takerType !== 'retaker') {
    throw new Error('takerType must be first-time or retaker')
  }
  // Retaker is always full payment in the /quote flow — no staggered option.
  const paymentType: PaymentType = slots.takerType === 'retaker' ? 'full' : (slots.paymentType || 'staggered')

  const { items, total } = buildLineItems({ ...slots, paymentType })
  const description = items.map((i) => `${i.description} (Qty: ${i.quantity})`).join('; ')
  const validityDate = new Date()
  validityDate.setDate(validityDate.getDate() + 30)

  // Mirror the createPublic Supabase insert shape: line_items is wrapped
  // with metadata to record taker_type for the /quote/:id reload path.
  const lineItemsCol = JSON.stringify({
    items,
    metadata: { taker_type: slots.takerType },
  })

  const insert = await query(
    `INSERT INTO quotations
       (user_id, amount, description, status, service, state, payment_type,
        line_items, client_first_name, client_last_name, client_email,
        client_mobile, validity_date)
     VALUES (NULL, $1, $2, 'pending', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
     RETURNING id, amount, created_at`,
    [
      Number(total.toFixed(2)),
      description,
      'NCLEX Processing',
      'New York',
      paymentType,
      lineItemsCol,
      slots.firstName,
      slots.lastName,
      slots.email,
      slots.mobile,
      validityDate.toISOString(),
    ]
  )
  const quoteId: string = insert.rows[0].id
  const gqId = generateGQId(quoteId)
  const quoteUrl = `${PUBLIC_BASE}/quote/${gqId}`

  // Fire the existing /send-quote email pipeline. Self-fetch keeps the
  // template logic in one place (server/routes/emails.ts) — no need to
  // duplicate the 200-line HTML builder here.
  const port = process.env.PORT || process.env.SERVER_PORT || 3001
  const internalBase = process.env.INTERNAL_API_BASE || `http://127.0.0.1:${port}`
  try {
    await fetch(`${internalBase}/api/emails/send-quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quoteNumber: gqId,
        quoteId,
        clientName: `${slots.firstName} ${slots.lastName}`.trim(),
        email: slots.email,
        mobileNumber: slots.mobile,
        service: 'NCLEX Processing',
        state: 'New York',
        paymentType,
        lineItems: items,
        subtotal: items.reduce((s, i) => s + i.total, 0),
        tax: items.reduce((s, i) => s + (i.taxable ? i.total * TAX_RATE : 0), 0),
        total,
        validUntil: validityDate.toISOString(),
        quoteUrl,
      }),
    })
  } catch (err: any) {
    // Email failure is non-fatal — the quote is created and the URL still
    // works. Log so the operator notices recurring SMTP issues.
    console.warn('[mika-quote] send-quote email failed (non-fatal):', err.message)
  }

  return { quote_id: quoteId, gq_id: gqId, amount: total, quote_url: quoteUrl }
}

// ── Slot extraction via LLM ────────────────────────────────────────────
//
// Given the recent conversation + the inbound message, return the structured
// turn decision: what slots we've now collected, the next question/reply to
// send, and whether we have enough to create the quote.
//
// We keep the LLM output minimal — just intent, slot updates, next_action,
// reply — to make parse failures rare and the call cheap.

const OPENAI_KEY = () => process.env.OPENAI_API_KEY

export interface MikaTurnDecision {
  intent: 'chat' | 'quote'
  slots: QuoteSlots
  next_action: 'chat' | 'collect' | 'create' | 'created'
  reply: string
}

const QUOTE_SYSTEM_PROMPT = `You are Mika, GritSync's DM concierge agent. Your job in this turn is to decide whether the conversation is a normal chat or a QUOTE REQUEST (client wants pricing or to apply).

Currently GritSync only quotes for "NCLEX Processing" in "New York". Those are the defaults; never ask the client to confirm them.

SLOTS YOU MUST COLLECT for a quote (in this order — ask ONE at a time, Filipino Taglish tone):
  1. takerType — "first-time" (haven't taken NCLEX yet) OR "retaker" (already failed once)
  2. firstName + lastName — ask together: "Anong full name niyo po?"
  3. email
  4. mobile (Philippine mobile, accept "09xx..." or "+63 9xx...")
  5. paymentType — "full" (one-time pay) OR "staggered" (two-step). SKIP this slot when takerType is "retaker" (retakers always pay full).

EXTRACTION RULES (read the WHOLE conversation, not just the latest message — the user may have already given multiple slots):
- Pick up details opportunistically: if the client wrote "Maria Santos, mariad@gmail.com, +639171234567, retaker", fill all four slots in one turn.
- Email validation: must contain "@" and a dot after.
- Mobile validation: must match Philippine mobile (starts with "09" or "+639" followed by 9 digits).
- Never invent or assume slot values. Only extract what the client actually wrote.

NEXT-ACTION DECISION TREE:
- intent="chat" + next_action="chat" — the message is general chit-chat or a NON-quote question. Just reply normally (1-2 sentences, Taglish). Don't ask quote questions.
- intent="quote" + next_action="collect" — at least one slot is still missing. Ask for ONE missing slot in a warm Taglish sentence. Acknowledge what they just sent ("Salamat po!") before asking the next thing.
- intent="quote" + next_action="create" — every required slot is filled and validated. Reply with a short "Sige po, ginagawa ko na po yung quote ninyo — mag-aabang lang po kayo!" message. The server will create + email the quote and append the link automatically. DO NOT include any URL yourself.
- intent="quote" + next_action="created" — the draft already shows status='created' (server passes this in DRAFT_STATUS). Don't re-create. Just remind them of the link or answer their question.

OUTPUT — return JSON ONLY, no markdown fence:
{
  "intent": "chat" | "quote",
  "slots": { "firstName"?: string, "lastName"?: string, "email"?: string, "mobile"?: string, "takerType"?: "first-time" | "retaker", "paymentType"?: "full" | "staggered" },
  "next_action": "chat" | "collect" | "create" | "created",
  "reply": "<the message to send to the client — Taglish, 1-3 sentences>"
}

KEEP REPLIES SHORT. Filipino Taglish with "po"/"opo". One question per reply. Never paste a list of all 5 slots in one go — that scares people.`

export async function decideMikaTurn(args: {
  conversation: Array<{ from: 'user' | 'mika'; text: string }>
  inbound: string
  existingSlots: QuoteSlots
  draftStatus: 'collecting' | 'created' | 'cancelled' | null
}): Promise<MikaTurnDecision> {
  const apiKey = OPENAI_KEY()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set on the server')

  const convoLines = args.conversation.slice(-15).map((m) => `${m.from === 'mika' ? 'Mika' : 'Client'}: ${m.text}`).join('\n')

  const userPayload = `EXISTING_SLOTS (already collected — keep these, don't overwrite unless the client corrected one):
${JSON.stringify(args.existingSlots || {}, null, 2)}

DRAFT_STATUS: ${args.draftStatus || 'none'}

CONVERSATION (oldest → newest):
${convoLines || '(no prior messages)'}

LATEST INBOUND MESSAGE (from client, just now):
"""
${args.inbound}
"""

Decide and return JSON.`

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 800,
      messages: [
        { role: 'system', content: QUOTE_SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
    }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI HTTP ${r.status}`)
  const text = j.choices?.[0]?.message?.content || '{}'
  let parsed: MikaTurnDecision
  try {
    parsed = JSON.parse(text)
  } catch {
    // If the model produced unparseable junk, fall back to a safe chat
    // response so we don't crash the autopilot tick.
    parsed = { intent: 'chat', slots: {}, next_action: 'chat', reply: 'Hi po! Pwede po ba ulit i-message ninyo? Hindi ko po nakuha yung message.' }
  }
  // Merge: never let the LLM clobber a previously-validated slot with empty.
  const mergedSlots: QuoteSlots = { ...(args.existingSlots || {}) }
  for (const k of ['firstName', 'lastName', 'email', 'mobile', 'takerType', 'paymentType'] as Array<keyof QuoteSlots>) {
    const v = (parsed.slots || ({} as any))[k]
    if (typeof v === 'string' && v.trim()) (mergedSlots as any)[k] = v.trim()
  }
  return {
    intent: parsed.intent || 'chat',
    slots: mergedSlots,
    next_action: parsed.next_action || 'chat',
    reply: (parsed.reply || '').trim() || 'Hi po, ano po yung kailangan ninyo?',
  }
}

// ── End-to-end turn handler ────────────────────────────────────────────
//
// Used by both the autopilot inbox runner (24/7) and the manual
// /quote-turn endpoint (for testing or operator-triggered runs).
// Returns the reply text to send to the client. The caller is responsible
// for actually sending it via the Messenger Send API.
export async function handleMikaQuoteTurn(args: {
  thread_id: string
  account_id: string
  conversation: Array<{ from: 'user' | 'mika'; text: string }>
  inbound: string
  inbound_message_id?: string | null
}): Promise<{ reply: string; status: 'chat' | 'collecting' | 'created'; created?: CreatedQuote }> {
  const draft = await getDraft(args.thread_id)

  // ── COST-CONTROL SHORT-CIRCUIT ────────────────────────────────────
  // If this thread has no active quote draft AND the inbound clearly
  // isn't quote intent, try the learned-knowledge cache first. A strong
  // fuzzy match against operator-APPROVED past replies (score >= 1) lets
  // us skip the entire decideMikaTurn LLM call. This is the dominant
  // cost reducer once the operator has thumbed-up a couple dozen replies
  // — the same handful of "what is GritSync?", "process timeline?",
  // "how do I apply?" questions cover most of the inbox traffic.
  if (!draft && !looksLikeQuoteIntent(args.inbound)) {
    const cached = await findCachedReply('inbox', args.inbound).catch(() => null)
    if (cached) return { reply: cached.reply, status: 'chat' }
  }

  // Already-served thread — never re-create. Let regular chat continue but
  // remind them of the link if they ask.
  if (draft?.status === 'created' && draft.quote_id) {
    const gqId = generateGQId(draft.quote_id)
    const url = `${PUBLIC_BASE}/quote/${gqId}`
    const decision = await decideMikaTurn({
      conversation: args.conversation,
      inbound: args.inbound,
      existingSlots: draft.slots || {},
      draftStatus: 'created',
    })
    const reply = decision.next_action === 'created'
      ? `${decision.reply}\n\n${url}`
      : decision.reply
    return { reply, status: 'created' }
  }

  const decision = await decideMikaTurn({
    conversation: args.conversation,
    inbound: args.inbound,
    existingSlots: draft?.slots || {},
    draftStatus: draft?.status || null,
  })

  if (decision.intent === 'chat') {
    return { reply: decision.reply, status: 'chat' }
  }

  // intent === 'quote'
  if (decision.next_action === 'create') {
    try {
      const created = await createQuoteFromSlots(decision.slots)
      await upsertDraft({
        thread_id: args.thread_id,
        account_id: args.account_id,
        slots: decision.slots,
        status: 'created',
        quote_id: created.quote_id,
        last_message_id: args.inbound_message_id || null,
      })
      // Combine the LLM's "ginagawa ko na po" reply with the actual link
      // + email confirmation in one message.
      const reply = `${decision.reply}\n\nQuote #${created.gq_id} po — total around $${created.amount.toFixed(2)}.\nLink: ${created.quote_url}\nKasama na po ito sa email niyo sa ${decision.slots.email}. Salamat!`
      return { reply, status: 'created', created }
    } catch (err: any) {
      console.warn('[mika-quote] create failed:', err.message)
      // Fall back to a graceful collecting reply rather than letting Mika
      // tell the client to wait when nothing's coming.
      return {
        reply: `Pasensya na po, may nangyaring error sa pag-generate ng quote (${err.message}). Pwede po ba subukin ulit, or i-DM nalang po sa support@gritsync.com?`,
        status: 'collecting',
      }
    }
  }

  // collect or chat-but-quote-intent → persist what we have so far.
  await upsertDraft({
    thread_id: args.thread_id,
    account_id: args.account_id,
    slots: decision.slots,
    status: 'collecting',
    last_message_id: args.inbound_message_id || null,
  })
  return { reply: decision.reply, status: 'collecting' }
}

// Best-effort wrapper that also sends the typing indicator + reply via the
// Messenger Send API. Used by the autopilot. Manual operator-triggered
// turns can call this too via the /quote-turn route.
export async function sendMikaReply(args: {
  account: { access_token: string; platform: 'facebook' | 'instagram'; platform_user_id: string; metadata: any }
  recipient_psid: string
  reply: string
}): Promise<void> {
  const baseId = args.account.platform === 'instagram'
    ? (args.account.metadata?.linked_page_id || args.account.platform_user_id)
    : args.account.platform_user_id

  try { await fbPost(`${baseId}/messages`, args.account.access_token, { recipient: { id: args.recipient_psid }, sender_action: 'typing_on' }) } catch {}
  await new Promise((r) => setTimeout(r, Math.min(3000, 600 + args.reply.length * 25)))
  await fbPost(`${baseId}/messages`, args.account.access_token, {
    recipient: { id: args.recipient_psid },
    message: { text: args.reply },
    messaging_type: 'RESPONSE',
  })
  try { await fbPost(`${baseId}/messages`, args.account.access_token, { recipient: { id: args.recipient_psid }, sender_action: 'typing_off' }) } catch {}
}
