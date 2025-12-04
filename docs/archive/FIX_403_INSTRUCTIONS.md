# Fix 403 Errors - Complete Instructions

## Problem
You're getting 403 Forbidden errors when trying to access the `users` table:
- `GET /rest/v1/users?select=avatar_path&id=eq.xxx 403 (Forbidden)`
- `GET /rest/v1/users?select=*&role=eq.client&order=created_at.desc 403 (Forbidden)`
- `Error: permission denied for table users`

## Root Cause
The Row Level Security (RLS) policies are blocking access because:
1. Admin role is not set correctly in `auth.users.raw_user_meta_data`
2. RLS policies may be missing or incorrectly configured
3. Database grants may be missing

## Solution

### Step 0: Diagnose the Problem (Optional but Recommended)
1. Open Supabase Dashboard → SQL Editor
2. Run `DIAGNOSE_403_ERRORS.sql` to see the current state
3. This will show you what's wrong before fixing it

### Step 1: Run the SQL Fix Script
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `COMPLETE_FIX_403_ERRORS.sql`
3. **IMPORTANT**: If you have a specific user ID you want to fix, you can uncomment and modify the specific user update line (around line 30)
4. Run the entire script
5. Check the verification queries at the end - they should show:
   - 6 policies created on the `users` table
   - Admin role synced between `auth.users` and `public.users`
   - `is_admin_check` returning `true` for admin users

### Step 2: Refresh Your Session (CRITICAL!)
**⚠️ THIS IS THE MOST IMPORTANT STEP - DO NOT SKIP!**

After running the SQL script, you **MUST** refresh your browser session. The JWT token contains the role information, and it won't update until you refresh.

**RECOMMENDED: Log Out and Log Back In**
- This is the most reliable method
- Log out of the application completely
- Close the browser tab/window
- Open a new tab and log back in
- This ensures the JWT token is refreshed with the updated role metadata

**Alternative: Hard Refresh**
- Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- Or clear browser cache completely and reload
- Note: This may not always work - if 403 errors persist, use the log out method above

### Step 3: Verify the Fix
1. Open browser DevTools (F12)
2. Go to the Console tab
3. Navigate to `/admin/clients` page
4. Check that:
   - No 403 errors appear for `users` table queries
   - No 403 errors appear for `application_payments` table queries
   - Client data loads successfully
   - Avatar images load (if applicable)
   - Dashboard stats load without errors

**If you still see 403 errors:**
- Make sure you logged out and logged back in (Step 2)
- Run `DIAGNOSE_403_ERRORS.sql` again to check the current state
- Verify your user ID has admin role in both `auth.users` and `public.users`

## What the Script Does

1. **Syncs Admin Roles**: Ensures all users with `role='admin'` in `public.users` also have `role='admin'` in `auth.users.raw_user_meta_data`

2. **Fixes RLS Policies on `users` Table**: 
   - Drops all existing policies
   - Creates 6 new policies:
     - Users can view their own profile
     - Users can update their own profile
     - Users can insert their own profile
     - Admins can view all users
     - Admins can update all users
     - Service role can insert users

3. **Fixes RLS Policies on `application_payments` Table**: 
   - Drops all existing policies
   - Creates 5 new policies:
     - Users can view their own payments
     - Admins can view all payments (for dashboard stats)
     - Users can insert their own payments
     - Users can update their own payments
     - Admins can update all payments

4. **Grants Permissions**: 
   - Grants schema usage to authenticated users
   - Grants SELECT, INSERT, UPDATE on `users` table
   - Grants SELECT, INSERT, UPDATE on `application_payments` table

5. **Creates Helper Function**: 
   - Creates `is_admin()` function for easier admin checks

## Troubleshooting

### If 403 errors persist after running the script:

1. **Check if policies were created**:
   ```sql
   SELECT policyname FROM pg_policies WHERE tablename = 'users';
   ```
   Should return 6 policies.

2. **Verify admin role in auth.users**:
   ```sql
   SELECT id, email, raw_user_meta_data->>'role' as role
   FROM auth.users 
   WHERE raw_user_meta_data->>'role' = 'admin';
   ```

3. **Check if grants are in place**:
   ```sql
   SELECT grantee, privilege_type 
   FROM information_schema.role_table_grants 
   WHERE table_name = 'users' AND grantee = 'authenticated';
   ```

4. **Force session refresh**: 
   - Clear browser cache completely
   - Log out and log back in
   - Or use incognito/private browsing mode

### If you see "policy already exists" errors:
The script includes a section that drops all existing policies first, so this shouldn't happen. If it does, manually drop the policy:
```sql
DROP POLICY IF EXISTS "Policy Name" ON users;
```

## Notes

- The RLS policies check `auth.users.raw_user_meta_data->>'role'` directly to avoid RLS recursion
- Both `auth.users` and `public.users` should have the admin role set for consistency
- The script is idempotent - you can run it multiple times safely

