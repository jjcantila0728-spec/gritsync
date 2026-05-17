/**
 * Server-side Expo push notification fan-out.
 *
 * Flow:
 *   1. Some part of the server inserts into the `notifications` table.
 *   2. That code calls `pushNotifyUser(userId, ...)` which loads the user's
 *      Expo push token from `users.push_token` and queues an Expo push send.
 *   3. We send in chunks of 100 (Expo SDK's recommended batch size), collect
 *      tickets, then later poll for receipts and prune any token that came
 *      back `DeviceNotRegistered` (user uninstalled the app, swapped phones,
 *      etc.).
 *
 * Requires the `users.push_token` column added by
 * scripts/migrations/2026-05-16_users_push_token.sql.
 *
 * Auth: no Expo access token is needed for sends — the Expo push service
 * is unauthenticated. If you ever ship an EAS-protected project, set
 * EXPO_ACCESS_TOKEN in env and Expo() picks it up automatically.
 */

import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk'
import { query } from '../db'

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN, useFcmV1: true })

export interface PushPayload {
  title: string
  body: string
  /** Routed by the mobile app's notification listener — common shapes:
   *  { type: 'application', applicationId: '...' }
   *  { type: 'message',     userId:  '...' }
   *  { type: 'notification' }
   *  { type: 'system',      url: 'gritsync://...' }                          */
  data?: Record<string, unknown>
  /** Custom badge count to set on the app icon (iOS / some Android skins).
   *  Defaults to incrementing the unread-notifications count on the device.  */
  badge?: number
  /** Override the default short channel id ('default') on Android.            */
  channelId?: string
  /** When set, the push surface is downgraded to a silent background update.
   *  Useful for cache invalidation; the app won't show a banner.              */
  silent?: boolean
}

