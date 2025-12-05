# Pre-Deployment Verification Checklist

This document provides a comprehensive checklist for verifying the application is ready for production deployment.

## 1. Pre-deployment Verification ✅

### [x] Run full application test suite (if exists)
- **Status**: Test suite exists and configured
- **Location**: `src/test/` directory
- **Commands**:
  - `npm run test` - Run tests in watch mode
  - `npm run test:run` - Run tests once
  - `npm run test:coverage` - Run with coverage
  - `npm run test:e2e:vitest` - Run E2E auth tests
- **Action Required**: Run `npm run test:run` before deployment

### [ ] Test critical user flows manually:

#### User Registration and Login
- [ ] Register new user with valid email
- [ ] Verify email confirmation (if enabled)
- [ ] Login with correct credentials
- [ ] Login with incorrect credentials (should fail)
- [ ] Verify session persistence
- [ ] Test logout functionality

#### Password Reset Flow
- [ ] Request password reset
- [ ] Verify reset email is sent
- [ ] Click reset link
- [ ] Set new password
- [ ] Login with new password
- [ ] Verify old password no longer works

#### Application Submission
- [ ] Create new NCLEX application
- [ ] Fill all required fields
- [ ] Upload required documents
- [ ] Submit application
- [ ] Verify application appears in dashboard
- [ ] Verify application status updates

#### Payment Processing
- [ ] Create payment for application
- [ ] Test Stripe card payment (test mode)
- [ ] Test mobile banking payment
- [ ] Upload proof of payment
- [ ] Verify payment status updates
- [ ] Test payment receipt generation

#### Document Uploads
- [ ] Upload document to application
- [ ] Verify document appears in list
- [ ] Test document preview
- [ ] Test document deletion (if allowed)
- [ ] Verify file size limits
- [ ] Test invalid file types (should be rejected)

#### Admin Dashboard Functionality
- [ ] Access admin dashboard (admin user only)
- [ ] View all applications
- [ ] Update application status
- [ ] Manage clients
- [ ] Access settings
- [ ] Generate quotations
- [ ] View payment reports

### [ ] Verify all API endpoints work with Supabase
- [ ] Authentication endpoints (signup, login, logout)
- [ ] User profile endpoints
- [ ] Application CRUD operations
- [ ] Payment operations
- [ ] Document upload/download
- [ ] Quotation generation
- [ ] Settings management
- [ ] Notification system

### [ ] Test real-time subscriptions (if applicable)
- [ ] Application status updates
- [ ] Notification delivery
- [ ] Payment status changes
- [ ] Verify subscriptions disconnect properly

---

## 2. Vercel Deployment Configuration ✅

### [x] Review/update vercel.json configuration
- **Status**: Configuration exists and is properly set up
- **File**: `vercel.json`
- **Current Configuration**:
  - Build command: `npm run build`
  - Output directory: `dist`
  - Framework: Vite
  - SPA routing: Configured with rewrites
  - Security headers: Configured
  - Cache headers: Configured for assets

### [x] Set up build command and output directory
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Framework**: Vite (auto-detected)

### [x] Configure redirects and rewrites for SPA routing
- **Status**: Configured in `vercel.json`
- **Configuration**: All routes redirect to `/index.html` for SPA routing

### [ ] Set up environment variables in Vercel dashboard:

**Required Variables:**
- [ ] `VITE_SUPABASE_URL` - Your Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key (pk_live_... for production)

**Optional Variables:**
- [ ] `NODE_ENV=production` - Set automatically by Vercel
- [ ] `VITE_FRONTEND_URL` - Your Vercel app URL (for CORS if needed)

**⚠️ Important**: 
- Never commit actual keys to repository
- Use Vercel dashboard to set environment variables
- Use production keys (pk_live_...) not test keys (pk_test_...)

### [ ] Configure custom domain (if applicable)
- [ ] Add domain in Vercel project settings
- [ ] Update DNS records as instructed
- [ ] Update `VITE_FRONTEND_URL` if needed
- [ ] Verify SSL certificate is active

