# Next Steps - Serverless Migration

## ✅ What's Been Done

1. ✅ Frontend updated to use Supabase directly
2. ✅ Admin login-as Edge Function created
3. ✅ All Express API dependencies removed from frontend
4. ✅ Deployment scripts created

## 🚀 Immediate Next Steps

### Step 1: Deploy Edge Functions

**Option A: Use the deployment script (Windows PowerShell)**
```powershell
cd e:\GRITSYNC
.\scripts\deploy-serverless.ps1
```

**Option B: Manual deployment**
```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the new Edge Function
supabase functions deploy admin-login-as

# Deploy other Edge Functions (if not already deployed)
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy send-email
```

### Step 2: Set Edge Function Secrets

```bash
# Required secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set FRONTEND_URL=https://yourdomain.com

# Stripe secrets (if using Stripe)
supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key
supabase secrets set STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

```

**Where to find these values:**
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Settings → API → `service_role` key
- `FRONTEND_URL`: Your production frontend URL (e.g., `https://gritsync.com`)
- Stripe keys: Stripe Dashboard → Developers → API keys

### Step 3: Update Environment Variables

**Update `.env` file:**

Remove:
```env
VITE_API_URL=http://localhost:3001/api
```

Keep:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

### Step 4: Update Stripe Webhook URL

In Stripe Dashboard:
1. Go to **Developers** → **Webhooks**
2. Edit your existing webhook or create a new one
3. Set endpoint URL to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
5. Copy the webhook secret and set it as Edge Function secret

### Step 5: Verify Deployment

Run the verification script:
```bash
node scripts/verify-serverless.js
```

Or manually check:
- [ ] Edge Functions are deployed: `supabase functions list`
- [ ] Secrets are set: `supabase secrets list`
- [ ] Frontend builds without errors: `npm run build`
- [ ] No references to `VITE_API_URL` in production code

### Step 6: Test Everything

Test all functionality:

- [ ] **Authentication**
  - [ ] User registration
  - [ ] User login
  - [ ] Password reset
  - [ ] Session management

- [ ] **Dashboard**
  - [ ] Dashboard stats load correctly
  - [ ] Admin dashboard shows correct stats
  - [ ] Client dashboard shows correct stats

- [ ] **Admin Features**
  - [ ] Admin can login-as users (uses Edge Function)
  - [ ] Admin can view all clients
  - [ ] Admin can manage applications

- [ ] **File Operations**
  - [ ] File uploads work
  - [ ] File downloads work
  - [ ] Documents are stored in Supabase Storage

- [ ] **Payments**
  - [ ] Stripe payments work
  - [ ] Payment webhooks are received
  - [ ] Payment status updates correctly

- [ ] **Notifications**
  - [ ] Notifications load
  - [ ] Real-time notifications work
  - [ ] Email notifications work (if configured)

- [ ] **CRUD Operations**
  - [ ] Create applications
  - [ ] Update applications
  - [ ] View applications
  - [ ] Create quotations
  - [ ] Update quotations

### Step 7: Deploy Frontend

Build and deploy your frontend:

```bash
# Build for production
npm run build

# Deploy to your hosting provider (Vercel, Netlify, etc.)
# The built files are in the `dist/` directory
```

**Important:** Make sure your hosting provider has the correct environment variables set.

### Step 8: Monitor and Verify

After deployment:

1. **Check Edge Function logs:**
   ```bash
   supabase functions logs admin-login-as
   supabase functions logs stripe-webhook
   ```

2. **Monitor Supabase Dashboard:**
   - Check API usage
   - Check Edge Function invocations
   - Check error logs

3. **Test in production:**
   - Test all critical user flows
   - Verify payments work
   - Check email notifications

## 🧹 Optional: Clean Up Express Server

Once you're confident everything works, you can optionally remove:

```bash
# Remove Express server directory (optional)
# rm -rf server/

# Remove Docker files (optional)
# rm Dockerfile
# rm docker-compose.yml

# Remove Express dependencies (optional)
# npm uninstall express cors compression multer bcryptjs jsonwebtoken
```

**Note:** Keep these files as backup until you're 100% confident everything works.

## 🆘 Troubleshooting

### Edge Function Not Working

```bash
# Check logs
supabase functions logs admin-login-as

# Verify secrets
supabase secrets list

# Test locally (if needed)
supabase functions serve admin-login-as
```

### Frontend Errors

1. Check browser console for errors
2. Verify Supabase RLS policies are correct
3. Verify environment variables are set correctly
4. Check network tab for failed requests

### Stripe Webhook Not Working

1. Verify webhook URL in Stripe Dashboard
2. Check Edge Function logs: `supabase functions logs stripe-webhook`
3. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
4. Test with Stripe CLI: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`

## 📋 Checklist

- [ ] Edge Functions deployed
- [ ] Secrets set
- [ ] `.env` updated (VITE_API_URL removed)
- [ ] Stripe webhook URL updated
- [ ] Frontend builds successfully
- [ ] All tests pass
- [ ] Frontend deployed to production
- [ ] Production testing complete
- [ ] Monitoring set up

## 🎉 Success!

Once all steps are complete, your application is **100% serverless** and ready for production!

---

## Quick Reference

**Deploy Edge Function:**
```bash
supabase functions deploy admin-login-as
```

**Set Secret:**
```bash
supabase secrets set KEY=value
```

**Check Logs:**
```bash
supabase functions logs FUNCTION_NAME
```

**List Functions:**
```bash
supabase functions list
```

**List Secrets:**
```bash
supabase secrets list
```
