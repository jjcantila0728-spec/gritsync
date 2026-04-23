# Security Optimization - Quick Reference

## 🚀 Apply Migration

```sql
-- 1. Run in Supabase SQL Editor
-- File: supabase/migrations/optimize-security-mvp.sql
```

## ✅ Verify Migration

```sql
-- 2. Run verification
-- File: supabase/migrations/verify-security-optimization.sql
```

## 📋 What Changed

| Aspect | Before | After |
|--------|--------|-------|
| Admin Functions | Multiple, inconsistent | Single unified `is_admin()` |
| Policy Naming | Inconsistent | Standardized: `{table}_{action}_{role}` |
| RLS Recursion | Possible issues | Eliminated (uses `auth.users`) |
| Policy Count | Many redundant | Optimized MVP-level |
| Grants | Inconsistent | Standardized per table |

## 🔑 Key Functions

- `public.is_admin()` - Unified admin check (uses `auth.users`)
- `public.is_admin_user()` - Alias for backward compatibility

## 📊 Policy Pattern

Each table follows this pattern:

```sql
{table}_select_own      -- Users access own data
{table}_insert_own      -- Users create own data
{table}_update_own      -- Users update own data
{table}_select_admin    -- Admins view all
{table}_update_admin    -- Admins update all
{table}_delete_admin    -- Admins delete (if applicable)
```

## ⚠️ Important

- **Drops all existing policies** (clean slate approach)
- **Data is NOT affected** (only policies change)
- **Anonymous access preserved** for public features
- **Admin role** must be in `auth.users.raw_user_meta_data->>'role'`

## 🧪 Quick Test

```sql
-- Test admin function
SELECT public.is_admin();

-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'users';

-- Count policies
SELECT COUNT(*) 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 📁 Files

- `optimize-security-mvp.sql` - Main migration
- `verify-security-optimization.sql` - Verification
- `SECURITY_OPTIMIZATION_GUIDE.md` - Full guide

---

**Time to apply**: ~30-60 seconds  
**Risk level**: Low (policies only, no data changes)