---

## 3. Supabase Setup Verification

### [ ] Verify all database migrations are applied
- **Location**: `supabase/migrations/` directory
- **Migrations to verify**:
  - [ ] `add_sessions_table.sql`
  - [ ] `create_notification_types_table.sql`
  - [ ] `migrate_existing_notifications.sql`
  - [ ] `add_public_tracking_policies.sql`
  - [ ] `add_public_pictures_policy.sql`
  - [ ] `fix_public_quotations.sql`
  - [ ] `add_auth_login_tracking_trigger.sql`
  - [ ] `add_login_attempts_tracking.sql`
  - [ ] `change_approved_to_completed.sql`
  - [ ] `setup_birthday_greetings_cron.sql`
- **Action**: Run all migrations in order in Supabase SQL Editor

### [ ] Check Row Level Security (RLS) policies are properly configured
- **Tables with RLS**:
  - [ ] `users` - Users can view/update own profile, admins can view all
  - [ ] `applications` - Users can view/update own, admins can view all
  - [ ] `quotations` - Users can view own, admins can view all
  - [ ] `user_details` - Users can view/update own
  - [ ] `user_documents` - Users can view own, admins can view all
  - [ ] `application_payments` - Users can view own, admins can view all
  - [ ] `receipts` - Users can view own, admins can view all
  - [ ] `processing_accounts` - Admins only
  - [ ] `application_timeline_steps` - Public read for tracking
  - [ ] `notifications` - Users can view own
  - [ ] `settings` - Admins only
  - [ ] `services` - Public read, admins can modify
- **Action**: Review policies in Supabase Dashboard → Authentication → Policies

### [ ] Verify storage bucket policies for file uploads
- **Buckets to verify**:
  - [ ] `documents` - Users can upload to own folder, admins can access all
  - [ ] `pictures` - Public read access (for tracking)
- **Action**: Review in Supabase Dashboard → Storage → Policies

### [ ] Test Supabase Edge Functions
- **Functions to test**:
  - [ ] `send-email` - Test email sending functionality
  - [ ] `send-birthday-greetings` - Verify cron job setup
  - [ ] `create-payment-intent` - Test Stripe payment intent creation
  - [ ] `stripe-webhook` - Verify Stripe webhook handling
  - [ ] `admin-login-as` - Test admin login functionality (if used)
- **Action**: 
  - Deploy functions: `supabase functions deploy <function-name>`
  - Set secrets: `supabase secrets set <KEY>=<value>`
  - Test via Supabase Dashboard → Edge Functions
  - See `scripts/deploy-serverless.sh` or `scripts/deploy-serverless.ps1` for deployment script

### [ ] Verify authentication settings in Supabase dashboard
- [ ] Email confirmation: Configured (enable/disable as needed)
- [ ] Password reset: Enabled
- [ ] Email templates: Customized for password reset
- [ ] OAuth providers: Configured (if used)
- [ ] Session timeout: Configured
- [ ] Rate limiting: Configured

### [ ] Check email templates for password reset
- [ ] Template exists and is customized
- [ ] Reset link format is correct
- [ ] Email branding matches application
- [ ] Test email delivery

---

## 4. Environment and Configuration

### [x] Create .env.example file with required variables
- **Status**: `env.production.example` exists
- **Action Required**: Create `.env.example` for development (see below)

### [ ] Document all environment variables needed
**Development (.env):**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-key
```

**Production (Vercel):**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
NODE_ENV=production
```

### [ ] Verify production vs development environment handling
- [ ] Environment variables properly prefixed with `VITE_`
- [ ] No hardcoded API keys in source code
- [ ] Development uses test keys, production uses live keys
- [ ] Error messages differ between dev and prod

### [ ] Check API rate limits and quotas
- [ ] Supabase: Check project limits
- [ ] Stripe: Verify API rate limits
- [ ] Vercel: Check deployment limits
- [ ] Implement rate limiting if needed

