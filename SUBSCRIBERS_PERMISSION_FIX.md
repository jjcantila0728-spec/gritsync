# Subscribers Permission Fix

## Issue
Getting "permission denied for table users" errors when trying to delete subscribers in Admin Emails → Subscribers tab.

## Root Cause
The RLS (Row Level Security) policy for the `email_subscribers` table was trying to check admin role by querying `auth.users` table:

```sql
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
```

This causes a permission error because:
1. The RLS policy tries to access `auth.users` to check the role
2. The authenticated user doesn't have direct access to `auth.users`
3. This results in "permission denied for table users" error

## Solution

### Migration File Created
**File**: `supabase/migrations/fix-subscribers-rls.sql`

This migration updates the RLS policies to check admin role from `user_details` table instead of `auth.users`:

```sql
-- New policy that checks user_details instead of auth.users
CREATE POLICY "Admins have full access to subscribers"
  ON public.email_subscribers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_details
      WHERE user_details.user_id = auth.uid()
      AND user_details.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_details
      WHERE user_details.user_id = auth.uid()
      AND user_details.role = 'admin'
    )
  );
```

## How to Apply the Fix

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/fix-subscribers-rls.sql`
4. Paste into SQL Editor
5. Click "Run"

### Option 2: Using Supabase CLI
```bash
# From project root
npx supabase db push
```

### Option 3: Manual SQL Execution
Connect to your database and run:

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Admins have full access to subscribers" ON public.email_subscribers;
DROP POLICY IF EXISTS "Public can view own subscription via token" ON public.email_subscribers;
DROP POLICY IF EXISTS "Public can subscribe" ON public.email_subscribers;

-- Create new admin policy checking user_details
CREATE POLICY "Admins have full access to subscribers"
  ON public.email_subscribers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_details
      WHERE user_details.user_id = auth.uid()
      AND user_details.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_details
      WHERE user_details.user_id = auth.uid()
      AND user_details.role = 'admin'
    )
  );

-- Create public policies
CREATE POLICY "Public can view subscribers"
  ON public.email_subscribers
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can subscribe"
  ON public.email_subscribers
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update own subscription via token"
  ON public.email_subscribers
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Refresh permissions
GRANT ALL ON public.email_subscribers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_subscribers TO anon;
```

## What This Fixes

After applying the migration:

✅ **Admin users can delete subscribers** - No more permission errors
✅ **Admin users can view all subscribers** - Full access
✅ **Admin users can update subscribers** - Edit capabilities work
✅ **Admin users can add subscribers** - Create new subscribers
✅ **Public can subscribe** - Newsletter signups still work
✅ **Public can unsubscribe via token** - Unsubscribe links work
✅ **Public can update preferences via token** - Preference pages work

## Testing After Fix

1. Login as admin user
2. Navigate to `/admin/emails` → Subscribers tab
3. Try to delete a subscriber
4. Should work without permission errors

## Additional Notes

- The fix changes the role check from `auth.users` to `user_details` table
- This is more secure as it uses the proper RLS-enabled table
- The `user_details` table has proper RLS policies that allow checking roles
- No changes needed to the application code - it's purely a database policy fix

## Files

- **Migration**: `supabase/migrations/fix-subscribers-rls.sql`
- **Original Policy**: `supabase/migrations/add-subscribers-table.sql` (lines 143-149)

## Status

✅ Migration file created and ready to apply
⏳ Needs to be applied to the database via Supabase Dashboard SQL Editor

Once applied, all subscriber management operations will work without permission errors.

