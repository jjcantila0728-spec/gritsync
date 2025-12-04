# 🔧 Fix Login Issues - Step by Step

If you can't login after creating Supabase tables, follow these steps:

## Problem
The user exists in `auth.users` but not in `public.users`, so the app can't load the user profile.

## Solution

### Step 1: Run the Fix Script

1. **Open Supabase SQL Editor**
   ```
   https://supabase.com/dashboard/project/warfdcbvnapietbkpild/sql/new
   ```

2. **Copy and Run Fix Script**
   - Open `fix-user-login.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click **"Run"**

This will:
- ✅ Recreate the trigger that auto-creates user profiles
- ✅ Create profiles for existing auth users
- ✅ Fix permissions

### Step 2: Verify Your User Profile

1. **Check if you exist in auth.users**
   - Go to: Dashboard > Authentication > Users
   - Find your email
   - Copy your **User UID**

2. **Check if profile exists**
   - Go to SQL Editor
   - Run:
     ```sql
     SELECT * FROM users WHERE id = 'paste-your-uid-here';
     ```
   - If it returns a row, you're good!
   - If empty, the fix script should have created it

### Step 3: Test Login

1. **Clear browser data** (optional)
   - Clear cookies/localStorage for localhost

2. **Try logging in**
   - Go to: http://localhost:5173/login
   - Use your email and password

3. **If still not working**, check browser console for errors

## Alternative: Manual Profile Creation

If the fix script doesn't work, create your profile manually:

1. **Get your User UID**
   - Dashboard > Authentication > Users
   - Copy your User UID

2. **Create Profile**
   - Go to SQL Editor
   - Run:
     ```sql
     INSERT INTO public.users (id, email, role, created_at, updated_at)
     VALUES (
       'paste-your-uid-here',
       'your-email@example.com',
       'client',
       NOW(),
       NOW()
     )
     ON CONFLICT (id) DO UPDATE
     SET email = EXCLUDED.email;
     ```

3. **Make yourself admin** (optional)
   ```sql
   UPDATE users SET role = 'admin' WHERE id = 'your-uid-here';
   ```

## Diagnostic Queries

If you want to check what's wrong, use `check-user-issues.sql`:

1. Open `check-user-issues.sql`
2. Replace `'your-email@example.com'` with your email
3. Run each query to see what's missing

## Common Issues

### Issue: "User not found"
- **Cause**: Profile doesn't exist in `public.users`
- **Fix**: Run `fix-user-login.sql`

### Issue: "Permission denied"
- **Cause**: RLS policies blocking access
- **Fix**: Verify RLS policies are correct (they should be in schema.sql)

### Issue: "Trigger not working"
- **Cause**: Trigger not created or permissions wrong
- **Fix**: Run `fix-user-login.sql` to recreate trigger

### Issue: Can login but can't see data
- **Cause**: RLS policies too restrictive
- **Fix**: Check that policies allow users to view their own data

## Still Not Working?

1. **Check Browser Console**
   - Open DevTools (F12)
   - Look for errors in Console tab

2. **Check Supabase Logs**
   - Dashboard > Logs
   - Look for errors

3. **Verify Environment Variables**
   - Check `.env` file has:
     ```
     VITE_SUPABASE_URL=https://warfdcbvnapietbkpild.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```

4. **Test Connection**
   - Visit: http://localhost:5173/test-supabase
   - Check if database connection works

## Quick Fix (All-in-One)

Run this in SQL Editor to fix everything at once:

```sql
-- 1. Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Create profiles for existing users
INSERT INTO public.users (id, email, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  'client' as role,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Fix permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;
```

Then try logging in again!

