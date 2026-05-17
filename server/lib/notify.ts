/**
 * Unified notification helper.
 *
 * Every place that wants to notify a user about something (status change,
 * new message, payment receipt, advisor note, etc.) should call
 * `notifyUser(...)` — it:
 *
 *   1. INSERTs into the `notifications` table (so the in-app notifications
 *      screen and the unread-count badge stay correct).
 *   2. Fires a mobile push via `server/lib/push.ts` when the user has a
 *      registered Expo push token. Push failures never block the insert.
 *
 * This is a thin wrapper, not a replacement — callers who only need to
 * write to the table (e.g. backfills, internal-only events) can still
 * INSERT directly. But anything user-facing should use this helper.
 */

import { query } from '../db'
import { pushNotifyUser, pushNotifyUsers, type PushPayload } from './push'

export interface NotifyInput {
  userId: string
  /** Short headline (40-80 chars). */
  title: string
  /** Body shown in the in-app feed and the push banner (longer is fine). */
  message: string
  /** One of: 'application' | 'document' | 'payment' | 'message' | 'system' |
   *  'announcement'. Drives the icon shown in the mobile notifications screen
   *  and is the default routing key for deep links. */
  type?: string
  /** Optional URL or deep-link path. The mobile app's notification listener
   *  uses this to route the tap. Web links open in the in-app browser. */
  link?: string | null
  /** Inserted as-is into the notifications row's `data` column for callers
   *  who want to attach structured context (e.g. { applicationId }). */
  data?: Record<string, unknown> | null
  /** Set to false to skip the push notification (in-app only). Default true. */
  push?: boolean
  /** Override the push payload (e.g. shorter title for the banner). */
  pushOverride?: Partial<PushPayload>
}

export interface NotifyManyInput extends Omit<NotifyInput, 'userId'> {
  userIds: string[]
}

/** INSERT + push for a single user.
 *
 *  Column names match the live schema (see
 *  scripts/migrations/2026-05-15_notifications_align_with_app.sql):
 *    - `read` (renamed from is_read)
 *    - `message` (renamed from body)
 *    - `extra` jsonb (NOT `data`)
 *    - optional `application_id` foreign-key column when the row relates to
 *      a specific application — payments.ts / questions.ts set this so the
 *      web header can deep-link from the notifications dropdown.            */
export async function notifyUser(input: NotifyInput): Promise<{ notificationId: string | null }> {
  const insertRes = await query<{ id: string }>(
    `INSERT INTO notifications (user_id, application_id, title, message, type, link, extra, read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, false, NOW())
     RETURNING id`,
    [
      input.userId,
      (input.data as any)?.applicationId ?? (input.data as any)?.application_id ?? null,
      input.title,
      input.message,
      input.type ?? 'system',
      input.link ?? null,
      input.data ? JSON.stringify(input.data) : null,
    ],
  ).catch((err) => {
    console.error('[notify] insert failed', err)
    return null
  })

  const notificationId = insertRes?.rows[0]?.id ?? null

  if (input.push !== false) {
    void pushNotifyUser(input.userId, {
      title: input.pushOverride?.title ?? input.title,
      body: input.pushOverride?.body ?? input.message,
      data: {
        type: input.type ?? 'system',
        link: input.link ?? null,
        notificationId,
        ...(input.data ?? {}),
        ...(input.pushOverride?.data ?? {}),
      },
      ...(input.pushOverride?.badge != null ? { badge: input.pushOverride.badge } : {}),
    })
  }

  return { notificationId }
}

/** INSERT + push for a bulk audience. Use sparingly — broadcasts go through
 *  `notifyMany` and the push fan-out is batched in chunks of 100. */
export async function notifyMany(input: NotifyManyInput): Promise<void> {
  if (input.userIds.length === 0) return
  const applicationId =
    (input.data as any)?.applicationId ?? (input.data as any)?.application_id ?? null

  await query(
    `INSERT INTO notifications (user_id, application_id, title, message, type, link, extra, read, created_at)
     SELECT u, $2, $3, $4, $5, $6, $7::jsonb, false, NOW()
     FROM UNNEST($1::text[]) AS u`,
    [
      input.userIds,
      applicationId,
      input.title,
      input.message,
      input.type ?? 'system',
      input.link ?? null,
      input.data ? JSON.stringify(input.data) : null,
    ],
  ).catch((err) => {
    console.error('[notify] bulk insert failed', err)
  })

  if (input.push !== false) {
    void pushNotifyUsers(input.userIds, {
      title: input.pushOverride?.title ?? input.title,
      body: input.pushOverride?.body ?? input.message,
      data: {
        type: input.type ?? 'system',
        link: input.link ?? null,
        ...(input.data ?? {}),
        ...(input.pushOverride?.data ?? {}),
      },
    })
  }
}
