# Deploy Serverless Application

## Quick Start

Your application is now **100% serverless**. Follow these steps to deploy:

### 1. Deploy Edge Functions

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (replace with your project ref)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all Edge Functions
supabase functions deploy admin-login-as
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy send-email
```

### 2. Set Edge Function Secrets

```bash
# Set required secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key
supabase secrets set STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
supabase secrets set FRONTEND_URL=https://yourdomain.com

```

### 3. Update Environment Variables

**Remove from `.env`:**
```env
# Remove this - no longer needed
VITE_API_URL=http://localhost:3001/api
```

**Keep in `.env`:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

### 4. Build and Deploy Frontend

```bash
# Build the frontend
npm run build

# Deploy to your hosting provider (Vercel, Netlify, etc.)
# The built files are in the `dist/` directory
```

### 5. Configure Stripe Webhook

In Stripe Dashboard:
1. Go to **Developers** → **Webhooks**
2. Add endpoint: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the webhook secret and set it as Edge Function secret

---

## What Changed

### ✅ Frontend (100% Serverless)
- All API calls now use Supabase directly
- No Express server dependency
- Edge Functions for server-side operations

### ✅ Backend (Serverless)
- Edge Functions replace Express routes
- Supabase handles database, auth, storage
- No server to maintain

### ⚠️ Express Server (Optional)
- Express server files remain in codebase (as backup)
- Not needed for application to function
- Can be removed once you're confident everything works

---

## Verification

After deployment, verify:

1. ✅ User can register/login
2. ✅ Dashboard loads stats
3. ✅ Admin can login-as users
4. ✅ File uploads/downloads work
5. ✅ Payments process correctly
6. ✅ Notifications work
7. ✅ All CRUD operations work

---

## Troubleshooting

### Edge Function Not Working

```bash
# Check logs
supabase functions logs admin-login-as

# Verify secrets are set
supabase secrets list
```

### Frontend Errors

1. Check browser console for errors
2. Verify Supabase RLS policies
3. Verify environment variables are set
4. Check network tab for failed requests

### Stripe Webhook Not Working

1. Verify webhook URL in Stripe Dashboard
2. Check Edge Function logs: `supabase functions logs stripe-webhook`
3. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
4. Test with Stripe CLI: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`

---

## Rollback

If you need to rollback to Express server:

1. Start Express server: `npm run dev:server`
2. Update `VITE_API_URL` in `.env` to point to Express server
3. Frontend will automatically use Express API (if code still has fallback)

---

## Support

For issues:
1. Check Edge Function logs
2. Check Supabase Dashboard → Logs
3. Check browser console
4. Verify RLS policies in Supabase

---

## Summary

✅ **Your app is now 100% serverless!**

- No Express server needed
- All operations use Supabase
- Edge Functions for server-side logic
- Ready for production
