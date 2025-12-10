# Edge Function Deployment Guide

## Quick Deployment Options

### Option 1: Deploy via Supabase Dashboard (Easiest)

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild
   - Go to **Edge Functions** in the left sidebar

2. **Create/Update the Function**
   - Click **"Create a new function"** or find `create-payment-intent`
   - Copy the contents of `supabase/functions/create-payment-intent/index.ts`
   - Paste it into the function editor
   - Click **"Deploy"**

3. **Set Environment Variables**
   - Go to **Edge Functions** → **Settings** → **Secrets**
   - Add the following secrets:
     - `SUPABASE_SERVICE_ROLE_KEY` = Your service role key (from Settings > API)
     - `STRIPE_SECRET_KEY` = Your Stripe secret key (if not already set)

### Option 2: Use npx (No Installation Required)

Run these commands in PowerShell:

```powershell
# Deploy the function
npx supabase functions deploy create-payment-intent --project-ref warfdcbvnapietbkpild

# Set the service role key (replace with your actual key)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key --project-ref warfdcbvnapietbkpild
```

### Option 3: Use the PowerShell Script

```powershell
.\deploy-edge-function.ps1
```

## Required Secrets

Make sure these environment variables are set in your Edge Function:

1. **SUPABASE_SERVICE_ROLE_KEY** (Required for anonymous donations)
   - Get it from: Supabase Dashboard → Settings → API → `service_role` key
   - This allows the function to bypass RLS for anonymous donations

2. **STRIPE_SECRET_KEY** (Required for payment processing)
   - Get it from: Stripe Dashboard → Developers → API keys → Secret key
   - Should start with `sk_test_` (test) or `sk_live_` (production)

## Verify Deployment

After deployment, test the donation flow:
1. Go to your app's donation page
2. Try making an anonymous donation
3. Check the browser console for any errors
4. Check Supabase Edge Function logs for any issues

## Troubleshooting

- **401 Unauthorized**: Make sure `SUPABASE_SERVICE_ROLE_KEY` is set
- **Stripe errors**: Make sure `STRIPE_SECRET_KEY` is set
- **Function not found**: Make sure the function is deployed and active