/** Fetch a user's push token. Returns null if none registered. */
async function getUserToken(userId: string): Promise<string | null> {
  const r = await query<{ push_token: string | null }>(
    `SELECT push_token FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  )
  const token = r.rows[0]?.push_token
  if (!token || !Expo.isExpoPushToken(token)) return null
  return token
}

/** Drop a token from a user row (called when Expo returns DeviceNotRegistered). */
async function clearUserToken(token: string): Promise<void> {
  await query(`UPDATE users SET push_token = NULL WHERE push_token = $1`, [token]).catch((e) => {
    console.error('[push] clearUserToken failed', e)
  })
}

/**
 * Send to a single user. Returns the ticket so callers can decide whether
 * to await receipt polling (most won't — fire and forget is fine).
 */
export async function pushNotifyUser(userId: string, payload: PushPayload): Promise<ExpoPushTicket | null> {
  const token = await getUserToken(userId)
  if (!token) return null
  return pushSendOne(buildMessage(token, payload))
}

/** Send to many users. Dedupes by token, chunks at 100, ignores users w/o tokens. */
export async function pushNotifyUsers(userIds: string[], payload: PushPayload): Promise<ExpoPushTicket[]> {
  if (userIds.length === 0) return []
  const uniqueIds = Array.from(new Set(userIds))
  const r = await query<{ push_token: string | null }>(
    `SELECT push_token FROM users
      WHERE id = ANY($1::text[]) AND push_token IS NOT NULL`,
    [uniqueIds],
  )
  const tokens = r.rows
    .map((row) => row.push_token!)
    .filter((t) => Expo.isExpoPushToken(t))
  if (tokens.length === 0) return []

  const messages: ExpoPushMessage[] = tokens.map((t) => buildMessage(t, payload))
  return pushSendMany(messages)
}

function buildMessage(to: string, payload: PushPayload): ExpoPushMessage {
  const msg: ExpoPushMessage = {
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: payload.silent ? null : 'default',
    priority: payload.silent ? 'normal' : 'high',
    channelId: payload.channelId ?? 'default',
  }
  if (typeof payload.badge === 'number') {
    msg.badge = payload.badge
  }
  return msg
}

async function pushSendOne(message: ExpoPushMessage): Promise<ExpoPushTicket | null> {
  try {
    const [ticket] = await expo.sendPushNotificationsAsync([message])
    void handleTicketImmediate(ticket, [message.to as string])
    return ticket ?? null
  } catch (err) {
    console.error('[push] sendOne failed', err)
    return null
  }
}

async function pushSendMany(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const chunks = expo.chunkPushNotifications(messages)
  const tickets: ExpoPushTicket[] = []
  const tokensForIndex: string[] = []
  for (const chunk of chunks) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk)
      chunk.forEach((m, i) => {
        tickets.push(chunkTickets[i])
        tokensForIndex.push(m.to as string)
      })
    } catch (err) {
      console.error('[push] chunk send failed', err)
    }
  }
  // Handle synchronous errors (bad token, etc) right away. Async receipts
  // are polled separately by pollPushReceipts (a cron entry).
  void handleTicketBatch(tickets, tokensForIndex)
  return tickets
}

/**
 * For tickets returned synchronously: anything with status='error' and
 * details.error='DeviceNotRegistered' means the token is dead — drop it.
 */
async function handleTicketImmediate(ticket: ExpoPushTicket | undefined, tokens: string[]): Promise<void> {
  if (!ticket) return
  if (ticket.status === 'error') {
    const code = (ticket as any).details?.error
    if (code === 'DeviceNotRegistered') {
      await Promise.all(tokens.map((t) => clearUserToken(t)))
    } else {
      console.error('[push] ticket error', ticket)
    }
  }
}

async function handleTicketBatch(tickets: ExpoPushTicket[], tokens: string[]): Promise<void> {
  await Promise.all(
    tickets.map((t, i) =>
      t?.status === 'error' && (t as any).details?.error === 'DeviceNotRegistered'
        ? clearUserToken(tokens[i])
        : Promise.resolve(),
    ),
  )
}

/**
 * Poll Expo for receipts on tickets older than ~15 minutes. Call this from
 * a cron / setInterval (currently invoked from server/index.ts every 5 min
 * alongside processDuePosts).
 *
 * In a real production deploy you'd persist ticket ids to a table; for now
 * the simplest version polls receipts for tickets we still hold in memory.
 * If you need durable receipt polling, wire it to a `push_tickets` table.
 */
const pendingTicketIds = new Set<string>()
const ticketToToken = new Map<string, string>()

/** Track a ticket id for later receipt polling. */
export function trackTicketForReceipt(ticket: ExpoPushTicket, token: string): void {
  if (ticket && ticket.status === 'ok' && (ticket as any).id) {
    pendingTicketIds.add((ticket as any).id as string)
    ticketToToken.set((ticket as any).id as string, token)
  }
}

/**
 * Drop push tokens that haven't been refreshed in over `staleDays` days.
 * The mobile app re-writes the token on every cold start (see
 * mobile/src/lib/push.ts → `register()`), so a token whose
 * `push_token_updated_at` is months old almost certainly belongs to a
 * device that's no longer running the app. Clearing it keeps our Expo
 * send volume honest and avoids hitting DeviceNotRegistered receipts
 * over and over.
 *
 * Called from server/index.ts on a daily-ish cron interval.
 */
export async function pruneStalePushTokens(staleDays = 90): Promise<number> {
  try {
    const r = await query(
      `UPDATE users
          SET push_token = NULL,
              push_platform = NULL
        WHERE push_token IS NOT NULL
          AND push_token_updated_at IS NOT NULL
          AND push_token_updated_at < NOW() - ($1 || ' days')::INTERVAL
        RETURNING id`,
      [String(staleDays)],
    )
    const cleared = r.rowCount ?? 0
    if (cleared > 0) {
      console.log(`[push] pruned ${cleared} stale push tokens (>${staleDays} days idle)`)
    }
    return cleared
  } catch (err) {
    console.error('[push] pruneStalePushTokens failed', err)
    return 0
  }
}

export async function pollPushReceipts(): Promise<void> {
  if (pendingTicketIds.size === 0) return
  const ids = Array.from(pendingTicketIds)
  pendingTicketIds.clear()
  const chunks = expo.chunkPushNotificationReceiptIds(ids)
  for (const chunk of chunks) {
    try {
      const receipts: Record<string, ExpoPushReceipt> = await expo.getPushNotificationReceiptsAsync(chunk)
      for (const [id, r] of Object.entries(receipts)) {
        if (r.status === 'error') {
          const code = (r as any).details?.error
          if (code === 'DeviceNotRegistered') {
            const tok = ticketToToken.get(id)
            if (tok) await clearUserToken(tok)
          } else {
            console.error('[push] receipt error', id, r)
          }
        }
        ticketToToken.delete(id)
      }
    } catch (err) {
      console.error('[push] receipt poll failed', err)
    }
  }
}