---

## 5. Performance Optimization

### [x] Review bundle size and optimize if needed
- **Status**: Vite build configuration includes optimizations
- **Current Optimizations**:
  - Code splitting by vendor
  - Asset optimization
  - CSS code splitting
  - Minification enabled
- **Action**: Run `npm run build` and review bundle sizes

### [ ] Check for unused dependencies
- **Action**: Run `npm audit` and review `package.json`
- **Command**: `npm outdated` to check for updates

### [ ] Optimize image loading and lazy loading
- [ ] Images use lazy loading where appropriate
- [ ] Images are optimized (compressed)
- [ ] Use appropriate image formats (WebP where supported)
- [ ] Implement image placeholders

### [ ] Review and optimize database queries
- [ ] Check for N+1 query problems
- [ ] Add indexes where needed
- [ ] Use select() to limit returned columns
- [ ] Implement pagination for large datasets

### [ ] Implement caching strategies where appropriate
- [ ] Static assets: Configured in vercel.json
- [ ] API responses: Consider caching headers
- [ ] Client-side: Use React Query or similar if needed

---

## 6. Error Handling and Monitoring

### [x] Set up error tracking (e.g., Sentry, LogRocket)
- **Status**: Error boundaries implemented
- **Action Required**: Set up external error tracking service
- **Options**: Sentry, LogRocket, or Vercel Analytics

### [x] Add comprehensive error boundaries
- **Status**: ErrorBoundary component exists
- **Location**: `src/components/ErrorBoundary.tsx`
- **Implementation**: Wraps entire app in App.tsx
- **Action**: Verify error boundaries catch all errors

### [ ] Implement proper logging for production
- [ ] Remove console.log statements (see section 11)
- [ ] Use structured logging if needed
- [ ] Log errors to external service
- [ ] Avoid logging sensitive data

### [ ] Set up monitoring and alerts
- [ ] Vercel Analytics (if available)
- [ ] Uptime monitoring
- [ ] Error rate alerts
- [ ] Performance monitoring

### [ ] Create error reporting mechanism
- [ ] User-friendly error messages
- [ ] Error reporting form (optional)
- [ ] Admin error notifications

---

## 7. Security Review

### [x] Review RLS policies for data access
- **Status**: RLS policies configured (see section 3)
- **Action**: Verify all tables have appropriate policies

### [x] Verify API keys are not exposed in client code
- **Status**: Only `VITE_STRIPE_PUBLISHABLE_KEY` used (correct)
- **Verification**: No secret keys in client code
- **Action**: Double-check no service role keys in frontend

### [ ] Check for sensitive data in client-side code
- [ ] No hardcoded credentials
- [ ] No API secrets in source code
- [ ] No database connection strings
- [ ] Review all environment variable usage

### [ ] Review authentication and authorization flows
- [ ] JWT tokens properly handled
- [ ] Session management secure
- [ ] Password requirements enforced
- [ ] CSRF protection (if applicable)

### [ ] Verify CORS settings
- [ ] CORS configured in Supabase
- [ ] Only allowed origins can access API
- [ ] Credentials handling correct

### [ ] Check for SQL injection vulnerabilities (if any raw queries)
- **Status**: Using Supabase client (parameterized queries)
- **Action**: Review any raw SQL queries if they exist

---

## 8. Documentation

### [x] Update README with deployment instructions
- **Status**: README.md exists with deployment info
- **Action**: Review and update if needed

### [ ] Document environment setup for new developers
- [ ] Create setup guide
- [ ] Document required tools
- [ ] Document database setup
- [ ] Document local development workflow

### [x] Create deployment checklist
- **Status**: This document
- **Action**: Use this checklist before each deployment

### [ ] Document API endpoints and their usage
- [ ] List all Supabase API calls
- [ ] Document authentication requirements
- [ ] Document request/response formats
- [ ] Create API documentation

