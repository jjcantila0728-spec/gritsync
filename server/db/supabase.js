import { createClient } from '@supabase/supabase-js'

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Supabase URL not configured. Please set VITE_SUPABASE_URL or SUPABASE_URL environment variable.')
}

if (!supabaseServiceKey && !supabaseAnonKey) {
  throw new Error('Supabase key not configured. Please set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY environment variable.')
}

// Create Supabase admin client (uses service role key for full database access)
export function getSupabaseAdmin() {
  if (!supabaseServiceKey) {
    throw new Error('Supabase service role key not configured. Required for admin operations.')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Create Supabase client with anon key (for public operations)
export function getSupabaseClient() {
  const key = supabaseServiceKey || supabaseAnonKey
  if (!key) {
    throw new Error('Supabase key not configured')
  }
  
  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Default export - returns admin client for backward compatibility
export default getSupabaseAdmin()


