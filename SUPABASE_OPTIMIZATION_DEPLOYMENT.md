# Supabase Optimization Deployment Guide

This guide covers deploying the optimizations that minimize Supabase usage and reduce query overhead.

## Overview

The optimizations include:
1. **Batched Application Queries**: Applications list now fetches timeline steps and payments in batch instead of per-application
2. **Dashboard Stats RPC**: Single database function replaces multiple count queries
3. **Auth Caching**: Cached user ID lookups to reduce repeated `auth.getUser()` calls
4. **Shared Auth Helpers**: Reusable auth helpers across modules

## Deployment Steps

### Step 1: Deploy Database Function

**Priority: HIGH**

1. Log in to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/create-dashboard-stats-function.sql`
4. Click **Run** to execute the migration
5. Verify the function was created:
   ```sql
   SELECT routine_name, routine_type 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name = 'get_dashboard_stats';
   ```
   Expected: Should return 1 row with `get_dashboard_stats` function

**Expected Time**: 2-3 minutes

### Step 2: Verify Function Works

**Priority: HIGH**

Test the function with both admin and client contexts:

```sql
-- Test as admin (replace with actual admin user_id if needed)
-- The function reads role from JWT, so test via your app or:
SELECT * FROM get_dashboard_stats(true);

-- Test as client (will be scoped to current auth user)
SELECT * FROM get_dashboard_stats(false);
```

**Expected Results**:
- Admin call returns system-wide stats (all applications, quotations, clients, revenue)
- Client call returns user-scoped stats (only their applications, quotations, revenue)
- No errors in execution

**Expected Time**: 1-2 minutes

### Step 3: Verify Code Changes

**Priority: MEDIUM**

The following files have been updated:
- ✅ `src/lib/supabase-api.ts` - Batched queries, dashboard RPC, exported auth helpers
- ✅ `src/lib/email-service.ts` - Uses cached auth helper
- ✅ `src/lib/email-api.ts` - Uses cached auth helper
- ✅ `src/lib/email-signatures-api.ts` - Uses cached auth helper
- ✅ `src/lib/email-templates-api.ts` - Uses cached auth helper

**Verification**:
1. Build the project: `npm run build`
2. Check for TypeScript errors: `npm run type-check`
3. Run linter: `npm run lint`

**Expected Time**: 2-3 minutes

### Step 4: Test Application List

**Priority: HIGH**

1. Log in as both admin and client
2. Navigate to Applications page
3. Verify:
   - ✅ Applications load correctly
   - ✅ Timeline steps display properly
   - ✅ Payment information shows correctly
   - ✅ No console errors
   - ✅ Faster load times (especially with many applications)

**Expected Time**: 3-5 minutes

### Step 5: Test Dashboard Stats

**Priority: HIGH**

1. Log in as admin
2. Navigate to Dashboard
3. Verify:
   - ✅ All stats display correctly
   - ✅ Counts match actual data
   - ✅ Revenue calculation is correct
   - ✅ Completed applications include timeline-based completions
   - ✅ No console errors

4. Log in as client
5. Navigate to Dashboard
6. Verify:
   - ✅ Only user's stats are shown
   - ✅ Counts are correct for user's data
   - ✅ No console errors

**Expected Time**: 3-5 minutes

### Step 6: Monitor Performance

**Priority: LOW**

After deployment, monitor:
- Network tab: Should see fewer Supabase requests on Applications and Dashboard pages
- Load times: Should be faster, especially with many applications
- Supabase dashboard: Check query logs for reduced query counts

**Expected Time**: Ongoing

## Rollback Plan

If issues occur:

1. **Revert Code Changes**: 
   ```bash
   git revert <commit-hash>
   ```

2. **Keep Database Function**: The RPC function is backward compatible - the code will fall back to old queries if RPC fails

3. **No Data Migration Required**: All changes are query optimizations, no data changes

## Expected Improvements

### Before Optimization:
- Applications list: **N+2 queries** per application (1 app + 1 timeline + 1 payments)
- Dashboard stats: **9+ queries** (multiple counts + fallback queries)
- Auth calls: **Multiple per page load** (repeated `auth.getUser()`)

### After Optimization:
- Applications list: **3 queries total** (1 apps + 1 batch timeline + 1 batch payments)
- Dashboard stats: **1 query** (single RPC call with fallback)
- Auth calls: **Cached for 60 seconds** (reused across calls)

### Performance Gains:
- **Applications page**: ~70-90% reduction in queries (depends on number of applications)
- **Dashboard page**: ~85-90% reduction in queries
- **Auth overhead**: ~80-95% reduction in redundant calls

## Troubleshooting

### Issue: "function get_dashboard_stats does not exist"
**Solution**: Run the migration SQL in Step 1

### Issue: Dashboard stats show wrong numbers
**Solution**: 
1. Check RPC function exists: `SELECT * FROM get_dashboard_stats(true);`
2. Check function permissions (should be `security definer`)
3. Verify JWT claims include role metadata
4. Code will fall back to old queries automatically

### Issue: Applications list missing timeline data
**Solution**:
1. Check browser console for errors
2. Verify batch queries are working (check Network tab)
3. Check RLS policies allow reading `application_timeline_steps` and `application_payments`

### Issue: Auth errors after changes
**Solution**:
1. Clear browser cache and localStorage
2. Log out and log back in
3. Check that `getCurrentUserId` is exported correctly

## Support

- Migration file: `supabase/migrations/create-dashboard-stats-function.sql`
- Main API file: `src/lib/supabase-api.ts`
- Supabase Docs: https://supabase.com/docs/guides/database/functions







