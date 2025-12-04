import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Realtime subscription helpers
export function subscribeToNotifications(
  userId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe()
}

export function subscribeToApplicationUpdates(
  applicationId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`application:${applicationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'applications',
        filter: `id=eq.${applicationId}`,
      },
      callback
    )
    .subscribe()
}

export function subscribeToUserApplications(
  userId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`user_applications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'applications',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe()
}

export function subscribeToQuotations(
  userId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`quotations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'quotations',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe()
}

// Subscribe to all applications (for admin dashboard)
export function subscribeToAllApplications(
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel('all_applications')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'applications',
      },
      callback
    )
    .subscribe()
}

// Subscribe to all quotations (for admin dashboard)
export function subscribeToAllQuotations(
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel('all_quotations')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'quotations',
      },
      callback
    )
    .subscribe()
}

// Subscribe to pending approval payments (for admin dashboard)
export function subscribeToPendingApprovalPayments(
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel('pending_approval_payments')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'application_payments',
        filter: 'status=eq.pending_approval',
      },
      callback
    )
    .subscribe()
}

// Subscribe to all clients (for admin clients page)
export function subscribeToAllClients(
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel('all_clients')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: 'role=eq.client',
      },
      callback
    )
    .subscribe()
}

// Subscribe to timeline steps for a specific application
export function subscribeToApplicationTimelineSteps(
  applicationId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`timeline_steps:${applicationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'application_timeline_steps',
        filter: `application_id=eq.${applicationId}`,
      },
      callback
    )
    .subscribe()
}

// Subscribe to payments for a specific application
export function subscribeToApplicationPayments(
  applicationId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`application_payments:${applicationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'application_payments',
        filter: `application_id=eq.${applicationId}`,
      },
      callback
    )
    .subscribe()
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel)
}

