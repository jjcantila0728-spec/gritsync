# 🚨 URGENT: Fix 403 Errors - Quick Instructions

## The Problem
You're getting 403 Forbidden errors when trying to load user profiles. This is caused by Row Level Security (RLS) policies blocking access.

## The Solution (2 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Run the Fix Script
1. Click **New Query**
2. Open the file `COMPLETE_FIX_403_ERROR.sql` from your project
3. Copy the **ENTIRE** contents (Ctrl+A, Ctrl+C)
4. Paste into the SQL Editor (Ctrl+V)
5. Click **Run** (or press Ctrl+Enter)
6. Wait for "Success" message

### Step 3: Test
1. Go back to your application
2. Refresh the page (F5)
3. Try logging in
4. The 403 errors should be gone! ✅

## What This Fix Does
- ✅ Creates/updates the `generate_grit_id()` function
- ✅ Fixes all RLS policies to allow users to read their own profiles
- ✅ Fixes admin policies to avoid recursion issues
- ✅ Creates missing user profiles for existing auth users
- ✅ Updates auth metadata with roles
- ✅ Ensures the trigger function works correctly

## If You Still See Errors
1. Check the browser console for any new error messages
2. Verify you ran the ENTIRE script (all steps)
3. Check if your user exists in both `auth.users` and `public.users` tables

## Verification Query (Optional)
Run this in Supabase SQL Editor to verify the fix worked:

```sql
-- Check if policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users';
```

You should see these policies:
- ✅ "Users can view their own profile" (SELECT)
- ✅ "Users can update their own profile" (UPDATE)
- ✅ "Admins can view all users" (SELECT)
- ✅ "Admins can update all users" (UPDATE)
- ✅ "Service role can insert users" (INSERT)
- ✅ "Users can insert their own profile" (INSERT)







