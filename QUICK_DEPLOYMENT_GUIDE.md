# Quick Deployment Guide

This is a condensed guide for deploying GritSync to production. For a comprehensive checklist, see [PRE_DEPLOYMENT_VERIFICATION.md](./PRE_DEPLOYMENT_VERIFICATION.md).

## Pre-Deployment Checklist (Quick)

### ✅ Code Quality
- [x] TypeScript compilation passes
- [x] Build completes successfully
- [x] Console.log removed in production (automatic)
- [x] Error boundaries implemented

### ⚠️ Manual Steps Required

1. **Run Tests**
   ```bash
   npm run test:run
   ```

2. **Verify Build**
   ```bash
   npm run build
   npm run preview
   ```

3. **Supabase Setup**
   - [ ] Run all migrations from `supabase/migrations/`
   - [ ] Verify RLS policies are active
   - [ ] Deploy Edge Functions (see below)
   - [ ] Configure storage buckets

4. **Vercel Deployment**
   - [ ] Connect GitHub repository
   - [ ] Set environment variables (see below)
   - [ ] Deploy

## Environment Variables for Vercel

Set these in Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
```

⚠️ **Important**: Use `pk_live_` keys for production, not `pk_test_` keys!

## Supabase Edge Functions Deployment

Deploy Edge Functions using Supabase CLI:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy send-email
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy send-birthday-greetings
supabase functions deploy admin-login-as

# Set secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key
supabase secrets set STRIPE_WEBHOOK_SECRET=your-webhook-secret
supabase secrets set FRONTEND_URL=https://yourdomain.com
```

Or use the deployment script:
- Windows: `.\scripts\deploy-serverless.ps1`
- Linux/Mac: `./scripts/deploy-serverless.sh`

## Database Migrations

Run all migrations in order from `supabase/migrations/`:

1. `add_sessions_table.sql`
2. `create_notification_types_table.sql`
3. `migrate_existing_notifications.sql`
4. `add_public_tracking_policies.sql`
5. `add_public_pictures_policy.sql`
6. `fix_public_quotations.sql`
7. `add_auth_login_tracking_trigger.sql`
8. `add_login_attempts_tracking.sql`
9. `change_approved_to_completed.sql`
10. `setup_birthday_greetings_cron.sql`

## Post-Deployment

1. **Test Critical Flows**
   - User registration
   - Login
   - Application submission
   - Payment processing
   - Document uploads

2. **Monitor**
   - Check Vercel deployment logs
   - Monitor browser console for errors
   - Check Supabase logs
   - Verify environment variables are loaded

3. **Verify**
   - All features work in production
   - Environment variables are correct
   - API connections work
   - File uploads work

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all dependencies in `package.json`
- Ensure Node.js version is 18+

### API Calls Fail
- Verify `VITE_SUPABASE_URL` is correct
- Check Supabase RLS policies
- Verify Supabase project is active

### Environment Variables Not Working
- Ensure variables start with `VITE_`
- Redeploy after adding variables
- Check variable names match exactly

## Support

- Full Checklist: [PRE_DEPLOYMENT_VERIFICATION.md](./PRE_DEPLOYMENT_VERIFICATION.md)
- Deployment Summary: [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
