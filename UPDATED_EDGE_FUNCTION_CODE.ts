// Supabase Edge Function for creating Stripe payment intents
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

    // Get payment details - can be either application_payment, quotation, or donation
    let body: any = {}
    try {
      body = await req.json()
      console.log('Request body:', body)
    } catch (e) {
      console.error('Error parsing request body:', e)
      throw new Error('Invalid request body')
    }
    const { payment_id, quotation_id, donation_id, amount } = body
    
    console.log('Extracted params:', { payment_id, quotation_id, donation_id, amount })

    let paymentAmount: number
    let metadata: Record<string, string> = {}
    if (user) {
      metadata.user_id = user.id
    }

    if (donation_id) {
      // Handle donation payment (can be anonymous, so user might be null)
      const { data: donation, error: donationError } = await supabaseClient
        .from('donations')
        .select('*')
        .eq('id', donation_id)
        .single()

      if (donationError || !donation) {
        throw new Error('Donation not found')
      }

      paymentAmount = amount ? Math.round(amount) : Math.round(donation.amount * 100)
      metadata.donation_id = donation_id
      if (donation.sponsorship_id) {
        metadata.sponsorship_id = donation.sponsorship_id
      }
    } else if (quotation_id) {
      // Require authentication for quotations
      if (!user) {
        throw new Error('Authentication required for quotation payments')
      }
      // Handle quotation payment
      const { data: quotation, error: quotationError } = await supabaseClient
        .from('quotations')
        .select('*')
        .eq('id', quotation_id)
        .single()

      if (quotationError || !quotation) {
        throw new Error('Quotation not found')
      }

      paymentAmount = amount ? Math.round(amount) : Math.round(quotation.amount * 100)
      metadata.quotation_id = quotation_id
    } else if (payment_id) {
      // Require authentication for application payments
      if (!user) {
        throw new Error('Authentication required for application payments')
      }
      // Handle application payment
      console.log('Looking for payment:', payment_id, 'for user:', user.id)
      const { data: payment, error: paymentError } = await supabaseClient
        .from('application_payments')
        .select('*, applications(*)')
        .eq('id', payment_id)
        .eq('user_id', user.id)
        .single()

      if (paymentError) {
        console.error('Payment query error:', paymentError)
        throw new Error(`Payment not found: ${paymentError.message}`)
      }

      if (!payment) {
        console.error('Payment not found for ID:', payment_id)
        throw new Error('Payment not found or you do not have access to it')
      }

      console.log('Payment found:', { id: payment.id, amount: payment.amount, status: payment.status })
      
      if (!payment.amount || payment.amount <= 0) {
        throw new Error('Invalid payment amount')
      }

      paymentAmount = Math.round(payment.amount * 100)
      metadata.payment_id = payment_id
      metadata.application_id = payment.application_id
    } else {
      throw new Error('Either payment_id, quotation_id, or donation_id is required')
    }

    // Validate Stripe secret key is set
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in the edge function environment variables.')
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: 'usd',
      metadata,
    })

    // Update record with intent ID
    if (donation_id) {
      await supabaseClient
        .from('donations')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('id', donation_id)
    } else if (quotation_id) {
      await supabaseClient
        .from('quotations')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('id', quotation_id)
    } else if (payment_id) {
      await supabaseClient
        .from('application_payments')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('id', payment_id)
    }

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
    const errorMessage = error?.message || 'An error occurred while creating payment intent'
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error?.stack || error
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
        },
        status: error?.status || 400,
      }
    )
  }
})

