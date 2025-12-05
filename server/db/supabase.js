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

// Optimized client configuration for production
const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  // Optimize for production
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'gritsync-server'
    }
  }
}

// Singleton instances for connection reuse
let adminClient = null
let anonClient = null

// Create Supabase admin client (uses service role key for full database access)
// Uses singleton pattern to reuse connections
export function getSupabaseAdmin() {
  if (!supabaseServiceKey) {
    throw new Error('Supabase service role key not configured. Required for admin operations.')
  }
  
  // Reuse existing client if available
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceKey, clientOptions)
  }
  
  return adminClient
}

// Create Supabase client with anon key (for public operations)
// Uses singleton pattern to reuse connections
export function getSupabaseClient() {
  const key = supabaseServiceKey || supabaseAnonKey
  if (!key) {
    throw new Error('Supabase key not configured')
  }
  
  // Reuse existing client if available
  if (!anonClient) {
    anonClient = createClient(supabaseUrl, key, clientOptions)
  }
  
  return anonClient
}

// Reset clients (useful for testing or reconnection)
export function resetClients() {
  adminClient = null
  anonClient = null
}

// Default export - returns admin client for backward compatibility
export default getSupabaseAdmin()


