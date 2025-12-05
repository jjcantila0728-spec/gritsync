# Tracking Setup - Complete Migration Guide

## Overview
The tracking feature has been migrated to use Supabase directly without any server dependency. This ensures consistent results for both authenticated and public users.

## Changes Made

### 1. Removed Server Dependency
- ✅ Removed all calls to `http://localhost:3001/api/track`
- ✅ Tracking now uses Supabase client directly
- ✅ Works for both authenticated and public users

### 2. Updated Tracking API
- ✅ Direct Supabase queries for applications, timeline steps, payments, and processing accounts
- ✅ Client-side calculation of progress, next steps, and status
- ✅ Consistent logic for all users

### 3. RLS Policies Required
For public tracking to work, you need to apply RLS policies that allow anonymous access to tracking data.

## Migration Steps

### Step 1: Apply Public Tracking Policies

Run the migration file in Supabase SQL Editor:

```sql
-- File: supabase/migrations/add_public_tracking_policies.sql
```

This migration adds policies for:
- ✅ `applications` table - Public can track by ID or GRIT APP ID
- ✅ `application_timeline_steps` table - Public can view timeline steps
- ✅ `application_payments` table - Public can view payments (for progress calculation)
- ✅ `processing_accounts` table - Public can view processing accounts (for Gmail display)

### Step 2: Verify Policies

After running the migration, verify the policies were created:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename IN ('applications', 'application_timeline_steps', 'application_payments', 'processing_accounts')
  AND schemaname = 'public'
  AND policyname LIKE '%tracking%'
ORDER BY tablename, policyname;
```

You should see 4 policies:
1. `Public can track applications` on `applications`
2. `Public can view timeline steps for tracking` on `application_timeline_steps`
3. `Public can view payments for tracking` on `application_payments`
4. `Public can view processing accounts for tracking` on `processing_accounts`

### Step 3: Test Public Tracking

1. **Open tracking page in incognito/private window** (to test as anonymous user)
2. **Enter a tracking ID** (GRIT APP ID like `APNA06G6HMGLG4` or UUID)
3. **Verify the tracking result displays correctly**

### Step 4: Test Authenticated Tracking

1. **Log in to the application**
2. **Navigate to tracking page**
3. **Enter the same tracking ID**
4. **Verify results match** (should be identical to public tracking)

## Security Considerations

### What's Safe
- ✅ Public users can only query by specific ID (GRIT APP ID or UUID)
- ✅ They cannot list all applications
- ✅ They cannot modify any data (SELECT only)
- ✅ RLS policies restrict access to tracking data only

### What's Exposed
- ⚠️ Application status and progress information
- ⚠️ Timeline steps and payment status
- ⚠️ Processing account emails (Gmail)
- ⚠️ Picture URLs (if bucket is public)

**Note:** This is intentional for tracking functionality. Users need to know their tracking ID to access this information.

## Troubleshooting

### Issue: "Application not found" for public users

**Solution:** Ensure the public tracking policy is applied:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'applications' 
AND policyname = 'Public can track applications';
```

If it doesn't exist, run the migration again.

### Issue: Timeline steps not showing

**Solution:** Check if the timeline steps policy exists:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'application_timeline_steps' 
AND policyname = 'Public can view timeline steps for tracking';
```

### Issue: Payments not showing in progress calculation

**Solution:** Verify the payments policy:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'application_payments' 
AND policyname = 'Public can view payments for tracking';
```

### Issue: Different results for authenticated vs public users

**Solution:** 
1. Clear browser cache
2. Ensure both are using the same Supabase client
3. Check browser console for errors
4. Verify all policies are applied correctly

## Files Modified

1. **src/lib/supabase-api.ts**
   - Removed server API calls
   - Added direct Supabase queries
   - Implemented client-side tracking logic

2. **supabase/migrations/add_public_tracking_policies.sql** (NEW)
   - Adds all necessary RLS policies for public tracking

## Next Steps

1. ✅ Apply the migration: `supabase/migrations/add_public_tracking_policies.sql`
2. ✅ Verify policies are created
3. ✅ Test public tracking (incognito window)
4. ✅ Test authenticated tracking (logged in)
5. ✅ Verify results are identical

## Summary

The tracking feature is now fully migrated to Supabase with no server dependency. Both authenticated and public users will get identical results, and the system is simpler to maintain.

