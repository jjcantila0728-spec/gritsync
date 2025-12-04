import Stripe from 'stripe'
import { getSupabaseAdmin } from '../db/supabase.js'

// Initialize Stripe - will be set after database is initialized
let stripe = null

// Function to initialize Stripe from environment or database
export async function initializeStripe() {
  // First check environment variable
  let secretKey = process.env.STRIPE_SECRET_KEY
  
  // If not in env, check database settings
  if (!secretKey) {
    try {
      const supabase = getSupabaseAdmin()
      const { data: setting, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'stripeSecretKey')
        .single()
      
      if (!error && setting && setting.value) {
        secretKey = setting.value
        // Also set it in process.env for current session
        process.env.STRIPE_SECRET_KEY = secretKey
      }
    } catch (error) {
      // Database might not be initialized yet, that's okay
      console.log('Database not ready for Stripe key lookup, will use env vars only')
    }
  }
  
  if (secretKey) {
    stripe = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia',
    })
    console.log('✅ Stripe initialized successfully')
  } else {
    console.log('⚠️  Stripe not configured - STRIPE_SECRET_KEY not found in env or database')
  }
}

// Get Stripe instance
export function getStripe() {
  return stripe
}

// Re-initialize Stripe (useful when settings are updated)
export async function reinitializeStripe() {
  await initializeStripe()
}


