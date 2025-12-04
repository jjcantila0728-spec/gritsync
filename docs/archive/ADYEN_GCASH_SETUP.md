# Adyen GCash Integration Setup Guide

This guide explains how to set up GCash payments using Adyen's API-only integration.

## Prerequisites

1. An Adyen account (sign up at https://www.adyen.com)
2. Access to your Adyen Customer Area
3. API credentials from Adyen

## Step 1: Get Your Adyen API Credentials

1. Log in to your [Adyen Customer Area](https://ca-test.adyen.com) (test) or [Adyen Customer Area](https://ca-live.adyen.com) (live)
2. Navigate to **Developers** → **API credentials**
3. Copy your **API Key**
4. Note your **Merchant Account** name
5. For webhooks, get your **HMAC Key** from **Developers** → **Webhooks** → **Standard webhook**

## Step 2: Enable GCash in Adyen

1. In your Adyen Customer Area, go to **Payment methods**
2. Find **GCash** and enable it
3. Make sure it's enabled for the Philippines (PH) and PHP currency

## Step 3: Configure Environment Variables

### For Supabase Edge Functions

Set the following secrets in your Supabase project:

```bash
# Adyen Configuration
ADYEN_API_KEY=your_adyen_api_key_here
ADYEN_MERCHANT_ACCOUNT=your_merchant_account_name
ADYEN_ENVIRONMENT=test  # or 'live' for production
ADYEN_HMAC_KEY=your_hmac_key_for_webhooks

# Currency Conversion (optional, defaults to 56)
USD_TO_PHP_RATE=56

# Frontend URL for redirects
FRONTEND_URL=https://yourdomain.com
```

To set these secrets:

```bash
npx supabase secrets set ADYEN_API_KEY=your_key --project-ref your-project-ref
npx supabase secrets set ADYEN_MERCHANT_ACCOUNT=your_account --project-ref your-project-ref
npx supabase secrets set ADYEN_ENVIRONMENT=test --project-ref your-project-ref
npx supabase secrets set ADYEN_HMAC_KEY=your_hmac_key --project-ref your-project-ref
npx supabase secrets set USD_TO_PHP_RATE=56 --project-ref your-project-ref
npx supabase secrets set FRONTEND_URL=https://yourdomain.com --project-ref your-project-ref
```

Or set them via the Supabase Dashboard:
1. Go to **Settings** → **Edge Functions** → **Secrets**
2. Add each secret key-value pair

## Step 4: Deploy Edge Functions

Deploy the Adyen edge functions:

```bash
# Deploy create-adyen-payment function
npx supabase functions deploy create-adyen-payment --project-ref your-project-ref

# Deploy handle-adyen-webhook function (for webhook processing)
npx supabase functions deploy handle-adyen-webhook --project-ref your-project-ref
```

## Step 5: Set Up Webhooks (Production)

1. In Adyen Customer Area, go to **Developers** → **Webhooks**
2. Click **Add webhook**
3. Set the endpoint URL to: `https://your-project-ref.supabase.co/functions/v1/handle-adyen-webhook`
4. Select events to listen to:
   - `AUTHORISATION`
   - `CAPTURE`
   - `REFUND`
5. Copy the **HMAC Key** and add it to your Supabase secrets as `ADYEN_HMAC_KEY`

## Step 6: Test the Integration

### Test Mode

1. Use test API credentials from Adyen
2. Set `ADYEN_ENVIRONMENT=test`
3. Use test GCash accounts (contact Adyen support for test accounts)

### Live Mode

1. Use live API credentials from Adyen
2. Set `ADYEN_ENVIRONMENT=live`
3. Use real GCash accounts

## How It Works

1. **User selects GCash**: When a user chooses GCash as payment method
2. **Create Adyen Payment**: The system calls Adyen API to create a payment
3. **Redirect to GCash**: User is redirected to GCash payment page
4. **Payment Processing**: User completes payment in GCash
5. **Return to App**: User is redirected back to your app
6. **Webhook Confirmation**: Adyen sends webhook to confirm payment
7. **Payment Complete**: Payment status is updated in database

## API Reference

### Create Adyen Payment

**Endpoint**: `POST /functions/v1/create-adyen-payment`

**Request Body**:
```json
{
  "payment_id": "payment-uuid",
  "amount": 291.75
}
```

**Response**:
```json
{
  "action": {
    "type": "redirect",
    "url": "https://checkoutshopper-test.adyen.com/..."
  },
  "pspReference": "ABC123...",
  "resultCode": "RedirectShopper",
  "payment_id": "payment-uuid"
}
```

## Currency Conversion

The integration automatically converts USD amounts to PHP using the `USD_TO_PHP_RATE` environment variable. 

**Note**: For production, consider using a real-time currency conversion API instead of a fixed rate.

## Troubleshooting

### Payment Not Redirecting

- Check that `FRONTEND_URL` is set correctly
- Verify the return URL in Adyen payment request
- Check browser console for errors

### Webhook Not Received

- Verify webhook URL is accessible
- Check HMAC key is correct
- Ensure webhook events are enabled in Adyen

### Payment Status Not Updating

- Check webhook function logs in Supabase
- Verify payment_id matches in webhook payload
- Check database permissions for webhook function

## References

- [Adyen GCash API Documentation](https://docs.adyen.com/payment-methods/gcash/api-only)
- [Adyen API Reference](https://docs.adyen.com/api-explorer/)
- [Adyen Webhooks Guide](https://docs.adyen.com/development-resources/webhooks)

