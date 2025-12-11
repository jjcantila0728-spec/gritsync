// Supabase Edge Function for creating Stripe payment intents for application payments
// Requires authentication (applications are user-specific)
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
    // Allow both authenticated and public access for application payments
    // (Public access is needed for shared checkout links)
    const authHeader = req.headers.get('Authorization')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    let supabaseClient
    let user: any = null
    let isPublicAccess = false
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const isAnonymousRequest = authHeader.replace('Bearer ', '') === anonKey
      
      if (!isAnonymousRequest) {
        // Try to get authenticated user
        supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          anonKey,
          {
            global: {
              headers: { Authorization: authHeader },
            },
          }
        )

        const {
          data: { user: authUser },
          error: userError,
        } = await supabaseClient.auth.getUser()

        if (!userError && authUser) {
          user = authUser
          console.log('Authenticated user:', user.id)
        } else {
          console.log('Invalid auth token, treating as public access')
          isPublicAccess = true
        }
      } else {
        isPublicAccess = true
      }
    } else {
      isPublicAccess = true
    }
    
    // Create supabase client for public access if needed
    if (isPublicAccess || !supabaseClient) {
      console.log('Using public access for payment intent')
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        anonKey
      )
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
    
    const { payment_id } = body
    
    if (!payment_id) {
      throw new Error('payment_id is required')
    }

    console.log('Creating payment intent for application payment:', { payment_id, user_id: user?.id || 'public', isPublicAccess })

    // Fetch application payment
    let query = supabaseClient
      .from('application_payments')
      .select('*, applications(*)')
      .eq('id', payment_id)
    
    // Only filter by user_id if authenticated
    if (user && !isPublicAccess) {
      query = query.eq('user_id', user.id)
    }
    
    const { data: payment, error: paymentError } = await query.single()

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

    // Calculate payment amount in cents
    const paymentAmount = Math.round(payment.amount * 100)

    // Validate Stripe secret key is set
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in the edge function environment variables.')
    }

    // Prepare metadata
    const metadata: Record<string, string> = {
      payment_id: payment_id,
      application_id: payment.application_id,
      user_id: user?.id || payment.user_id || 'public',
      access_type: isPublicAccess ? 'public' : 'authenticated',
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: 'usd',
      metadata,
      description: `Application Payment - Payment ${payment_id}`,
    })

    // Update payment record with payment intent ID
    await supabaseClient
      .from('application_payments')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', payment_id)

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
    let errorMessage = 'An error occurred while processing your payment'
    let statusCode = 500
    let errorType = 'SERVER_ERROR'
    
    const errorMsg = error?.message?.toLowerCase() || ''
    
    // Authentication errors
    if (errorMsg.includes('auth') || errorMsg.includes('unauthorized') || errorMsg.includes('authentication')) {
      errorMessage = error.message || 'Authentication required. Please log in and try again.'
      statusCode = 401
      errorType = 'AUTH_ERROR'
    }
    // Validation errors
    else if (errorMsg.includes('invalid') || errorMsg.includes('required') || errorMsg.includes('missing')) {
      errorMessage = error.message || 'Invalid payment request. Please check your payment details.'
      statusCode = 400
      errorType = 'VALIDATION_ERROR'
    }
    // Not found errors
    else if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
      errorMessage = error.message || 'Payment not found. Please try again.'
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

