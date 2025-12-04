# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payment processing in the GritSync application.

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Access to your Stripe Dashboard

## Step 1: Get Your Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy your **Publishable key** (starts with `pk_test_` for test mode or `pk_live_` for live mode)
4. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)
   - ⚠️ **Important**: Keep your secret key secure and never expose it in client-side code

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env` (if it doesn't exist)
2. Add your Stripe keys:

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
```

**For Production:**
- Use live mode keys (`pk_live_` and `sk_live_`)
- Set `STRIPE_WEBHOOK_SECRET` (see Step 3)

## Step 3: Set Up Webhooks (Production)

Webhooks allow Stripe to notify your server when payments are completed.

### For Production:

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to your `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### For Local Development:

Use Stripe CLI to forward webhooks to your local server:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
4. Copy the webhook signing secret from the CLI output and add it to `.env`

## Step 4: Test the Integration

### Test Mode

1. Use test API keys (starts with `pk_test_` and `sk_test_`)
2. Use Stripe test card numbers:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - Use any future expiry date (e.g., 12/34)
   - Use any 3-digit CVC
   - Use any ZIP code

3. Test the payment flow:
   - Create an application payment
   - Complete the payment using a test card
   - Verify the payment status updates correctly

### Production Mode

1. Switch to live API keys (`pk_live_` and `sk_live_`)
2. Ensure webhooks are configured
3. Test with real cards (small amounts recommended)

## Payment Features

The Stripe integration supports:

1. **Application Payments**:
   - Step 1 Payment (NCLEX NY BON fees)
   - Step 2 Payment (NCLEX PV fees)
   - Full Payment option

2. **Quotation Payments**:
   - Pay for service quotations
   - Automatic status updates

3. **Security**:
   - PCI-compliant payment processing
   - Secure payment intent creation
   - Webhook verification

## Troubleshooting

### Payment Not Processing

1. Check that Stripe keys are correctly set in `.env`
2. Verify the backend server is running
3. Check browser console for errors
4. Verify Stripe dashboard for payment attempts

### Webhook Not Working

1. Ensure `STRIPE_WEBHOOK_SECRET` is set (for production)
2. Check webhook endpoint is accessible
3. Verify webhook events are configured in Stripe Dashboard
4. Check server logs for webhook errors

### Payment Intent Creation Fails

1. Verify `STRIPE_SECRET_KEY` is set correctly
2. Check server logs for detailed error messages
3. Ensure the payment amount is valid (positive number)

## Security Best Practices

1. ✅ Never commit `.env` file to version control
2. ✅ Use environment variables for all secrets
3. ✅ Use test keys for development
4. ✅ Verify webhook signatures in production
5. ✅ Use HTTPS in production
6. ✅ Regularly rotate API keys

## Support

For Stripe-specific issues:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com

For application-specific issues:
- Check server logs
- Review error messages in the UI
- Verify database records

