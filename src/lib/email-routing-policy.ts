/**
 * Email routing policy.
 *
 * Distinguishes "system notifications" (document upload confirmations,
 * reminders, profile-completion nudges, etc.) from real business
 * transactions (payment receipts, application status changes, quotations,
 * invoices, sponsorship approvals).
 *
 * The rule the product wants enforced:
 *   • SYSTEM notifications  → in-app only, or to the user's PERSONAL email.
 *     Never delivered to the user's @gritsync.com business mailbox.
 *   • BUSINESS transactions → may use the user's business mailbox; that
 *     mailbox is reserved for actual transactional correspondence during
 *     processing.
 *
 * This module is a single source of truth for that classification. The
 * `resolveDeliveryAddress` helper centralizes the routing decision so all
 * callers (sendEmail, workflows, ad-hoc scripts) behave consistently.
 */

import { db } from './api-client'

export type EmailDelivery = 'business' | 'personal' | 'system' | 'unknown'

/**
 * Categories that are PURELY system / informational. They should never reach
 * the user's business mailbox; they belong in-app or, at most, in the user's
 * personal inbox.
 */
const SYSTEM_NOTIFICATION_CATEGORIES = new Set<string>([
  // Documents
  'document_uploaded',
  'document_pending_review',
  'document_approved',
  'document_rejected',
  'document_missing',
  'missing_document',
  'missing_documents',
  'document_reminder',

  // Profile / onboarding nudges
  'profile_completion',
  'missing_details',
  'profile_reminder',
  'welcome',                  // welcome ping should hit personal email, not business mailbox
  'email_verification',

  // In-app generic
  'general',
  'notification',
  'reminder',
  'system',
  'in_app_notification',
  'timeline_update',

  // NCLEX prep — these are educational pings, not business transactions
  'nclex_progress',
  'nclex_reminder',
  'nclex_streak',
  'lecture_reminder',

  // Marketing-ish
  'newsletter',
  'announcement',
])

/**
 * Categories that ARE business transactions during processing. These may use
 * the user's business mailbox.
 */
const BUSINESS_TRANSACTION_CATEGORIES = new Set<string>([
  // Application processing
  'application_submitted',
  'application_status_change',
  'application_status_changed',
  'application_approved',
  'application_rejected',
  'application_on_hold',
  'visa_bulletin',

  // Payments
  'payment_confirmation',
  'payment_receipt',
  'payment_reminder',
  'payment_failed',
  'refund',
  'invoice',

  // Quotations
  'quotation_issued',
  'quotation_accepted',
  'quotation_expired',

  // Sponsorships / donations
  'sponsorship_approved',
  'sponsorship_funded',
  'donation_receipt',

  // Contracts / legal
  'contract',
  'agreement',
  'school_letter',
  'full_instructions',
])

/**
 * Decide whether a given (emailType, emailCategory) pair is a system
 * notification. Marketing/manual sends fall outside both lists and are
 * treated as "unknown" — handled with the safer default (route to personal).
 */
export function classifyEmail(
  emailType: string | null | undefined,
  emailCategory: string | null | undefined
): EmailDelivery {
  const cat = (emailCategory || '').toLowerCase()
  if (cat && SYSTEM_NOTIFICATION_CATEGORIES.has(cat)) return 'system'
  if (cat && BUSINESS_TRANSACTION_CATEGORIES.has(cat)) return 'business'

  // Fall back to emailType for callers that didn't pass a category.
  const t = (emailType || '').toLowerCase()
  if (t === 'transactional') return 'business'
  if (t === 'notification' || t === 'reminder' || t === 'automated') return 'system'
  if (t === 'marketing') return 'system'
  return 'unknown'
}

export interface DeliveryDecision {
  /** Final recipient email to send to (or null to block the email entirely). */
  to: string | null
  /** Whether the address was changed away from the requested one. */
  rerouted: boolean
  /** Original requested recipient. */
  originalTo: string
  /** Human-readable reason for diagnostics. */
  reason: string
  /** Classification used for the decision. */
  delivery: EmailDelivery
}

/**
 * Heuristic for "is this a GritSync-managed business mailbox?"
 *
 * Every business mailbox lives under @gritsync.com. Personal emails are
 * always external (gmail / yahoo / etc.). External -> @gritsync.com is the
 * forbidden direction for system notifications.
 */
function isBusinessMailbox(email: string): boolean {
  return !!email && email.trim().toLowerCase().endsWith('@gritsync.com')
}

/**
 * Look up a user's personal email from a business mailbox (or recipient user
 * id). Returns null if no personal email can be resolved.
 */
async function resolvePersonalEmail(opts: {
  requestedTo: string
  recipientUserId?: string | null
}): Promise<string | null> {
  // 1. Prefer an explicit recipient_user_id.
  if (opts.recipientUserId) {
    try {
      const { data } = await db.from('users').select('email').eq('id', opts.recipientUserId).single()
      const u = data as any
      if (u?.email && !isBusinessMailbox(u.email)) return u.email
    } catch { /* fall through */ }
  }

  // 2. If the requested email is itself a business mailbox, walk the
  //    email_addresses table to its owner and read users.email from there.
  if (isBusinessMailbox(opts.requestedTo)) {
    try {
      const { data: addrRow } = await db
        .from('email_addresses')
        .select('user_id')
        .eq('email_address', opts.requestedTo)
        .single()
      const ownerId = (addrRow as any)?.user_id
      if (ownerId) {
        const { data: u } = await db.from('users').select('email').eq('id', ownerId).single()
        const personal = (u as any)?.email
        if (personal && !isBusinessMailbox(personal)) return personal
      }
    } catch { /* fall through */ }
  }

  // 3. If the requested email is NOT a business mailbox, it's already personal.
  if (!isBusinessMailbox(opts.requestedTo)) return opts.requestedTo

  return null
}

/**
 * Centralized routing decision. Call this before handing the email off to the
 * sender so the right recipient is chosen.
 *
 * - SYSTEM categories targeting a business mailbox are redirected to the
 *   user's personal email if one is known; otherwise the email is blocked
 *   (returns to=null) so callers know to drop it.
 * - BUSINESS categories pass through unchanged.
 * - UNKNOWN categories are conservatively redirected when sent to a business
 *   mailbox (better to surface to the user than into the wrong inbox).
 */
export async function resolveDeliveryAddress(opts: {
  to: string
  emailType?: string | null
  emailCategory?: string | null
  recipientUserId?: string | null
}): Promise<DeliveryDecision> {
  const originalTo = opts.to
  const delivery = classifyEmail(opts.emailType, opts.emailCategory)

  if (delivery === 'business') {
    return { to: originalTo, rerouted: false, originalTo, reason: 'business transaction — business mailbox allowed', delivery }
  }

  // System / unknown: never deliver to a business mailbox.
  if (isBusinessMailbox(originalTo)) {
    const personal = await resolvePersonalEmail({ requestedTo: originalTo, recipientUserId: opts.recipientUserId })
    if (personal) {
      return {
        to: personal,
        rerouted: true,
        originalTo,
        reason: `${delivery} notification — redirected from business mailbox to personal email`,
        delivery,
      }
    }
    // No personal email known → block the send. The in-app notification
    // record (if any) is still there, so the user isn't left in the dark.
    return {
      to: null,
      rerouted: true,
      originalTo,
      reason: `${delivery} notification — no personal email on file; in-app only`,
      delivery,
    }
  }

  // Already a personal / external address — nothing to do.
  return { to: originalTo, rerouted: false, originalTo, reason: `${delivery} notification — already on personal email`, delivery }
}
