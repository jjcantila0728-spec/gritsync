// Supabase Edge Function for Stripe webhooks
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const paymentId = paymentIntent.metadata.payment_id

        if (paymentId) {
          // Update payment status
          await supabaseClient
            .from('application_payments')
            .update({
              status: 'paid',
              stripe_payment_intent_id: paymentIntent.id,
              transaction_id: paymentIntent.id,
              payment_method: 'stripe',
            })
            .eq('id', paymentId)

          // Get payment details
          const { data: payment } = await supabaseClient
            .from('application_payments')
            .select('application_id, payment_type, amount, payment_method')
            .eq('id', paymentId)
            .single()

          if (payment) {
            // Get all paid payments for this application to calculate total
            const { data: allPayments } = await supabaseClient
              .from('application_payments')
              .select('amount, payment_type')
              .eq('application_id', payment.application_id)
              .eq('status', 'paid')
            
            // Calculate total amount paid
            const totalAmountPaid = allPayments?.reduce((sum, p) => sum + (parseFloat(p.amount.toString()) || 0), 0) || 0
            
            // Update timeline step based on payment type
            const stepNameMap: { [key: string]: string } = {
              'app_paid': 'Application Step 1 payment paid',
              'app_step2_paid': 'Application Step 2 payment paid',
            }
            
            if (payment.payment_type === 'step1') {
              await supabaseClient
                .from('application_timeline_steps')
                .upsert({
                  application_id: payment.application_id,
                  step_key: 'app_paid',
                  step_name: stepNameMap['app_paid'],
                  status: 'completed',
                  data: {
                    amount: payment.amount,
                    total_amount_paid: totalAmountPaid,
                    payment_method: payment.payment_method || 'stripe',
                    completed_at: new Date().toISOString()
                  },
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'application_id,step_key'
                })
            } else if (payment.payment_type === 'step2') {
              await supabaseClient
                .from('application_timeline_steps')
                .upsert({
                  application_id: payment.application_id,
                  step_key: 'app_step2_paid',
                  step_name: stepNameMap['app_step2_paid'],
                  status: 'completed',
                  data: {
                    amount: payment.amount,
                    total_amount_paid: totalAmountPaid,
                    payment_method: payment.payment_method || 'stripe',
                    completed_at: new Date().toISOString()
                  },
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'application_id,step_key'
                })
            } else if (payment.payment_type === 'full') {
              // For full payment, update both step1 and step2 as completed
              await supabaseClient
                .from('application_timeline_steps')
                .upsert({
                  application_id: payment.application_id,
                  step_key: 'app_paid',
                  step_name: stepNameMap['app_paid'],
                  status: 'completed',
                  data: {
                    amount: payment.amount,
                    total_amount_paid: totalAmountPaid,
                    payment_method: payment.payment_method || 'stripe',
                    completed_at: new Date().toISOString()
                  },
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'application_id,step_key'
                })
              
              await supabaseClient
                .from('application_timeline_steps')
                .upsert({
                  application_id: payment.application_id,
                  step_key: 'app_step2_paid',
                  step_name: stepNameMap['app_step2_paid'],
                  status: 'completed',
                  data: {
                    amount: payment.amount,
                    total_amount_paid: totalAmountPaid,
                    payment_method: payment.payment_method || 'stripe',
                    completed_at: new Date().toISOString()
                  },
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'application_id,step_key'
                })
            }

            // Get full payment data for receipt
            const { data: paymentForReceipt } = await supabaseClient
              .from('application_payments')
              .select('*, applications(*)')
              .eq('id', paymentId)
              .single()

            if (paymentForReceipt) {
              const receiptNumber = `RCP-${Date.now()}`
              await supabaseClient.from('receipts').insert({
                payment_id: paymentId,
                application_id: paymentForReceipt.application_id,
                user_id: paymentForReceipt.user_id,
                receipt_number: receiptNumber,
                amount: paymentForReceipt.amount,
                payment_type: paymentForReceipt.payment_type,
                items: paymentForReceipt.items || [],
              })

              // Check if email notifications are enabled for payment updates
              const { data: emailSettings } = await supabaseClient
                .from('settings')
                .select('value')
                .in('key', ['emailNotificationsEnabled', 'emailPaymentUpdates'])
              
              const settingsMap: Record<string, string> = {}
              emailSettings?.forEach(setting => {
                settingsMap[setting.key] = setting.value
              })
              
              const emailEnabled = settingsMap.emailNotificationsEnabled === 'true'
              const paymentEmailsEnabled = settingsMap.emailPaymentUpdates === 'true'
              const shouldSendEmail = emailEnabled && paymentEmailsEnabled
              
              // Always create in-app notification
              await supabaseClient.from('notifications').insert({
                user_id: paymentForReceipt.user_id,
                application_id: paymentForReceipt.application_id,
                type: 'payment',
                title: 'Payment Successful',
                message: `Your payment of $${paymentForReceipt.amount} has been processed successfully.`,
                read: false,
              })
              
              // Send email if enabled
              if (shouldSendEmail) {
                try {
                  // Get user email and name
                  const { data: userData } = await supabaseClient
                    .from('users')
                    .select('email, full_name, first_name, last_name')
                    .eq('id', paymentForReceipt.user_id)
                    .single()
                  
                  if (userData?.email) {
                    const userName = userData.full_name || 
                                    (userData.first_name && userData.last_name 
                                      ? `${userData.first_name} ${userData.last_name}` 
                                      : userData.first_name || 'User')
                    
                    // Call email service
                    await supabaseClient.functions.invoke('send-email', {
                      body: {
                        to: userData.email,
                        subject: 'Payment Successful - GritSync',
                        html: `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 20px; text-align: center; }
                                .content { padding: 20px; background: #f9f9f9; }
                                .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                              </style>
                            </head>
                            <body>
                              <div class="container">
                                <div class="header">
                                  <h1>GRITSYNC</h1>
                                </div>
                                <div class="content">
                                  <p>Hello ${userName},</p>
                                  <p>Your payment of $${paymentForReceipt.amount} has been processed successfully.</p>
                                  <p>Thank you for your payment!</p>
                                  <a href="${process.env.SITE_URL || 'https://gritsync.com'}/applications/${paymentForReceipt.application_id}" class="button">View Application</a>
                                </div>
                              </div>
                            </body>
                          </html>
                        `,
                      },
                    })
                  }
                } catch (emailError) {
                  console.error('Error sending payment email:', emailError)
                  // Don't fail the webhook if email fails
                }
              }
            }
          }
        }
        break

      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent
        const failedPaymentId = failedPaymentIntent.metadata.payment_id

        if (failedPaymentId) {
          await supabaseClient
            .from('application_payments')
            .update({ status: 'failed' })
            .eq('id', failedPaymentId)
        }
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

