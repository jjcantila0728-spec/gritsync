# Client Emails - Deployment Checklist

## 🚀 Pre-Deployment Checklist

Use this checklist to ensure everything is ready for deployment.

---

## ✅ Code Changes Verified

- [x] **Frontend Files Modified:**
  - [x] `src/pages/ClientEmails.tsx` - Enhanced error handling
  - [x] `src/lib/resend-inbox-api.ts` - Added email filtering
  - [x] `src/lib/email-api.ts` - Added fromEmailAddressId filter

- [x] **Backend Files Modified:**
  - [x] `supabase/functions/resend-inbox/index.ts` - Added to parameter

- [x] **Database Files Created:**
  - [x] `supabase/migrations/add-auto-email-generation-trigger.sql`

- [x] **Documentation Created:**
  - [x] `CLIENT_EMAILS_IMPLEMENTATION.md`
  - [x] `CLIENT_EMAILS_QUICK_START.md`
  - [x] `IMPLEMENTATION_SUMMARY_CLIENT_EMAILS.md`
  - [x] `DEPLOYMENT_CHECKLIST.md` (this file)

---

## 📋 Pre-Deployment Steps

### 1. Code Review

- [ ] Review all modified files
- [ ] Check for console.log statements (ok for error logging)
- [ ] Verify TypeScript types are correct
- [ ] Ensure no hardcoded values
- [ ] Check for security vulnerabilities

### 2. Local Testing

- [ ] Run linting: `npm run lint`
- [ ] Run type checking: `npm run type-check`
- [ ] Test in development mode
- [ ] Clear browser cache and test
- [ ] Test with network throttling

### 3. Database Preparation

- [ ] Backup current database
- [ ] Review migration SQL file
- [ ] Test migration on staging database (if available)
- [ ] Verify no data loss during migration

---

## 🔧 Deployment Steps

### Step 1: Apply Database Migration

```bash
# Option A: Using Supabase CLI (Recommended)
supabase db push

# Option B: Manual via Supabase Dashboard
# 1. Go to Supabase Dashboard > SQL Editor
# 2. Copy contents of supabase/migrations/add-auto-email-generation-trigger.sql
# 3. Run the SQL
```

**Verification:**
- [ ] Migration ran without errors
- [ ] `handle_new_user()` function updated
- [ ] `middle_name` column exists in users table
- [ ] Existing users have email addresses generated

**Rollback Plan:**
If migration fails, restore from backup.

---

### Step 2: Deploy Edge Function

```bash
# Deploy the updated resend-inbox function
supabase functions deploy resend-inbox
```

**Verification:**
- [ ] Function deployed successfully
- [ ] Function logs show no errors
- [ ] Test function with: `supabase functions invoke resend-inbox --data '{"action":"list","options":{"limit":1}}'`

**Rollback Plan:**
Redeploy previous version of function.

---

### Step 3: Deploy Frontend Changes

```bash
# Build production bundle
npm run build

# Deploy to your hosting platform
# (Vercel, Netlify, etc.)
```

**Verification:**
- [ ] Build completed without errors
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Bundle size reasonable

---

## 🧪 Post-Deployment Testing

### Test 1: New User Registration

- [ ] Register a new test user
  - First name: "Test"
  - Middle name: "Email"
  - Last name: "User"
- [ ] Verify email address generated: `teuser@gritsync.com`
- [ ] Check user can login
- [ ] Navigate to `/client/emails`
- [ ] Verify email address displays correctly

### Test 2: Email Filtering

- [ ] Login as test client user
- [ ] Navigate to `/client/emails`
- [ ] Check Inbox tab
  - [ ] Only shows emails TO client's address
  - [ ] No other users' emails visible
- [ ] Check Sent tab
  - [ ] Only shows emails FROM client's address
  - [ ] No other users' emails visible

### Test 3: Email Sending

- [ ] Click "Compose Email"
- [ ] Verify from address is pre-filled and disabled
- [ ] Enter recipient email: your-email@example.com
- [ ] Enter subject: "Test Email from Client"
- [ ] Enter body: "This is a test email from the client portal"
- [ ] Click "Send Email"
- [ ] Verify success message appears: ✅
- [ ] Check Sent tab for email
- [ ] Verify email received at recipient

