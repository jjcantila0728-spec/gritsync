import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const anonKey = process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[supabase] FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
}

/**
 * Server-side admin client — bypasses RLS.
 * Use only in server routes, never expose to the frontend.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

/**
 * Anon client — respects RLS.
 * Useful for operations that should be bound by row-level security.
 */
export const supabaseAnon = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export default supabaseAdmin
