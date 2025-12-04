# Fix Login 403 Error - Step by Step Instructions

## Problem
Users are getting a 403 Forbidden error when trying to log in. The error occurs when the app tries to load the user profile from the `users` table in Supabase.

**Error Message:**
```
warfdcbvnapietbkpild.supabase.co/rest/v1/users?select=*&id=eq.03a0bd9f-c3e3-4b1d-ab74-93318b295f50:1 
Failed to load resource: the server responded with a status of 403 ()
```

## Root Cause
The Row Level Security (RLS) policies on the `users` table are not properly configured, preventing authenticated users from reading their own profiles.

## Solution

### Step 1: Run the Fix SQL Script

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **New Query**
4. Copy the entire contents of `FIX_LOGIN_403.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

The script will:
- ✅ Recreate RLS policies with proper permissions
- ✅ Fix admin policies to avoid recursion
- ✅ Update the trigger function to set role in auth metadata
- ✅ Create missing user profiles for existing auth users
- ✅ Grant necessary permissions

### Step 2: Verify the Fix

After running the SQL script, verify it worked:

1. **Check if policies exist:**
```sql
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users';
```

You should see:
- "Users can view their own profile" (SELECT)
- "Users can update their own profile" (UPDATE)
- "Admins can view all users" (SELECT)
- "Admins can update all users" (UPDATE)
- "Service role can insert users" (INSERT)
- "Users can insert their own profile" (INSERT)

2. **Check if RLS is enabled:**
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
```

Should return `rowsecurity = true`

### Step 3: Test the Login

1. Go back to your application
2. Try logging in with your credentials
3. The login should now work without the 403 error

## What the Fix Does

### 1. RLS Policies
- **"Users can view their own profile"**: Allows authenticated users to SELECT their own row where `auth.uid() = id`
- **"Users can update their own profile"**: Allows authenticated users to UPDATE their own row
- **"Admins can view all users"**: Allows admins to SELECT all users (checks role from auth metadata to avoid recursion)
- **"Admins can update all users"**: Allows admins to UPDATE all users

### 2. Trigger Function
- Updates `handle_new_user()` to set the role in `auth.users.raw_user_meta_data`
- This prevents RLS recursion when checking if a user is an admin

### 3. User Profile Creation
- Creates profiles for any existing auth users who don't have profiles in `public.users`
- Updates auth metadata with roles for existing users

## Troubleshooting

### If you still get 403 errors:

1. **Check if the user profile exists:**
```sql
SELECT * FROM public.users WHERE id = 'your-user-id-here';
```

2. **Check if the user has a role in auth metadata:**
```sql
SELECT id, email, raw_user_meta_data->>'role' as role 
FROM auth.users 
WHERE id = 'your-user-id-here';
```

3. **Manually create the profile if missing:**
```sql
INSERT INTO public.users (id, email, role, created_at, updated_at)
VALUES ('your-user-id-here', 'user@example.com', 'client', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

4. **Check browser console** for more detailed error messages (the improved error logging will show more details)

### If policies don't apply:

Make sure you're running the SQL as a user with sufficient permissions (usually the `postgres` superuser or `service_role`).

## Additional Notes

- The fix includes improved error logging in `AuthContext.tsx` to help debug future issues
- The policies use `TO authenticated` to explicitly allow authenticated users
- Admin policies check `auth.users.raw_user_meta_data` instead of querying `public.users` to avoid RLS recursion

## Files Modified

1. **FIX_LOGIN_403.sql** - Complete SQL fix script
2. **src/contexts/AuthContext.tsx** - Improved error logging for debugging









