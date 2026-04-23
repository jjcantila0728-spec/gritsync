# Deployment Action Plan

This document provides a step-by-step action plan for deploying GritSync to production.

## Phase 1: Pre-Deployment Preparation ✅

### Automated Checks (Run these first)

1. **Run Verification Script**
   ```bash
   npm run verify
   ```
   This will check:
   - Package.json configuration
   - Vercel configuration
   - Environment files
   - Documentation
   - Legal pages
   - Migrations
   - Security configurations

2. **Run Tests**
   ```bash
   npm run test:run
   ```

3. **Type Check**
   ```bash
   npm run type-check
   ```

4. **Lint Code**
   ```bash
   npm run lint
   ```

5. **Build for Production**
   ```bash
   npm run build
   npm run preview
   ```

### Manual Checks

- [ ] Review [PRE_DEPLOYMENT_VERIFICATION.md](./PRE_DEPLOYMENT_VERIFICATION.md)
- [ ] Review [MANUAL_VERIFICATION_GUIDE.md](./MANUAL_VERIFICATION_GUIDE.md)
- [ ] Complete manual testing checklist

---

## Phase 2: Supabase Setup

### Step 1: Run Database Migrations

1. Log in to Supabase Dashboard
2. Navigate to SQL Editor
3. Run migrations in order:
   ```sql
   -- Run each file from supabase/migrations/ in this order:
   1. add_sessions_table.sql
   2. create_notification_types_table.sql
   3. migrate_existing_notifications.sql
   4. add_public_tracking_policies.sql
   5. add_public_pictures_policy.sql
   6. fix_public_quotations.sql
   7. add_auth_login_tracking_trigger.sql
   8. add_login_attempts_tracking.sql
   9. change_approved_to_completed.sql
   10. setup_birthday_greetings_cron.sql
   ```

4. Verify migrations completed successfully

### Step 2: Verify RLS Policies

1. Run verification script in Supabase SQL Editor:
   ```sql
   -- Copy and run: supabase/migrations/verify_rls_policies.sql
   ```

2. Review results:
   - [ ] All tables have RLS enabled
   - [ ] Appropriate policies exist for each table
   - [ ] No missing policies

3. Test policies manually:
   - Create test user account
   - Verify user can only access own data
   - Verify admin can access all data

### Step 3: Configure Storage Buckets

1. Go to Supabase Dashboard → Storage
2. Verify buckets exist:
   - [ ] `documents` bucket (PRIVATE)
   - [ ] `pictures` bucket (PUBLIC, if used)
3. Check storage policies:
   - [ ] Users can upload to own folder
   - [ ] Users can view own documents
   - [ ] Admins can access all documents

### Step 4: Deploy Edge Functions

1. Install Supabase CLI (if not installed):
   ```bash
   npm install -g supabase
   ```

2. Login:
   ```bash
   supabase login
   ```

3. Link project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy functions:
   ```bash
   supabase functions deploy send-email
   supabase functions deploy create-payment-intent
   supabase functions deploy stripe-webhook
   supabase functions deploy send-birthday-greetings
   supabase functions deploy admin-login-as
   ```

5. Set secrets:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key
   supabase secrets set STRIPE_WEBHOOK_SECRET=your-webhook-secret
   supabase secrets set FRONTEND_URL=https://yourdomain.com
   ```

### Step 5: Configure Authentication

1. Go to Supabase Dashboard → Authentication → Settings
2. Configure:
   - [ ] Email confirmation (enable/disable as needed)
   - [ ] Password reset (enabled)
   - [ ] Email templates (customized)
   - [ ] Session timeout
   - [ ] Rate limiting

---

## Phase 3: Vercel Deployment

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Vite configuration

### Step 2: Configure Build Settings

Verify these settings (should auto-detect):
- Framework: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### Step 3: Set Environment Variables

Go to Settings → Environment Variables and add:

**Required:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
```

**Optional:**
```
NODE_ENV=production
VITE_FRONTEND_URL=https://your-app.vercel.app
```

