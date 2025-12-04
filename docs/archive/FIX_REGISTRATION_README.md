# Fix Registration Error - "Database error saving new user"

## The Problem
When trying to register a new user, you get the error: "Database error saving new user"

## Root Cause
The registration process tries to create a user profile in the `public.users` table, but:
1. The `grit_id` field is required (NOT NULL) but wasn't being generated
2. The RLS policies might be blocking INSERT operations
3. The trigger function might not be working correctly

## Solution

### Step 1: Run the SQL Fix
Run `FIX_REGISTRATION_ERROR.sql` in Supabase SQL Editor. This will:
- ✅ Ensure `generate_grit_id()` function exists
- ✅ Fix INSERT policies to allow registration
- ✅ Fix the trigger function to create profiles with all required fields
- ✅ Ensure the trigger is active

### Step 2: Test Registration
1. Go to your registration page
2. Fill in the form
3. Submit
4. Registration should now work! ✅

## What Was Fixed

### Code Changes
- Updated `AuthContext.tsx` to wait for the trigger to create the profile
- Changed from trying to insert/upsert to checking if profile exists first
- Better error handling if the trigger fails

### Database Changes
- Fixed trigger function to always generate `grit_id`
- Fixed INSERT policies to allow users to create their own profiles
- Ensured trigger is active and working

## Verification

After running the fix, test registration:
1. Try registering a new user
2. Check that the user profile is created
3. Check that `grit_id` is generated
4. Check that you can log in with the new account

## If Still Not Working

1. **Check trigger exists:**
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'users' AND trigger_schema = 'auth';
```

2. **Check INSERT policies:**
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';
```

Should see:
- "Service role can insert users"
- "Users can insert their own profile"

3. **Check function exists:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'generate_grit_id';
```

4. **Test trigger manually:**
```sql
-- This should create a test user profile
-- (Don't actually run this unless testing)
```

## Common Issues

### Issue: "grit_id is required"
**Fix:** The trigger should generate it. Make sure `generate_grit_id()` function exists and the trigger is active.

### Issue: "Permission denied"
**Fix:** Make sure INSERT policies exist. Run `FIX_REGISTRATION_ERROR.sql` again.

### Issue: "Trigger not firing"
**Fix:** Check that the trigger exists and is active. The fix script recreates it.







