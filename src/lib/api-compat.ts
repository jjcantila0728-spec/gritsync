// Local type definitions replacing @supabase/supabase-js
// Vite alias redirects all `@supabase/supabase-js` imports here

export interface Session {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  user: AuthUser
}

export interface AuthUser {
  id: string
  email?: string
  role?: string
  user_metadata?: Record<string, any>
  app_metadata?: Record<string, any>
  created_at?: string
}

export interface RealtimeChannel {
  on: (...args: any[]) => RealtimeChannel
  subscribe: (...args: any[]) => { unsubscribe: () => void }
  unsubscribe?: () => void
}

export interface SupabaseClient {
  from: (table: string) => any
  auth: any
  storage: any
  channel: (name: string) => RealtimeChannel
  removeChannel: (channel: RealtimeChannel) => void
  removeAllChannels: () => void
}

// Stub createClient for files that call it directly
export function createClient(_url: string, _key: string, _opts?: any): SupabaseClient {
  // Lazy import to avoid circular deps
  return {
    from: (_t: string) => ({}),
    auth: {},
    storage: { from: (_b: string) => ({}) },
    channel: (_n: string) => ({ on: () => ({} as any), subscribe: () => ({ unsubscribe: () => {} }) }),
    removeChannel: () => {},
    removeAllChannels: () => {},
  }
}