### Test 4: Error Handling

**Test Invalid Email:**
- [ ] Try to send email with invalid format
- [ ] Verify error message: ⚠️ "Please enter a valid email address"

**Test Empty Fields:**
- [ ] Try to send email with empty subject
- [ ] Verify error message: ⚠️ "Please fill in all required fields"

**Test Network Error:**
- [ ] Disconnect internet
- [ ] Try to load inbox
- [ ] Verify friendly error message
- [ ] Reconnect and verify recovery

### Test 5: Existing Users

- [ ] Check existing client users
- [ ] Verify they have email addresses
- [ ] If missing, manually run:
  ```sql
  SELECT create_client_email_address('user-id-here');
  ```

---

## 🔍 Monitoring

### Initial Monitoring (First 24 Hours)

- [ ] Check Supabase logs for errors
- [ ] Monitor Resend dashboard for delivery rates
- [ ] Check browser console for frontend errors
- [ ] Review user feedback/support tickets
- [ ] Monitor server response times

### Metrics to Track

- [ ] Email generation success rate
- [ ] Email send success rate
- [ ] Email delivery rate
- [ ] User error reports
- [ ] Page load times

---

## 🐛 Known Issues & Workarounds

### Issue 1: Email Address Already Exists

**Symptoms:** User registration fails with duplicate email error

**Cause:** Email address collision (rare but possible)

**Workaround:**
1. System automatically adds number suffix
2. If fails, manually assign: `jsmith2@gritsync.com`

### Issue 2: No Email Address Generated

**Symptoms:** User has no email address after registration

**Cause:** Missing first_name or last_name in registration

**Workaround:**
1. Add names to user profile
2. Run: `SELECT create_client_email_address(user_id);`

### Issue 3: Cannot Send Emails

**Symptoms:** "Email service not configured" error

**Cause:** Resend API key not set or invalid

**Workaround:**
1. Check Resend API key in settings
2. Verify domain in Resend dashboard
3. Re-save settings to refresh

---

## 🔄 Rollback Plan

If critical issues occur, follow this rollback procedure:

### Step 1: Identify Issue

- [ ] Document the error/issue
- [ ] Check logs for error messages
- [ ] Determine if frontend or backend issue

### Step 2: Rollback Frontend (if needed)

```bash
# Redeploy previous version
git checkout <previous-commit>
npm run build
# Deploy to hosting platform
```

### Step 3: Rollback Backend (if needed)

```bash
# Redeploy previous edge function version
supabase functions deploy resend-inbox
```

### Step 4: Rollback Database (if needed)

```sql
-- Restore from backup
-- Or manually revert changes if minor
```

### Step 5: Verify

- [ ] Site is accessible
- [ ] No errors in console
- [ ] Users can login
- [ ] Core functionality works

---

## 📞 Support Contacts

### If Issues Occur

1. **Check Documentation:**
   - CLIENT_EMAILS_IMPLEMENTATION.md
   - CLIENT_EMAILS_QUICK_START.md
   - This checklist

2. **Check Logs:**
   - Supabase Dashboard > Logs
   - Browser Console
   - Resend Dashboard

3. **Contact:**
   - System Administrator
   - Technical Support Team
   - Development Team

---

## ✅ Final Verification

After deployment is complete:

- [ ] All tests passed
- [ ] No critical errors in logs
- [ ] Documentation accessible
- [ ] Support team briefed
- [ ] Monitoring in place
- [ ] Rollback plan ready
- [ ] Stakeholders notified

---

## 🎉 Deployment Complete!

Once all items are checked:

- [ ] Mark deployment as successful
- [ ] Update project status
- [ ] Document any issues encountered
- [ ] Share documentation with team
- [ ] Schedule follow-up review (1 week)

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Verified By:** _____________  
**Status:** ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back

---

## 📝 Notes

Use this section to document any observations, issues, or special considerations during deployment:

```
[Add your notes here]
```

---

**Good luck with the deployment! 🚀**