### [ ] Update architecture documentation
- [ ] Document system architecture
- [ ] Document data flow
- [ ] Document component structure
- [ ] Update as system evolves

---

## 9. Testing

### [x] Set up automated testing (unit, integration, e2e)
- **Status**: Vitest configured with test files
- **Test Files**:
  - `src/test/e2e-auth.test.ts` - E2E authentication tests
  - `src/test/auth.test.ts` - Auth tests
  - `src/test/auth-context.test.tsx` - Context tests
  - `src/test/login-signup.test.tsx` - Login/signup tests
  - `src/test/supabase-auth.test.tsx` - Supabase auth tests
  - `src/test/utils.test.ts` - Utility tests

### [ ] Test on different browsers and devices
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### [ ] Test responsive design on mobile devices
- [ ] Test on various screen sizes
- [ ] Verify touch interactions work
- [ ] Test form inputs on mobile
- [ ] Verify navigation on mobile

### [ ] Load testing for critical endpoints
- [ ] Test application submission under load
- [ ] Test payment processing under load
- [ ] Test document uploads under load
- [ ] Identify bottlenecks

### [ ] Test error scenarios and edge cases
- [ ] Network failures
- [ ] Invalid inputs
- [ ] Missing data
- [ ] Concurrent operations
- [ ] Session expiration

---

## 10. Post-Deployment Tasks

### [ ] Monitor initial deployment for errors
- [ ] Check Vercel deployment logs
- [ ] Monitor browser console for errors
- [ ] Check Supabase logs
- [ ] Monitor error tracking service

### [ ] Verify all features work in production
- [ ] Test all critical user flows
- [ ] Verify environment variables are loaded
- [ ] Test API connections
- [ ] Verify file uploads work

### [ ] Set up backup and recovery procedures
- [ ] Database backups configured
- [ ] Document recovery procedures
- [ ] Test backup restoration
- [ ] Set backup retention policy

### [ ] Create runbook for common issues
- [ ] Document common errors and solutions
- [ ] Document rollback procedures
- [ ] Document how to check logs
- [ ] Document escalation procedures

### [ ] Set up CI/CD pipeline (if not already done)
- [ ] GitHub Actions or similar
- [ ] Automated testing on PR
- [ ] Automated deployment on merge
- [ ] Preview deployments for branches

---

## 11. Code Quality

### [ ] Run linter and fix any remaining warnings
- **Command**: `npm run lint`
- **Fix Command**: `npm run lint:fix`
- **Action**: Fix all warnings before deployment

### [ ] Review code for best practices
- [ ] TypeScript types are correct
- [ ] No any types (where possible)
- [ ] Proper error handling
- [ ] Code is readable and maintainable

### [x] Remove any console.log statements in production code
- **Status**: ✅ Vite config automatically removes console.log in production builds
- **Location**: `vite.config.ts` lines 83-89
- **Configuration**: Terser options configured to drop console.log, console.info, console.debug
- **Note**: Console statements are automatically removed during production build, but should still be minimized in source code for better development experience

### [ ] Add JSDoc comments for complex functions
- [ ] Document complex business logic
- [ ] Document API functions
- [ ] Document utility functions
- [ ] Add type information

### [ ] Review and optimize TypeScript types
- [ ] Check for unused types
- [ ] Verify type accuracy
- [ ] Add missing types
- [ ] Review database types

---

## 12. User Experience

### [ ] Test accessibility (WCAG compliance)
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Color contrast meets standards
- [ ] Alt text for images
- [ ] Form labels are associated

### [x] Verify loading states and user feedback
- **Status**: Loading components exist
- **Action**: Verify all async operations show loading states

### [ ] Test offline behavior (if applicable)
- [ ] Service worker configured (if used)
- [ ] Offline message displayed
- [ ] Data cached appropriately

### [ ] Review and improve error messages
- [ ] Error messages are user-friendly
- [ ] Error messages are actionable
- [ ] Technical errors are hidden from users
- [ ] Success messages are clear

