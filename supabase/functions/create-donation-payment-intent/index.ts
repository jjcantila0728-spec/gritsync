// Supabase Edge Function for creating Stripe payment intents for donations
// Supports anonymous donations (no authentication required)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

// Get Stripe secret key from environment
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY environment variable is not set')
}

const stripe = new Stripe(stripeSecretKey || '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    // Check for authorization header (optional for donations)
    const authHeader = req.headers.get('Authorization')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    // Determine if this is an authenticated request or anonymous
    // If authHeader contains the anon key, it's an anonymous request
    // If authHeader contains a user token (starts with Bearer and is not the anon key), it's authenticated
    const isAnonymousRequest = !authHeader || 
      (authHeader.startsWith('Bearer ') && authHeader.replace('Bearer ', '') === anonKey)
    
    // For anonymous requests (donations), use service role key to bypass RLS
    // For authenticated requests, use anon key with user's token
    const supabaseKey = isAnonymousRequest
      ? (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey)
      : anonKey
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseKey,
      !isAnonymousRequest && authHeader ? {
        global: {
          headers: { Authorization: authHeader },
        },
      } : {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authenticated user (optional for donations)
    let user = null
    if (!isAnonymousRequest && authHeader) {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabaseClient.auth.getUser()

      if (!userError && authUser) {
        user = authUser
      }
    }

    // Get request body
    let body: any = {}
    try {
      body = await req.json()
      console.log('Request body:', body)
    } catch (e) {
      console.error('Error parsing request body:', e)
      throw new Error('Invalid request body')
    }
    
    const { donation_id, amount } = body
    
    if (!donation_id) {
      throw new Error('donation_id is required')
    }

    console.log('Creating payment intent for donation:', { donation_id, amount })

    // Fetch donation (works for anonymous users via service role key)
    const { data: donationData, error: donationError } = await supabaseClient
      .from('donations')
      .select('*')
      .eq('id', donation_id)
      .single()

    if (donationError || !donationData) {
      throw new Error('Donation not found')
    }

    const donation = donationData
    
    // Calculate payment amount
    const paymentAmount = amount ? Math.round(amount) : Math.round(donation.amount * 100)
    
    // Validate amount
    if (!paymentAmount || paymentAmount <= 0) {
      throw new Error('Invalid donation amount. Amount must be greater than zero.')
    }

    // Ensure amount is at least $0.50 (50 cents) - Stripe minimum
    const minimumAmount = 50
    if (paymentAmount < minimumAmount) {
      throw new Error(`Minimum donation amount is $0.50. Your amount is $${(paymentAmount / 100).toFixed(2)}`)
    }

    // Validate Stripe secret key is set
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in the edge function environment variables.')
    }

    // Prepare metadata
    const metadata: Record<string, string> = {
      donation_id: donation_id,
    }
    
    if (user) {
      metadata.user_id = user.id
    }
    
    if (donation.sponsorship_id) {
      metadata.sponsorship_id = donation.sponsorship_id
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: 'usd',
      metadata,
      description: `Donation for NCLEX Sponsorship - ${donation_id}`,
    })

    // Update donation with payment intent ID
    await supabaseClient
      .from('donations')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', donation_id)

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Edge function error:', error)
    
    // Determine user-friendly error message and status code
    let errorMessage = 'An error occurred while processing your donation'
    let statusCode = 500
    let errorType = 'SERVER_ERROR'
    
    const errorMsg = error?.message?.toLowerCase() || ''
    
    // Validation errors
    if (errorMsg.includes('invalid') || errorMsg.includes('required') || errorMsg.includes('missing')) {
      errorMessage = error.message || 'Invalid donation request. Please check your donation details.'
      statusCode = 400
      errorType = 'VALIDATION_ERROR'
    }
    // Amount errors
    else if (errorMsg.includes('amount') || errorMsg.includes('minimum')) {
      errorMessage = error.message || 'Invalid donation amount. Please enter a valid amount (minimum $0.50).'
      statusCode = 400
      errorType = 'VALIDATION_ERROR'
    }
    // Not found errors
    else if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
      errorMessage = error.message || 'Donation not found. Please start over.'
      statusCode = 404
      errorType = 'NOT_FOUND'
    }
    // Stripe errors
    else if (errorMsg.includes('stripe') || error?.type?.startsWith('Stripe')) {
      // Extract user-friendly message from Stripe errors
      if (error?.message && error.message.length < 200) {
        errorMessage = `Payment processing error: ${error.message}`
      } else {
        errorMessage = 'Payment processing error. Please try again or contact support if the issue persists.'
      }
      statusCode = 400
      errorType = 'PAYMENT_ERROR'
    }
    // Configuration errors
    else if (errorMsg.includes('configuration') || errorMsg.includes('environment') || errorMsg.includes('key')) {
      errorMessage = 'Payment system configuration error. Please contact support.'
      statusCode = 500
      errorType = 'CONFIG_ERROR'
    }
    // Use the error message if it's user-friendly
    else if (error?.message && error.message.length < 200 && !error.message.includes('at ') && !error.message.includes('Error:')) {
      errorMessage = error.message
      statusCode = error?.status || 400
    }
    
    // Don't expose stack traces or internal details in production
    const responseBody: any = {
      error: errorMessage,
      type: errorType,
    }
    
    // Only include details in development
    if (Deno.env.get('ENVIRONMENT') === 'development' || Deno.env.get('DENO_ENV') === 'development') {
      responseBody.details = error?.stack || error
    }
    
    return new Response(
      JSON.stringify(responseBody),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
        },
        status: statusCode,
      }
    )
  }
})

