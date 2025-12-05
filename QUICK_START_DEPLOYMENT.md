# Quick Start - Deploy Serverless App

## 🚀 Fast Deployment Guide

### Prerequisites
- Supabase CLI installed: `npm install -g supabase`
- Logged into Supabase: `supabase login`
- Your Supabase project ref

---

## Step 1: Deploy Edge Functions (5 minutes)

```bash
# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the new Edge Function
supabase functions deploy admin-login-as

# Deploy other functions (if not already deployed)
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy send-email
```

---

## Step 2: Set Secrets (2 minutes)

```bash
# Get your service role key from: Supabase Dashboard → Settings → API
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Set your frontend URL
supabase secrets set FRONTEND_URL=https://yourdomain.com

# Stripe secrets (if using Stripe)
supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key
supabase secrets set STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

---

## Step 3: Update Environment Variables (1 minute)

**Edit `.env` file:**

Remove this line:
```env
VITE_API_URL=http://localhost:3001/api
```

Keep these:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

---

## Step 4: Update Stripe Webhook (2 minutes)

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Edit your webhook endpoint
3. Set URL to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
4. Copy webhook secret and set it: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

---

## Step 5: Build & Deploy Frontend (5 minutes)

```bash
# Build
npm run build

# Deploy to your hosting (Vercel, Netlify, etc.)
# Files are in `dist/` directory
```

---

## ✅ Verification

Test these features:
- [ ] User can login/register
- [ ] Dashboard loads stats
- [ ] Admin can login-as users
- [ ] File uploads work
- [ ] Payments process correctly

---

## 🆘 Quick Troubleshooting

**Edge Function not working?**
```bash
supabase functions logs admin-login-as
```

**Frontend errors?**
- Check browser console
- Verify `.env` variables are set
- Check Supabase RLS policies

**Stripe webhook not working?**
- Verify webhook URL in Stripe Dashboard
- Check logs: `supabase functions logs stripe-webhook`
- Verify secret is set: `supabase secrets list`

---

## 📋 Complete Checklist

- [ ] Edge Functions deployed
- [ ] Secrets set
- [ ] `.env` updated
- [ ] Stripe webhook updated
- [ ] Frontend built
- [ ] Frontend deployed
- [ ] All tests pass

---

## 🎉 Done!

Your app is now **100% serverless**!

For detailed instructions, see `NEXT_STEPS.md` or `DEPLOY_SERVERLESS.md`.