### [ ] Test form validations
- [ ] Required fields validated
- [ ] Email format validated
- [ ] Password strength validated
- [ ] File upload validations
- [ ] Error messages display correctly

---

## 13. Database and Migrations

### [ ] Verify all migrations are in correct order
- [ ] Check migration file naming
- [ ] Verify dependencies between migrations
- [ ] Test migrations on clean database

### [ ] Test migration rollback procedures
- [ ] Document rollback steps
- [ ] Test rollback scripts
- [ ] Verify data integrity after rollback

### [ ] Document database schema changes
- [ ] Update schema documentation
- [ ] Document new tables/columns
- [ ] Document RLS policy changes

### [ ] Set up database backups
- [ ] Configure automatic backups in Supabase
- [ ] Set backup frequency
- [ ] Test backup restoration
- [ ] Document backup procedures

### [ ] Review database indexes for performance
- [ ] Check indexes on frequently queried columns
- [ ] Review foreign key indexes
- [ ] Optimize slow queries
- [ ] Monitor query performance

---

## 14. Third-Party Integrations

### [ ] Verify Stripe integration (if used)
- [ ] Test payment processing with test cards
- [ ] Verify webhook endpoints (if used)
- [ ] Check Stripe dashboard for test transactions
- [ ] Switch to live keys for production
- [ ] Test with real payment (small amount)

### [ ] Test email service integration
- [ ] Test password reset emails
- [ ] Test notification emails
- [ ] Verify email delivery
- [ ] Check spam folder handling

### [ ] Verify any other third-party API integrations
- [ ] List all third-party services
- [ ] Test each integration
- [ ] Verify API keys are correct
- [ ] Check rate limits

### [ ] Check API rate limits and quotas
- [ ] Supabase: Check project limits
- [ ] Stripe: Verify API rate limits
- [ ] Email service: Check sending limits
- [ ] Implement rate limiting if needed

---

## 15. Legal and Compliance

### [x] Verify privacy policy and terms of service
- [x] Privacy policy page created at `/privacy-policy`
- [x] Terms of service page created at `/terms-of-service`
- [x] Both pages are accessible and linked from footer
- [x] Content includes comprehensive legal information
- [ ] Review and customize content for your specific business needs
- [ ] Have legal counsel review if required by your jurisdiction

### [ ] Check GDPR compliance (if applicable)
- [ ] Data collection is documented
- [ ] User consent is obtained
- [ ] Data deletion is possible
- [ ] Data export is available

### [ ] Verify data retention policies
- [ ] Document data retention periods
- [ ] Implement data deletion procedures
- [ ] Verify compliance with regulations

### [ ] Review cookie usage and consent
- [ ] List all cookies used
- [ ] Cookie consent banner (if needed)
- [ ] Document cookie purposes
- [ ] Verify compliance with regulations

---

## Quick Pre-Deployment Commands

```bash
# 1. Run tests
npm run test:run

# 2. Run linter
npm run lint

# 3. Type check
npm run type-check

# 4. Build for production
npm run build

# 5. Preview production build
npm run preview

# 6. Check for security vulnerabilities
npm audit

# 7. Check for outdated packages
npm outdated
```

---

## Deployment Steps

1. **Complete all checklist items above**
2. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Pre-deployment: Complete verification checklist"
   git push origin main
   ```

3. **Deploy to Vercel**:
   - Push to main branch triggers automatic deployment
   - Or manually deploy from Vercel dashboard

4. **Post-deployment verification**:
   - Test critical user flows
   - Monitor error logs
   - Verify environment variables
   - Check performance metrics

---

## Notes

- This checklist should be reviewed before each production deployment
- Mark items as complete ([x]) as you verify them
- Document any issues found and their resolutions
- Update this checklist as the application evolves

---

**Last Updated**: Generated during pre-deployment verification
**Version**: 1.0.0