⚠️ **Important**: 
- Use `pk_live_` keys for production (not `pk_test_`)
- Set variables for Production environment
- Redeploy after adding variables

### Step 4: Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Check build logs for errors
4. Note the deployment URL

### Step 5: Configure Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `VITE_FRONTEND_URL` if needed

---

## Phase 4: Post-Deployment Verification

### Step 1: Initial Checks

- [ ] Application loads without errors
- [ ] No console errors in browser
- [ ] Environment variables loaded correctly
- [ ] API connections work
- [ ] Authentication works

### Step 2: Test Critical Flows

Test each flow in production:

1. **User Registration**
   - [ ] Can register new account
   - [ ] Email confirmation works (if enabled)
   - [ ] Account created successfully

2. **Login**
   - [ ] Can login with correct credentials
   - [ ] Login fails with incorrect credentials
   - [ ] Session persists

3. **Application Submission**
   - [ ] Can create new application
   - [ ] Documents upload successfully
   - [ ] Application appears in dashboard

4. **Payment Processing**
   - [ ] Payment form loads
   - [ ] Test payment succeeds (use test cards)
   - [ ] Payment status updates

5. **Admin Features**
   - [ ] Admin dashboard accessible
   - [ ] Can view all applications
   - [ ] Can update application status

### Step 3: Set Up Monitoring

1. **Error Tracking** (Choose one):
   - [ ] Sentry
   - [ ] LogRocket
   - [ ] Vercel Analytics

2. **Uptime Monitoring**:
   - [ ] UptimeRobot
   - [ ] Pingdom
   - [ ] StatusCake

3. **Performance Monitoring**:
   - [ ] Vercel Analytics
   - [ ] Google Analytics
   - [ ] Custom monitoring

### Step 4: Documentation

- [ ] Update README with production URL
- [ ] Document any production-specific configurations
- [ ] Create runbook for common issues
- [ ] Document rollback procedures

---

## Phase 5: Go Live Checklist

Before announcing to users:

- [ ] All migrations applied
- [ ] RLS policies verified
- [ ] Storage buckets configured
- [ ] Edge Functions deployed
- [ ] Environment variables set
- [ ] Manual testing completed
- [ ] Legal pages accessible
- [ ] Error tracking configured
- [ ] Monitoring set up
- [ ] Documentation updated
- [ ] Backup procedures in place
- [ ] Support contact information available

---

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all dependencies in package.json
- Ensure Node.js version is 18+

### API Calls Fail
- Verify `VITE_SUPABASE_URL` is correct
- Check Supabase RLS policies
- Verify Supabase project is active
- Check browser console for errors

### Environment Variables Not Working
- Ensure variables start with `VITE_`
- Redeploy after adding variables
- Check variable names match exactly
- Verify variables are set for Production environment

### RLS Policy Issues
- Run `verify_rls_policies.sql` in Supabase
- Check policy definitions
- Test with test user account
- Review Supabase logs

---

## Quick Reference

### Important Commands
```bash
# Verification
npm run verify
npm run test:run
npm run type-check
npm run lint
npm run build

# Supabase
supabase functions deploy <function-name>
supabase secrets set <KEY>=<value>

# Git
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### Important URLs
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Dashboard: https://supabase.com/dashboard
- Stripe Dashboard: https://dashboard.stripe.com

### Important Files
- [PRE_DEPLOYMENT_VERIFICATION.md](./PRE_DEPLOYMENT_VERIFICATION.md) - Full checklist
- [MANUAL_VERIFICATION_GUIDE.md](./MANUAL_VERIFICATION_GUIDE.md) - Manual verification steps
- [QUICK_DEPLOYMENT_GUIDE.md](./QUICK_DEPLOYMENT_GUIDE.md) - Quick reference
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Status summary

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review error logs in Vercel and Supabase
3. Check browser console for client-side errors
4. Review [PRE_DEPLOYMENT_VERIFICATION.md](./PRE_DEPLOYMENT_VERIFICATION.md) for common issues

---

**Last Updated**: Generated during pre-deployment verification
**Status**: Ready for deployment following this plan
