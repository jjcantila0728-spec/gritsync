# Diagnosing 403 Error on User Query

## The Error

You provided this URL from an error message:
```
warfdcbvnapietbkpild.supabase.co/rest/v1/users?select=*&id=eq.03a0bd9f-c3e3-4b1d-ab74-93318b295f50:1
```

**Note:** The `:1` at the end is likely a line number from the error message, not part of the actual query. The real query is:
```
warfdcbvnapietbkpild.supabase.co/rest/v1/users?select=*&id=eq.03a0bd9f-c3e3-4b1d-ab74-93318b295f50
```

## Diagnosis Results

I ran a diagnostic test and found:
- ❌ Query returns 0 rows (user not found or blocked by RLS)
- ⚠️ No active session (can't test RLS properly without authentication)

## Possible Causes

1. **User profile doesn't exist** in `public.users` table
2. **RLS policies blocking** the query (user not authenticated or policy misconfigured)
3. **User exists in `auth.users` but not in `public.users`** (missing profile)

## Solution Steps

### Step 1: Verify User Exists

Run `VERIFY_USER_AND_RLS.sql` in Supabase SQL Editor to check:
- If user exists in `auth.users`
- If user exists in `public.users`
- Current RLS policies
- Test RLS as that user

### Step 2: Fix RLS Policies

Run `FIX_LOGIN_403_UPDATED.sql` in Supabase SQL Editor. This script:
- ✅ Recreates RLS policies correctly
- ✅ Updates trigger function to match migration (first_name, last_name, grit_id)
- ✅ Creates missing user profiles
- ✅ Updates auth metadata with roles

### Step 3: Test the Query

After running the fix, test the query:

1. **In Supabase SQL Editor:**
```sql
-- Test as the specific user
SET request.jwt.claim.sub = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
SELECT * FROM users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
RESET request.jwt.claim.sub;
```

2. **In your application:**
   - Log in as that user
   - Check browser console for errors
   - Verify user profile loads

### Step 4: Run Diagnostic Script

Run the Node.js diagnostic script:
```bash
node test-user-query.js
```

This will test:
- Service role query (bypasses RLS)
- Anon key query (subject to RLS)
- Authentication status

## Files Created

1. **`test-user-query.js`** - Diagnostic script to test the query
2. **`VERIFY_USER_AND_RLS.sql`** - SQL to verify user exists and check RLS
3. **`FIX_LOGIN_403_UPDATED.sql`** - Updated fix compatible with migration

## Quick Fix

If you just need to quickly fix the 403 error:

1. Open Supabase SQL Editor
2. Run `FIX_LOGIN_403_UPDATED.sql`
3. Verify with `VERIFY_USER_AND_RLS.sql`
4. Test login in your application

## Common Issues

### Issue: User exists in auth.users but not in public.users
**Fix:** The `FIX_LOGIN_403_UPDATED.sql` script will automatically create missing profiles.

### Issue: RLS policies not working
**Fix:** Make sure you run the fix script as a user with sufficient permissions (usually `postgres` or `service_role`).

### Issue: Still getting 403 after fix
**Check:**
1. User is logged in (has active session)
2. User ID matches the query ID
3. RLS policies are active: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'users';`
4. Policies exist: `SELECT policyname FROM pg_policies WHERE tablename = 'users';`









