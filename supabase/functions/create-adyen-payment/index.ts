// Supabase Edge Function for creating Adyen GCash payments
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Check for authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Auth error:', userError)
      throw new Error('Unauthorized: Invalid or expired token')
    }

    // Get payment details
    let body: any = {}
    try {
      body = await req.json()
      console.log('Request body:', body)
    } catch (e) {
      console.error('Error parsing request body:', e)
      throw new Error('Invalid request body')
    }
    
    const { payment_id, amount } = body
    
    if (!payment_id) {
      throw new Error('payment_id is required')
    }

    console.log('Looking for payment:', payment_id, 'for user:', user.id)
    
    // Get payment from database
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

    // Get Adyen configuration
    const adyenApiKey = Deno.env.get('ADYEN_API_KEY')
    const adyenMerchantAccount = Deno.env.get('ADYEN_MERCHANT_ACCOUNT')
    const adyenEnvironment = Deno.env.get('ADYEN_ENVIRONMENT') || 'test' // test or live

    if (!adyenApiKey || !adyenMerchantAccount) {
      throw new Error('Adyen is not configured. Please set ADYEN_API_KEY and ADYEN_MERCHANT_ACCOUNT environment variables.')
    }

    // Adyen API endpoint
    const adyenBaseUrl = adyenEnvironment === 'live' 
      ? 'https://pal-live.adyen.com'
      : 'https://pal-test.adyen.com'

    // Convert USD amount to PHP
    // Get conversion rate from environment or use default
    // In production, use real-time exchange rates from a currency API
    const conversionRate = parseFloat(Deno.env.get('USD_TO_PHP_RATE') || '56')
    const amountInPHP = Math.round(payment.amount * conversionRate * 100) // Convert to cents (PHP centavos)

    // Create Adyen payment request
    const adyenPaymentRequest = {
      merchantAccount: adyenMerchantAccount,
      amount: {
        value: amountInPHP,
        currency: 'PHP',
      },
      paymentMethod: {
        type: 'gcash',
      },
      reference: `payment_${payment_id}`,
      returnUrl: `${Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || 'http://localhost:3000'}/payment/adyen/return?payment_id=${payment_id}&application_id=${payment.application_id}`,
      countryCode: 'PH',
      shopperReference: user.id,
      shopperEmail: user.email,
      metadata: {
        payment_id: payment_id,
        application_id: payment.application_id,
        user_id: user.id,
      },
    }

    console.log('Creating Adyen payment:', adyenPaymentRequest)

    // Make request to Adyen
    const adyenResponse = await fetch(`${adyenBaseUrl}/pal/servlet/Payment/v68/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': adyenApiKey,
      },
      body: JSON.stringify(adyenPaymentRequest),
    })

    const adyenData = await adyenResponse.json()

    if (!adyenResponse.ok) {
      console.error('Adyen API error:', adyenData)
      throw new Error(adyenData.message || `Adyen payment failed: ${adyenResponse.statusText}`)
    }

    console.log('Adyen payment response:', adyenData)

    // Update payment record with Adyen reference
    await supabaseClient
      .from('application_payments')
      .update({ 
        transaction_id: adyenData.pspReference,
        payment_method: 'gcash',
      })
      .eq('id', payment_id)

    // Return payment response
    return new Response(
      JSON.stringify({
        action: adyenData.action,
        pspReference: adyenData.pspReference,
        resultCode: adyenData.resultCode,
        payment_id: payment_id,
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
    const errorMessage = error?.message || 'An error occurred while creating Adyen payment'
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

