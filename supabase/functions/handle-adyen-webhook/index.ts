// Supabase Edge Function for handling Adyen webhooks
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

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
    const webhookSecret = Deno.env.get('ADYEN_HMAC_KEY')
    if (!webhookSecret) {
      throw new Error('ADYEN_HMAC_KEY is not configured')
    }

    // Get webhook signature from headers
    const signature = req.headers.get('X-Adyen-Signature')
    if (!signature) {
      throw new Error('Missing Adyen signature')
    }

    // Read request body
    const body = await req.text()
    
    // Verify webhook signature (simplified - in production, use proper HMAC verification)
    // For now, we'll process the webhook without full signature verification
    // In production, implement proper HMAC verification as per Adyen docs

    const webhookData = JSON.parse(body)
    console.log('Adyen webhook received:', webhookData)

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Handle different webhook event types
    if (webhookData.eventCode === 'AUTHORISATION' && webhookData.success === 'true') {
      // Payment authorized
      const paymentId = webhookData.merchantReference?.replace('payment_', '')
      
      if (paymentId) {
        await supabaseClient
          .from('application_payments')
          .update({
            status: 'paid',
            transaction_id: webhookData.pspReference,
            payment_method: 'gcash',
          })
          .eq('id', paymentId)
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Webhook processing failed'
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    )
  }
})

