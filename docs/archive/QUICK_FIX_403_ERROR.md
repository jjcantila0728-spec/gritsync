# Quick Fix for 403 Error - Step by Step

## The Problem
You're getting 403 errors when trying to load user profiles:
```
warfdcbvnapietbkpild.supabase.co/rest/v1/users?select=*&id=eq.03a0bd9f-c3e3-4b1d-ab74-93318b295f50
Failed to load resource: the server responded with a status of 403
```

## Immediate Fix Steps

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: `warfdcbvnapietbkpild`
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Fix Script
1. Click **New Query**
2. Open the file `FIX_LOGIN_403_UPDATED.sql` from your project
3. Copy the **ENTIRE** contents
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for "Success. No rows returned" message

### Step 3: Verify the Fix Worked
Run this query in SQL Editor:

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

### Step 4: Check if User Profile Exists
Run this query:

```sql
-- Check if user exists
SELECT 
  'auth.users' as source,
  id,
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'

UNION ALL

SELECT 
  'public.users' as source,
  id,
  email,
  role
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
```

**If user exists in `auth.users` but NOT in `public.users`:**
The fix script should have created it. If not, run this:

```sql
-- Manually create missing profile
INSERT INTO public.users (id, email, role, first_name, last_name, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client') as role,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data->>'first_name', '')), '') as first_name,
  NULLIF(TRIM(COALESCE(au.raw_user_meta_data->>'last_name', '')), '') as last_name,
  generate_grit_id() as grit_id,
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
ON CONFLICT (id) DO NOTHING;
```

### Step 5: Test in Your Application
1. **Clear browser cache and cookies** (important!)
2. **Close and reopen your browser** (or use incognito mode)
3. Try logging in again
4. Check browser console (F12) - the 403 error should be gone

## If Still Getting 403 Error

### Check 1: Verify RLS is Enabled
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
```
Should return `rowsecurity = true`

### Check 2: Verify User is Authenticated
In your browser console, check if you have a session:
```javascript
// Run this in browser console
const { data } = await supabase.auth.getSession()
console.log('Session:', data.session)
console.log('User ID:', data.session?.user?.id)
```

The user ID should match: `03a0bd9f-c3e3-4b1d-ab74-93318b295f50`

### Check 3: Test RLS Policy Directly
Run this in Supabase SQL Editor (this simulates being logged in as that user):
```sql
-- This will show if the policy works (when run with service role, it bypasses RLS)
-- But it helps verify the user exists
SELECT id, email, role FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
```

## Common Issues

### Issue: "generate_grit_id() function does not exist"
**Solution:** Run `MIGRATE_USERS_TABLE.sql` first, then run `FIX_LOGIN_403_UPDATED.sql`

### Issue: Policies exist but still getting 403
**Solution:** 
1. Make sure you're logged in (check browser console for session)
2. Clear browser cache
3. Try logging out and back in

### Issue: User doesn't exist in auth.users
**Solution:** The user needs to register/login first. The profile is created automatically on first login.

## Still Having Issues?

Run the diagnostic script:
```bash
node test-user-query.js
```

This will show detailed information about what's wrong.









