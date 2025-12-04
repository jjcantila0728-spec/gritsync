# Debugging Test Registration Failures

## The Problem
All E2E tests are failing with: "Database error saving new user"

## Root Cause Analysis

The error "Database error saving new user" is coming from Supabase when trying to sign up. This suggests:

1. **Trigger function is failing** - The `handle_new_user()` trigger might be throwing an error
2. **RLS policies blocking** - INSERT policies might not be configured correctly
3. **Missing function** - `generate_grit_id()` function might not exist
4. **Database constraint** - Some required field might be missing

## Quick Fix Steps

### Step 1: Verify Database Setup
Run this in Supabase SQL Editor:

```sql
-- Check if generate_grit_id function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'generate_grit_id';

-- Check if trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' AND trigger_schema = 'auth';

-- Check INSERT policies
SELECT policyname, cmd, roles::text
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';
```

### Step 2: Run the Fix Scripts
If anything is missing, run:

1. `FIX_REGISTRATION_ERROR.sql` - Fixes trigger and policies
2. `SIMPLE_FIX_403.sql` - Fixes RLS policies

### Step 3: Test Manually
Try registering a user manually in your app to see the exact error.

### Step 4: Check Supabase Logs
1. Go to Supabase Dashboard
2. Navigate to Logs > Postgres Logs
3. Look for errors when trying to register

## Common Issues

### Issue: "function generate_grit_id() does not exist"
**Fix:** Run `FIX_REGISTRATION_ERROR.sql` - it creates the function

### Issue: "permission denied for table users"
**Fix:** Run `SIMPLE_FIX_403.sql` - it fixes INSERT policies

### Issue: "null value in column grit_id violates not-null constraint"
**Fix:** The trigger isn't running. Check:
1. Trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created'`
2. Trigger function exists: `SELECT * FROM information_schema.routines WHERE routine_name = 'handle_new_user'`
3. Run `FIX_REGISTRATION_ERROR.sql` to recreate both

### Issue: Trigger function error
**Fix:** Check the trigger function:
```sql
-- View the trigger function
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

## Test Fix

The test has been updated to:
- Wait longer for trigger (3 seconds instead of 2)
- Check if profile exists before updating
- Provide better error messages
- Log detailed error information

## Next Steps

1. Run the verification queries above
2. Fix any missing components
3. Run tests again: `npm run test:e2e:vitest`
4. Check Supabase logs if still failing







