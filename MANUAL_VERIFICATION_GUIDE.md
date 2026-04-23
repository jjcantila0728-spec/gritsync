# Manual Verification Guide

This guide provides step-by-step instructions for manually verifying the remaining pre-deployment checklist items that cannot be automated.

## 1. Supabase Setup Verification

### 1.1 Database Migrations

**Location**: `supabase/migrations/` directory

**Steps**:
1. Log in to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run each migration file in order:
   ```
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
4. Verify each migration completes successfully
5. Check for any error messages

**Verification Checklist**:
- [ ] All migrations executed without errors
- [ ] Tables created successfully (check in Table Editor)
- [ ] Triggers and functions created
- [ ] No duplicate policies or constraints

### 1.2 Row Level Security (RLS) Policies

**Location**: Supabase Dashboard → Authentication → Policies

**Tables to Verify**:

#### Users Table
- [ ] RLS enabled
- [ ] Policy: "Users can view their own profile" (SELECT)
- [ ] Policy: "Users can update their own profile" (UPDATE)
- [ ] Policy: "Admins can view all users" (SELECT)
- [ ] Policy: "Admins can update all users" (UPDATE)

#### Applications Table
- [ ] RLS enabled
- [ ] Policy: "Users can view their own applications" (SELECT)
- [ ] Policy: "Users can create their own applications" (INSERT)
- [ ] Policy: "Users can update their own applications" (UPDATE)
- [ ] Policy: "Admins can view all applications" (SELECT)
- [ ] Policy: "Admins can update all applications" (UPDATE)
- [ ] Policy: "Public can track applications" (SELECT) - for tracking feature

#### Quotations Table
- [ ] RLS enabled
- [ ] Policy: "Users can view their own quotations" (SELECT)
- [ ] Policy: "Admins can view all quotations" (SELECT)
- [ ] Policy: "Admins can create quotations" (INSERT)
- [ ] Policy: "Admins can update quotations" (UPDATE)

#### Application Payments Table
- [ ] RLS enabled
- [ ] Policy: "Users can view their own payments" (SELECT)
- [ ] Policy: "Admins can view all payments" (SELECT)
- [ ] Policy: "Public can view payments for tracking" (SELECT)

#### Application Timeline Steps Table
- [ ] RLS enabled
- [ ] Policy: "Public can view timeline steps for tracking" (SELECT)
- [ ] Policy: "Admins can manage timeline steps" (INSERT/UPDATE/DELETE)

#### User Documents Table
- [ ] RLS enabled
- [ ] Policy: "Users can view their own documents" (SELECT)
- [ ] Policy: "Users can upload their own documents" (INSERT)
- [ ] Policy: "Admins can view all documents" (SELECT)

#### Settings Table
- [ ] RLS enabled
- [ ] Policy: "Admins can view settings" (SELECT)
- [ ] Policy: "Admins can update settings" (UPDATE)

**How to Verify**:
1. Go to Supabase Dashboard → Authentication → Policies
2. Select each table from the dropdown
3. Verify all policies are listed and active
4. Test policies by:
   - Creating a test user account
   - Trying to access other users' data (should fail)
   - Testing admin access (should succeed)

### 1.3 Storage Bucket Policies

**Location**: Supabase Dashboard → Storage → Policies

**Buckets to Verify**:

#### Documents Bucket
- [ ] Bucket exists and is set to **Private**
- [ ] Policy: "Users can upload to own folder" (INSERT)
- [ ] Policy: "Users can view own documents" (SELECT)
- [ ] Policy: "Admins can upload all documents" (INSERT)
- [ ] Policy: "Admins can view all documents" (SELECT)
- [ ] Policy: "Admins can delete all documents" (DELETE)

#### Pictures Bucket (if exists)
- [ ] Bucket exists and is set to **Public** (for tracking)
- [ ] Policy: "Public can view pictures" (SELECT)

**How to Verify**:
1. Go to Supabase Dashboard → Storage
2. Check each bucket exists
3. Verify bucket privacy settings
4. Check policies in Storage → Policies
5. Test file upload as regular user
6. Test file access as admin

### 1.4 Edge Functions

**Location**: Supabase Dashboard → Edge Functions

**Functions to Deploy and Verify**:

1. **send-email**
   - [ ] Function deployed
   - [ ] Secrets configured (if needed)
   - [ ] Test function execution

2. **create-payment-intent**
   - [ ] Function deployed
   - [ ] Stripe secrets configured
   - [ ] Test payment intent creation

3. **stripe-webhook**
   - [ ] Function deployed
   - [ ] Webhook secret configured
   - [ ] Stripe webhook URL configured in Stripe dashboard

4. **send-birthday-greetings**
   - [ ] Function deployed
   - [ ] Cron job configured (if applicable)
   - [ ] Test function execution

5. **admin-login-as** (if used)
   - [ ] Function deployed
   - [ ] Test admin login functionality

**How to Deploy**:
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy each function
supabase functions deploy send-email
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy send-birthday-greetings
supabase functions deploy admin-login-as

# Set secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
supabase secrets set STRIPE_SECRET_KEY=your-key
supabase secrets set STRIPE_WEBHOOK_SECRET=your-secret
```

