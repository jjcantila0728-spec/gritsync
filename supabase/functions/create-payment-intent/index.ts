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

    let donation: any = null
    if (donation_id) {
      // Handle donation payment (can be anonymous, so user might be null)
      const { data: donationData, error: donationError } = await supabaseClient
        .from('donations')
        .select('*')
        .eq('id', donation_id)
        .single()

      if (donationError || !donationData) {
        throw new Error('Donation not found')
      }

      donation = donationData
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

    // Get frontend URL for return URLs
    // Try to get from environment, or construct from request origin
    const requestOrigin = req.headers.get('origin') || ''
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 
                       Deno.env.get('VITE_FRONTEND_URL') ||
                       (requestOrigin ? new URL(requestOrigin).origin : 'http://localhost:5000')
    // Only use checkout if explicitly requested (for backward compatibility)
    // Otherwise, use payment intent for custom checkout pages
    const useCheckout = body.use_checkout === true

    if (donation_id && useCheckout) {
      // For donations, use Stripe Checkout (native checkout page)
      // Donation is already fetched above, reuse it
      if (!donation) {
        throw new Error('Donation data not available')
      }

      // Validate amount
      if (!paymentAmount || paymentAmount <= 0) {
        throw new Error('Invalid donation amount. Amount must be greater than zero.')
      }

      // Ensure amount is at least $0.50 (50 cents) - Stripe minimum
      const minimumAmount = 50
      if (paymentAmount < minimumAmount) {
        throw new Error(`Minimum donation amount is $0.50. Your amount is $${(paymentAmount / 100).toFixed(2)}`)
      }

      // Prepare product description (Stripe has a 500 character limit)
      const baseDescription = 'Support aspiring nurses achieve their USRN dreams through NCLEX sponsorship'
      let productDescription = baseDescription
      if (donation.message && donation.message.trim()) {
        // Truncate message if too long, keeping base description
        const maxMessageLength = 400 // Leave room for base description
        const truncatedMessage = donation.message.length > maxMessageLength 
          ? donation.message.substring(0, maxMessageLength) + '...'
          : donation.message
        productDescription = `${truncatedMessage} - ${baseDescription}`
      }

      // Ensure frontend URL is valid
      let validFrontendUrl = frontendUrl
      try {
        new URL(frontendUrl) // Validate URL
      } catch {
        // If invalid, use a default
        validFrontendUrl = 'http://localhost:5000'
        console.warn('Invalid frontend URL, using default:', validFrontendUrl)
      }

      // Get logo URL if available (you can set this in environment variables)
      const logoUrl = Deno.env.get('STRIPE_CHECKOUT_LOGO_URL') || undefined
      
      // Create Stripe Checkout Session with enhanced configuration and appearance
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'], // Credit card and Apple Pay (Apple Pay works automatically on supported devices)
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'NCLEX Sponsorship Donation',
                description: productDescription,
                images: logoUrl ? [logoUrl] : [], // Add logo if available
              },
              unit_amount: paymentAmount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${validFrontendUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}&donation_id=${donation_id}`,
        cancel_url: `${validFrontendUrl}/donate?canceled=true`,
        locale: 'en', // Explicitly set locale to English to prevent module loading errors
        ui_mode: 'hosted', // Use hosted checkout (responsive by default)
        metadata: {
          donation_id: donation_id,
          ...metadata,
        },
        // Pre-fill email if available (from donation form) to save user from typing it
        // Note: Stripe Checkout requires email for payment receipts, so we pre-fill it when available
        // If anonymous and no email provided, Stripe will still ask for email (required by Stripe)
        customer_email: donation?.donor_email || undefined,
        allow_promotion_codes: true,
        // Don't collect billing address - only need card info
        billing_address_collection: 'never',
        // Don't require name - we already have it from donation form if not anonymous
        // Stripe will still show email field but it's optional
        submit_type: 'donate', // Shows "Donate" button instead of "Pay"
        payment_intent_data: {
          description: `Donation for NCLEX Sponsorship - ${donation_id}`,
          metadata: {
            donation_id: donation_id,
            ...metadata,
          },
        },
        // Enhanced appearance customization
        appearance: {
          theme: 'stripe', // Options: 'stripe', 'night', 'flat'
          variables: {
            colorPrimary: '#2563eb', // Primary brand color (blue)
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
          rules: {
            '.Input': {
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            },
            '.Input:focus': {
              borderColor: '#2563eb',
              boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
            },
            '.Tab': {
              borderRadius: '8px',
            },
            '.Tab--selected': {
              backgroundColor: '#2563eb',
              color: '#ffffff',
            },
          },
        },
        // Enhanced UI options
        custom_text: {
          submit: {
            message: 'Thank you for supporting nurses!',
          },
        },
        // Additional options to prevent errors
        automatic_tax: {
          enabled: false, // Disable automatic tax calculation
        },
        phone_number_collection: {
          enabled: false, // Disable phone collection to simplify checkout
        },
        // Responsive and mobile-friendly options
        consent_collection: {
          promotions: 'auto', // Auto-opt-in for marketing if email provided
        },
      })

      // Update donation with checkout session ID
      await supabaseClient
        .from('donations')
        .update({ stripe_payment_intent_id: checkoutSession.id })
        .eq('id', donation_id)

      return new Response(
        JSON.stringify({
          checkout_url: checkoutSession.url,
          session_id: checkoutSession.id,
        }),
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
          },
          status: 200,
        }
      )
    }

    // For other payment types, use Payment Intent (existing flow)
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
    // Authentication errors
    else if (errorMsg.includes('auth') || errorMsg.includes('unauthorized') || errorMsg.includes('permission')) {
      errorMessage = 'Authentication error. Please refresh the page and try again.'
      statusCode = 401
      errorType = 'AUTH_ERROR'
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
    // Network/timeout errors
    else if (errorMsg.includes('timeout') || errorMsg.includes('network') || errorMsg.includes('connection')) {
      errorMessage = 'Connection timeout. Please try again.'
      statusCode = 504
      errorType = 'TIMEOUT_ERROR'
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

