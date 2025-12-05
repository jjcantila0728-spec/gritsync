# Deployment Action Plan - Serverless Migration

## 🎯 Current Status

✅ **Code Migration Complete**
- Frontend updated to use Supabase directly
- Edge Function `admin-login-as` created
- All Express API dependencies removed
- Deployment scripts ready

## 🚀 Ready to Deploy

Your application is **100% ready** for serverless deployment. Follow these steps in order:

---

## Phase 1: Deploy Edge Functions (10 minutes)

### Step 1.1: Install/Verify Supabase CLI

```powershell
# Check if installed
supabase --version

# If not installed:
npm install -g supabase
```

### Step 1.2: Login to Supabase

```powershell
supabase login
```

### Step 1.3: Link Your Project

```powershell
# Get your project ref from: Supabase Dashboard → Settings → General
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 1.4: Deploy Edge Functions

**Option A: Use the deployment script**
```powershell
.\scripts\deploy-serverless.ps1
```

**Option B: Manual deployment**
```powershell
# Deploy the new Edge Function
supabase functions deploy admin-login-as

# Verify other functions are deployed (deploy if needed)
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy send-email

# List all deployed functions
supabase functions list
```

---

## Phase 2: Configure Secrets (5 minutes)

### Step 2.1: Get Your Service Role Key

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Copy the `service_role` key (keep it secret!)

### Step 2.2: Set Required Secrets

```powershell
# Required - Service Role Key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Required - Frontend URL
supabase secrets set FRONTEND_URL=https://yourdomain.com

# Stripe (if using Stripe)
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

```

### Step 2.3: Verify Secrets

```powershell
supabase secrets list
```

---

## Phase 3: Update Environment Variables (2 minutes)

### Step 3.1: Update `.env` File

**Remove:**
```env
VITE_API_URL=http://localhost:3001/api
```

**Keep:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

### Step 3.2: Update Production Environment Variables

If deploying to Vercel, Netlify, etc., update environment variables there too:
- Remove `VITE_API_URL`
- Keep `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`

---

## Phase 4: Update Stripe Webhook (3 minutes)

### Step 4.1: Update Webhook URL in Stripe

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click on your existing webhook (or create new)
3. Update endpoint URL to:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)

### Step 4.2: Set Webhook Secret

```powershell
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

---

## Phase 5: Build & Test Locally (5 minutes)

### Step 5.1: Build Frontend

```powershell
npm run build
```

### Step 5.2: Test Locally (Optional)

```powershell
npm run preview
```

Visit `http://localhost:4173` and test:
- [ ] Login/Register works
- [ ] Dashboard loads
- [ ] No console errors

---

## Phase 6: Deploy Frontend (10 minutes)

### Step 6.1: Deploy to Your Hosting Provider

**Vercel:**
```powershell
vercel --prod
```

**Netlify:**
```powershell
netlify deploy --prod
```

**Or manually upload `dist/` folder to your hosting provider**

### Step 6.2: Set Environment Variables in Hosting

Make sure these are set in your hosting provider:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`

**Do NOT set `VITE_API_URL`** (it's no longer needed)

---

## Phase 7: Verify Deployment (10 minutes)

### Step 7.1: Test Critical Features

- [ ] **Authentication**
  - [ ] User can register
  - [ ] User can login
  - [ ] Password reset works

- [ ] **Dashboard**
  - [ ] Stats load correctly
  - [ ] Admin dashboard works
  - [ ] Client dashboard works

- [ ] **Admin Features**
  - [ ] Admin can login-as users (tests Edge Function)
  - [ ] Admin can view clients
  - [ ] Admin can manage applications

- [ ] **File Operations**
  - [ ] File uploads work
  - [ ] File downloads work

- [ ] **Payments**
  - [ ] Stripe payments process
  - [ ] Payment webhooks received (check logs)

### Step 7.2: Check Edge Function Logs

```powershell
# Check admin-login-as logs
supabase functions logs admin-login-as

# Check stripe-webhook logs
supabase functions logs stripe-webhook
```

### Step 7.3: Monitor Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Check function invocations
3. Check for errors

---

## Phase 8: Final Verification (5 minutes)

### Step 8.1: Run Verification Script

```powershell
node scripts/verify-serverless.js
```

### Step 8.2: Check Browser Console

1. Open your deployed app
2. Open browser DevTools (F12)
3. Check Console tab for errors
4. Check Network tab for failed requests

### Step 8.3: Test Production Payments

- [ ] Make a test payment
- [ ] Verify webhook is received
- [ ] Check payment status updates

---

## ✅ Success Criteria

Your deployment is successful when:

- [x] All Edge Functions deployed
- [ ] All secrets set
- [ ] `.env` updated (VITE_API_URL removed)
- [ ] Stripe webhook URL updated
- [ ] Frontend deployed
- [ ] All features work in production
- [ ] No console errors
- [ ] Payments work
- [ ] Admin login-as works

---

## 🆘 Troubleshooting

### Edge Function Deployment Fails

```powershell
# Check if you're logged in
supabase projects list

# Check if project is linked
supabase status

# Try deploying with verbose output
supabase functions deploy admin-login-as --debug
```

### Edge Function Not Working

```powershell
# Check logs
supabase functions logs admin-login-as --limit 50

# Verify secrets
supabase secrets list

# Test locally
supabase functions serve admin-login-as
```

### Frontend Errors

1. **Check browser console** - Look for errors
2. **Check network tab** - Look for failed requests
3. **Verify environment variables** - Make sure they're set in hosting
4. **Check Supabase RLS policies** - Make sure they allow access

### Stripe Webhook Not Working

1. **Verify webhook URL** in Stripe Dashboard
2. **Check logs**: `supabase functions logs stripe-webhook`
3. **Verify secret**: `supabase secrets list`
4. **Test with Stripe CLI**:
   ```powershell
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   ```

---

## 📋 Complete Checklist

### Pre-Deployment
- [ ] Supabase CLI installed
- [ ] Logged into Supabase
- [ ] Project ref obtained
- [ ] Service role key obtained
- [ ] Frontend URL determined

### Deployment
- [ ] Edge Functions deployed
- [ ] Secrets set
- [ ] `.env` file updated
- [ ] Stripe webhook URL updated
- [ ] Frontend built successfully
- [ ] Frontend deployed

### Post-Deployment
- [ ] All features tested
- [ ] No console errors
- [ ] Payments work
- [ ] Admin features work
- [ ] Edge Function logs checked
- [ ] Monitoring set up

---

## 🎉 You're Done!

Once all checkboxes are checked, your application is **100% serverless** and running in production!

---

## Quick Reference

**Deploy Function:**
```powershell
supabase functions deploy FUNCTION_NAME
```

**Set Secret:**
```powershell
supabase secrets set KEY=value
```

**Check Logs:**
```powershell
supabase functions logs FUNCTION_NAME
```

**List Functions:**
```powershell
supabase functions list
```

**List Secrets:**
```powershell
supabase secrets list
```

---

## Next Steps After Deployment

1. **Monitor** - Set up monitoring/alerts
2. **Optimize** - Review Edge Function performance
3. **Clean Up** - Remove Express server files (optional)
4. **Document** - Update team documentation
5. **Celebrate** - You've successfully migrated to serverless! 🎉