### 1.5 Authentication Settings

**Location**: Supabase Dashboard → Authentication → Settings

**Settings to Verify**:
- [ ] Email confirmation: Configured (enable/disable as needed)
- [ ] Password reset: Enabled
- [ ] Email templates: Customized
  - [ ] Password reset template
  - [ ] Email confirmation template
  - [ ] Magic link template (if used)
- [ ] OAuth providers: Configured (if used)
- [ ] Session timeout: Configured appropriately
- [ ] Rate limiting: Enabled

**How to Verify**:
1. Go to Authentication → Settings
2. Review each setting
3. Test password reset flow
4. Verify email delivery

## 2. Manual Testing

### 2.1 User Registration and Login

**Test Steps**:
1. Navigate to registration page
2. Fill in registration form with valid data
3. Submit registration
4. Check email for confirmation (if enabled)
5. Log in with registered credentials
6. Verify dashboard loads correctly
7. Test logout functionality

**Expected Results**:
- [ ] Registration succeeds
- [ ] Email confirmation received (if enabled)
- [ ] Login succeeds with correct credentials
- [ ] Login fails with incorrect credentials
- [ ] Session persists after page refresh
- [ ] Logout clears session

### 2.2 Password Reset Flow

**Test Steps**:
1. Navigate to forgot password page
2. Enter registered email address
3. Submit password reset request
4. Check email for reset link
5. Click reset link
6. Enter new password
7. Log in with new password
8. Verify old password no longer works

**Expected Results**:
- [ ] Reset email sent
- [ ] Reset link works
- [ ] New password can be set
- [ ] Login with new password succeeds
- [ ] Old password no longer works

### 2.3 Application Submission

**Test Steps**:
1. Log in as regular user
2. Navigate to "New Application"
3. Fill in all required fields
4. Upload required documents
5. Submit application
6. Verify application appears in dashboard
7. Check application status

**Expected Results**:
- [ ] All fields can be filled
- [ ] Documents upload successfully
- [ ] Application submits without errors
- [ ] Application appears in user's dashboard
- [ ] Application has correct initial status

### 2.4 Payment Processing

**Test Steps**:
1. Create an application (or use existing)
2. Navigate to payment page
3. Select payment method
4. Enter payment details (use test cards for Stripe)
5. Complete payment
6. Verify payment status updates
7. Check payment receipt

**Expected Results**:
- [ ] Payment form loads correctly
- [ ] Test card payment succeeds (Stripe test mode)
- [ ] Mobile banking payment option works
- [ ] Payment status updates correctly
- [ ] Receipt can be generated/downloaded

### 2.5 Document Uploads

**Test Steps**:
1. Navigate to application or documents page
2. Click upload document
3. Select valid file (image, PDF)
4. Upload document
5. Verify document appears in list
6. Test document preview
7. Test document deletion (if allowed)

**Expected Results**:
- [ ] Valid files upload successfully
- [ ] Invalid file types are rejected
- [ ] File size limits are enforced
- [ ] Documents appear in list
- [ ] Document preview works
- [ ] Documents are accessible after upload

### 2.6 Admin Dashboard

**Test Steps**:
1. Log in as admin user
2. Navigate to admin dashboard
3. Verify all admin features are accessible:
   - View all applications
   - View all clients
   - Manage settings
   - Generate quotations
   - View payment reports
4. Test application status updates
5. Test client management features

