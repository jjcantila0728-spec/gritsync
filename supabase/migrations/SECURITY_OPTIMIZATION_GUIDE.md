# Security Optimization to MVP - Application Guide

This guide explains how to apply the MVP security optimization migration to your Supabase database.

## 📋 Overview

The `optimize-security-mvp.sql` migration consolidates and simplifies your security setup by:

- ✅ Creating a unified admin check function (avoids RLS recursion)
- ✅ Standardizing all RLS policies with consistent naming
- ✅ Reducing policy complexity while maintaining security
- ✅ Ensuring proper grants and permissions
- ✅ Covering all tables including newer ones (sponsorships, donations, careers)

## 🚀 Quick Start

### Step 1: Backup Your Database (Recommended)

Before running any migration, it's always good practice to backup your database:

1. Go to Supabase Dashboard → Settings → Database
2. Click "Backup" or use pg_dump if you have CLI access

### Step 2: Run the Migration

1. Open **Supabase Dashboard** → **SQL Editor**
2. Open the file: `supabase/migrations/optimize-security-mvp.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

**Expected Time**: 30-60 seconds

### Step 3: Verify the Migration

1. In the same SQL Editor, open: `supabase/migrations/verify-security-optimization.sql`
2. Copy and run the verification script
3. Review the results:
   - ✅ All checks should show "GOOD" or "ENABLED"
   - ⚠️ Any warnings should be reviewed
   - ❌ Any errors need to be addressed

## 📊 What This Migration Does

### Before (Complex)
- Multiple admin check functions (`is_admin()`, `is_admin_user()`)
- Inconsistent policy naming
- Some policies query `users` table (potential recursion)
- Redundant policies across tables
- Inconsistent grant patterns

### After (MVP Optimized)
- ✅ Single unified `is_admin()` function using `auth.users`
- ✅ Standardized naming: `{table}_{action}_{role}`
- ✅ No RLS recursion (uses `auth.users` directly)
- ✅ Minimal, focused policies per table
- ✅ Consistent grants across all tables

## 🔍 Key Changes

### 1. Unified Admin Function

**Before:**
```sql
-- Multiple functions, some causing recursion
CREATE FUNCTION is_admin() ... -- queries public.users
CREATE FUNCTION is_admin_user() ... -- queries auth.users
```

**After:**
```sql
-- Single function, no recursion
CREATE FUNCTION is_admin() ... -- queries auth.users only
CREATE FUNCTION is_admin_user() ... -- alias to is_admin()
```

### 2. Standardized Policies

**Before:**
```sql
CREATE POLICY "Users can view their own profile" ...
CREATE POLICY "Admins can view all users" ...
```

**After:**
```sql
CREATE POLICY "users_select_own" ...
CREATE POLICY "users_select_admin" ...
```

### 3. Simplified Structure

Each table now has a consistent pattern:
- `{table}_select_own` - Users access their own data
- `{table}_select_admin` - Admins access all data
- `{table}_insert_own` - Users create their own data
- `{table}_update_own` - Users update their own data
- `{table}_*_admin` - Admin policies for management

## 📝 Tables Covered

### Core Tables
- ✅ `users`
- ✅ `applications`
- ✅ `quotations`
- ✅ `user_details`
- ✅ `user_documents`
- ✅ `application_payments`
- ✅ `receipts`
- ✅ `processing_accounts`
- ✅ `application_timeline_steps`
- ✅ `notifications`
- ✅ `settings`
- ✅ `services`
- ✅ `password_reset_tokens`

### Newer Tables (Conditional)
- ✅ `nclex_sponsorships` (if exists)
- ✅ `donations` (if exists)
- ✅ `careers` (if exists)
- ✅ `career_applications` (if exists)
- ✅ `partner_agencies` (if exists)

## ⚠️ Important Notes

### 1. This Migration is Destructive
- **Drops all existing policies** before creating new ones
- This is intentional to ensure a clean, consistent state
- Your data is **NOT affected** - only policies are changed

### 2. Anonymous Access
- Public features (quotations, donations, sponsorships) maintain anonymous access
- Recent records (last 5 minutes) are viewable by anonymous users for post-insert selects

### 3. Admin Role
- Admin check uses `auth.users.raw_user_meta_data->>'role' = 'admin'`
- Ensure your admin users have this metadata set correctly

### 4. Service Role
- Service role can still insert users (for triggers)
- System can insert notifications (for automated processes)

## 🔧 Troubleshooting

### Issue: "Function is_admin() does not exist"
**Solution**: The migration creates this function. Ensure you ran the entire migration script.

### Issue: "Permission denied" errors
**Solution**: Check that grants were applied. Re-run the GRANT statements from the migration.

### Issue: "Policy already exists"
**Solution**: The migration drops all policies first. If you see this, the drop section may have failed. Check for errors in the DROP section.

### Issue: Admin policies not working
**Solution**: 
1. Verify admin users have `raw_user_meta_data->>'role' = 'admin'` in `auth.users`
2. Test the function: `SELECT public.is_admin();`
3. Check policy definitions in Supabase Dashboard → Authentication → Policies

## ✅ Post-Migration Checklist

After running the migration, verify:

- [ ] All tables have RLS enabled
- [ ] Admin functions exist and work
- [ ] Users can access their own data
- [ ] Admins can access all data
- [ ] Anonymous users can create/view public features
- [ ] No 403 errors in application
- [ ] Verification script passes all checks

## 🔄 Rollback (If Needed)

If you need to rollback, you'll need to:

1. Restore from backup, OR
2. Re-run your original schema/migration files

**Note**: The migration is designed to be safe and non-destructive to data. Only policies are changed.

## 📚 Related Files

- `supabase/migrations/optimize-security-mvp.sql` - The main migration
- `supabase/migrations/verify-security-optimization.sql` - Verification script
- `supabase/schema.sql` - Base schema (may need updates after this migration)

## 🎯 Next Steps

After applying this migration:

1. ✅ Run the verification script
2. ✅ Test your application thoroughly
3. ✅ Verify admin access works
4. ✅ Check anonymous/public features work
5. ✅ Monitor for any 403 errors

## 💡 Tips

- Run this migration during a low-traffic period
- Test in a staging environment first if possible
- Keep the verification script results for reference
- Document any custom policies you add later

---

**Questions?** Check the verification script output or review the migration file comments.

