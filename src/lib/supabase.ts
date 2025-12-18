import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

// Create Supabase client - 100% Supabase, no fallback
// SINGLETON: Only create one instance to prevent connection pool exhaustion
// Note: Using SupabaseClient<any> temporarily due to outdated database.types.ts
// TODO: Regenerate database.types.ts with `supabase gen types typescript` to restore strict typing
// Note: If you see "Multiple GoTrueClient instances detected" warning in development,
// this is likely due to React Strict Mode mounting components twice. This is harmless
// and only occurs in development. The singleton pattern ensures only one instance exists.
export const supabase: SupabaseClient<any> = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true, // Automatically refresh expired tokens
    persistSession: true, // Persist session in localStorage
    detectSessionInUrl: true, // Detect auth session from URL (OAuth redirects)
    // Refresh token before it expires (default is 3600s, refresh at 3300s)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'X-Client-Info': 'gritsync-web',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },
  // Realtime configuration
  realtime: {
    // Maximum number of channels per connection (default: 100)
    // Reducing this prevents connection overload
    params: {
      eventsPerSecond: 10, // Limit events per second to prevent overload
    },
  },
  // Database configuration
  db: {
    schema: 'public',
  },
})

// Re-export error handling utilities
export { 
  handleSupabaseError, 
  normalizeError, 
  getUserFriendlyMessage,
  classifyError,
  type AppError,
  ErrorType,
  ErrorSeverity
} from './error-handler'