**Expected Results**:
- [ ] Admin dashboard loads
- [ ] All applications visible
- [ ] Can update application status
- [ ] Can view all clients
- [ ] Settings page accessible
- [ ] Quotations can be generated

## 3. Environment Variables in Vercel

### 3.1 Setting Environment Variables

**Steps**:
1. Log in to Vercel Dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable:

**Required Variables**:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
```

**Optional Variables**:
```
NODE_ENV=production
VITE_FRONTEND_URL=https://your-app.vercel.app
```

**Verification**:
- [ ] All required variables set
- [ ] Variables use production keys (pk_live_, not pk_test_)
- [ ] Supabase URL is correct
- [ ] Supabase anon key is correct
- [ ] Variables are set for Production environment

### 3.2 Testing Environment Variables

**Steps**:
1. Deploy to Vercel
2. Check deployment logs for errors
3. Open deployed application
4. Check browser console for errors
5. Verify API calls work (check Network tab)
6. Test authentication flow

**Expected Results**:
- [ ] Deployment succeeds
- [ ] No environment variable errors in logs
- [ ] Application loads correctly
- [ ] API calls succeed
- [ ] Authentication works

## 4. Performance Testing

### 4.1 Bundle Size

**Steps**:
1. Run `npm run build`
2. Check build output for bundle sizes
3. Review `dist/` directory
4. Check for large files

**Targets**:
- [ ] Main bundle < 500KB (gzipped)
- [ ] Total bundle size reasonable
- [ ] No unnecessary large dependencies

### 4.2 Load Testing

**Critical Endpoints to Test**:
- [ ] Application submission under load
- [ ] Payment processing under load
- [ ] Document uploads under load
- [ ] Dashboard loading with many applications

**Tools**:
- Browser DevTools Network tab
- Lighthouse performance audit
- Load testing tools (if available)

## 5. Security Review

### 5.1 API Keys

**Check**:
- [ ] No secret keys in client code
- [ ] Only VITE_ prefixed variables in client
- [ ] Stripe publishable key only (not secret key)
- [ ] No service role keys exposed

### 5.2 CORS Settings

**Check in Supabase**:
1. Go to Settings → API
2. Check CORS configuration
3. Verify allowed origins include your Vercel domain

### 5.3 Authentication Flow

**Test**:
- [ ] JWT tokens properly handled
- [ ] Session management secure
- [ ] Password requirements enforced
- [ ] Account lockout after failed attempts (if implemented)

## 6. Browser and Device Testing

### 6.1 Desktop Browsers

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### 6.2 Mobile Devices

Test on:
- [ ] iOS Safari
- [ ] Chrome Mobile (Android)
- [ ] Various screen sizes

**Test Areas**:
- [ ] Responsive design
- [ ] Touch interactions
- [ ] Form inputs
- [ ] Navigation
- [ ] File uploads

## 7. Post-Deployment Verification

### 7.1 Initial Checks

After deployment:
- [ ] Application loads without errors
- [ ] No console errors
- [ ] Environment variables loaded correctly
- [ ] API connections work
- [ ] Authentication works

### 7.2 Feature Verification

Test all features in production:
- [ ] User registration
- [ ] Login/logout
- [ ] Application submission
- [ ] Payment processing
- [ ] Document uploads
- [ ] Admin features

### 7.3 Monitoring

Set up:
- [ ] Error tracking (Sentry, LogRocket, etc.)
- [ ] Uptime monitoring
- [ ] Performance monitoring
- [ ] Error rate alerts

## 8. Documentation Review

### 8.1 Update Documentation

- [ ] README.md is up to date
- [ ] Deployment instructions are clear
- [ ] Environment variables documented
- [ ] API endpoints documented (if applicable)
- [ ] Troubleshooting guide available

## Quick Verification Checklist

Use this quick checklist before final deployment:

- [ ] All Supabase migrations applied
- [ ] RLS policies verified
- [ ] Storage buckets configured
- [ ] Edge Functions deployed
- [ ] Environment variables set in Vercel
- [ ] Manual testing completed
- [ ] Legal pages accessible
- [ ] Error tracking configured
- [ ] Documentation updated
- [ ] Performance acceptable
- [ ] Security review completed

---

**Note**: This is a comprehensive guide. Not all items may be applicable to your specific deployment. Focus on the items most relevant to your application.
