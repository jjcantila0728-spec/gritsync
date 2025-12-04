# 🚨 EMERGENCY FIX: 403 Error Still Happening

## The Problem
You're still getting 403 errors even after running the SQL fix. This means either:
1. The policies weren't created correctly
2. The user profile doesn't exist
3. There's a permission issue

## IMMEDIATE FIX (Run This Now)

### Step 1: Run the Diagnostic & Fix Script
1. Open Supabase SQL Editor
2. Open `DIAGNOSE_AND_FIX_403.sql`
3. Copy the **ENTIRE** file
4. Paste and run it
5. **Check the output** - it will show you what's wrong

### Step 2: Check the Results
After running, look at the output. You should see:
- ✅ User exists in auth.users
- ✅ User exists in public.users (if not, the script creates it)
- ✅ RLS is enabled
- ✅ 6 policies created

### Step 3: If User Profile is Missing
If the diagnostic shows the user doesn't exist in `public.users`, the script will create it automatically. But if you need to manually create it, run:

```sql
-- Replace with your actual user ID
INSERT INTO public.users (id, email, role, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client'),
  generate_grit_id(),
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = COALESCE(EXCLUDED.role, users.role),
  updated_at = NOW();
```

### Step 4: Clear Browser Cache
1. **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Or **clear cache**: Ctrl+Shift+Delete → Clear browsing data
3. Or use **Incognito/Private mode**

### Step 5: Sign Out and Sign Back In
1. Sign out completely
2. Close the browser tab
3. Open a new tab
4. Sign in again

## If Still Not Working

### Check 1: Verify Policies Exist
Run this in Supabase SQL Editor:
```sql
SELECT policyname, cmd, roles::text 
FROM pg_policies 
WHERE tablename = 'users';
```

You MUST see:
- "Users can view their own profile" (SELECT)
- "Users can update their own profile" (UPDATE)
- "Admins can view all users" (SELECT)
- "Admins can update all users" (UPDATE)
- "Service role can insert users" (INSERT)
- "Users can insert their own profile" (INSERT)

### Check 2: Verify User Profile
```sql
SELECT * FROM public.users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
```

This MUST return a row. If it doesn't, the profile is missing.

### Check 3: Test RLS Directly
```sql
-- This simulates what happens when the user tries to read their profile
SET request.jwt.claim.sub = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
SELECT * FROM users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
RESET request.jwt.claim.sub;
```

If this returns no rows, the RLS policy isn't working.

### Check 4: Check if RLS is Actually Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
```

`rowsecurity` should be `true`.

## Nuclear Option: Temporarily Disable RLS (NOT RECOMMENDED FOR PRODUCTION)

**⚠️ WARNING: Only use this for testing/debugging. Re-enable RLS immediately after.**

```sql
-- Disable RLS temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Test if it works now
-- If it does, the issue is with the policies

-- RE-ENABLE RLS IMMEDIATELY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Then recreate policies using DIAGNOSE_AND_FIX_403.sql
```

## Common Issues

### Issue: "Policy already exists" error
**Solution:** The script uses `DROP POLICY IF EXISTS`, so this shouldn't happen. If it does, manually drop all policies first:
```sql
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;
```

### Issue: "Function generate_grit_id() does not exist"
**Solution:** The script creates it, but if you get this error, run just the function creation part first.

### Issue: User profile exists but still 403
**Solution:** 
1. Check that `auth.uid()` matches the user ID
2. Verify the policy uses `auth.uid() = id` (not `auth.uid() = users.id`)
3. Make sure you're actually authenticated (check browser console for session)

## Still Stuck?

If none of this works, the issue might be:
1. **Supabase project configuration** - Check project settings
2. **API keys** - Verify you're using the correct anon key
3. **Network/CORS issues** - Check browser network tab
4. **Supabase service issue** - Check Supabase status page

Share the diagnostic output and I can help further!







