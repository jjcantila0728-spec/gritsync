/**
 * Optimized real-time subscription helpers
 * Combines multiple subscriptions into single channels where possible
 * Reduces connection overhead and improves performance
 * 
 * IMPORTANT: Each component should create its own channel instance.
 * Channels are not reused across components to prevent subscription conflicts.
 */

import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Subscribe to multiple events on a single channel (optimized)
 * This reduces connection overhead by using one WebSocket connection for multiple subscriptions
 * 
 * @param channelName - Unique channel name (should be unique per component instance)
 * @param subscriptions - Array of subscription configurations
 * @returns The subscribed RealtimeChannel (must be cleaned up with unsubscribe())
 */
export function subscribeToMultipleEvents(
  channelName: string,
  subscriptions: Array<{
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
    schema: string
    table: string
    filter?: string
    callback: (payload: any) => void
  }>
): RealtimeChannel {
  // Create a new channel instance (don't reuse - each component needs its own)
  const channel = supabase.channel(channelName)
  
  // Add all subscriptions to the same channel
  // This reduces connection overhead by using one WebSocket connection
  subscriptions.forEach(({ event, schema, table, filter, callback }) => {
    channel.on(
      'postgres_changes',
      {
        event,
        schema,
        table,
        ...(filter && { filter }),
      },
      callback
    )
  })
  
  // Subscribe once for all events on this channel
  channel.subscribe()
  
  // Track channel subscription for monitoring
  try {
    const { trackChannelSubscribed } = require('./connection-monitor')
    trackChannelSubscribed()
  } catch {
    // Silently fail if monitoring is not available
  }
  
  return channel
}

/**
 * Optimized: Subscribe to applications and quotations in a single channel (for admin dashboard)
 */
export function subscribeToAdminDashboard(
  callbacks: {
    onApplicationUpdate: (payload: any) => void
    onQuotationUpdate: (payload: any) => void
    onPaymentUpdate: (payload: any) => void
  }
): RealtimeChannel {
  return subscribeToMultipleEvents('admin_dashboard', [
    {
      event: '*',
      schema: 'public',
      table: 'applications',
      callback: callbacks.onApplicationUpdate,
    },
    {
      event: '*',
      schema: 'public',
      table: 'quotations',
      callback: callbacks.onQuotationUpdate,
    },
    {
      event: '*',
      schema: 'public',
      table: 'application_payments',
      filter: 'status=eq.pending_approval',
      callback: callbacks.onPaymentUpdate,
    },
  ])
}

/**
 * Optimized: Subscribe to user's applications and quotations in a single channel (for client dashboard)
 */
export function subscribeToClientDashboard(
  userId: string,
  callbacks: {
    onApplicationUpdate: (payload: any) => void
    onQuotationUpdate: (payload: any) => void
  }
): RealtimeChannel {
  return subscribeToMultipleEvents(`client_dashboard:${userId}`, [
    {
      event: '*',
      schema: 'public',
      table: 'applications',
      filter: `user_id=eq.${userId}`,
      callback: callbacks.onApplicationUpdate,
    },
    {
      event: '*',
      schema: 'public',
      table: 'quotations',
      filter: `user_id=eq.${userId}`,
      callback: callbacks.onQuotationUpdate,
    },
  ])
}

/**
 * Optimized: Subscribe to application detail updates (application + timeline + payments)
 */
export function subscribeToApplicationDetail(
  applicationId: string,
  callbacks: {
    onApplicationUpdate: (payload: any) => void
    onTimelineUpdate: (payload: any) => void
    onPaymentUpdate: (payload: any) => void
  }
): RealtimeChannel {
  return subscribeToMultipleEvents(`application_detail:${applicationId}`, [
    {
      event: '*',
      schema: 'public',
      table: 'applications',
      filter: `id=eq.${applicationId}`,
      callback: callbacks.onApplicationUpdate,
    },
    {
      event: '*',
      schema: 'public',
      table: 'application_timeline_steps',
      filter: `application_id=eq.${applicationId}`,
      callback: callbacks.onTimelineUpdate,
    },
    {
      event: '*',
      schema: 'public',
      table: 'application_payments',
      filter: `application_id=eq.${applicationId}`,
      callback: callbacks.onPaymentUpdate,
    },
  ])
}

/**
 * Cleanup and remove channel
 * Always call this in useEffect cleanup to prevent memory leaks and connection buildup
 * 
 * @param channel - The RealtimeChannel to unsubscribe and remove
 */
export function unsubscribe(channel: RealtimeChannel): void {
  if (channel) {
    // Unsubscribe from the channel
    channel.unsubscribe()
    // Remove the channel from Supabase client
    supabase.removeChannel(channel)
    
    // Track channel unsubscription for monitoring
    try {
      const { trackChannelUnsubscribed } = require('./connection-monitor')
      trackChannelUnsubscribed()
    } catch {
      // Silently fail if monitoring is not available
    }
  }
}

/**
 * Cleanup helper for arrays of channels
 * Useful when cleaning up multiple subscriptions at once
 * 
 * @param channels - Array of RealtimeChannels to cleanup
 */
export function unsubscribeAll(channels: RealtimeChannel[]): void {
  channels.forEach(channel => unsubscribe(channel))
}


