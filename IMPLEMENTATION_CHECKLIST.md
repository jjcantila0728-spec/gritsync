# Implementation Checklist - Tracking Migration

## ✅ Code Changes (COMPLETED)

- [x] Removed server API dependency from `trackingAPI.track()`
- [x] Updated `DocumentImagePreview` to support public URLs for pictures
- [x] Created migration for public pictures policy
- [x] Created migration for public tracking policies
- [x] Created comprehensive documentation

## 📋 Database Migrations (TO APPLY)

### Migration 1: Public Pictures Policy
**File:** `supabase/migrations/add_public_pictures_policy.sql`

**Status:** ⏳ Pending Application

**Action Required:**
1. Open Supabase Dashboard > SQL Editor
2. Copy and paste the contents of `supabase/migrations/add_public_pictures_policy.sql`
3. Click "Run"
4. Verify success message

**Verification:**
```sql
SELECT policyname, roles
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname = 'Public can view pictures for tracking';
```

### Migration 2: Public Tracking Policies
**File:** `supabase/migrations/add_public_tracking_policies.sql`

**Status:** ⏳ Pending Application

**Action Required:**
1. Open Supabase Dashboard > SQL Editor
2. Copy and paste the contents of `supabase/migrations/add_public_tracking_policies.sql`
3. Click "Run"
4. Verify success message

**Verification:**
```sql
SELECT tablename, policyname, roles
FROM pg_policies 
WHERE tablename IN ('applications', 'application_timeline_steps', 'application_payments', 'processing_accounts')
AND policyname LIKE '%tracking%'
ORDER BY tablename;
```

Expected: 4 policies should be returned

## 🔧 Configuration (OPTIONAL BUT RECOMMENDED)

### Make Storage Bucket Public
**Why:** Makes pictures load faster and more reliably

**Steps:**
1. Go to Supabase Dashboard > Storage > documents
2. Click "Settings" (gear icon)
3. Toggle "Public bucket" to **ON**
4. Click "Save"

**Note:** RLS policies will still restrict access to pictures only, so this is safe.

## 🧪 Testing Checklist

### Test 1: Public Tracking (Incognito Window)
- [ ] Open browser in incognito/private mode
- [ ] Navigate to tracking page
- [ ] Enter a GRIT APP ID (e.g., `APNA06G6HMGLG4`)
- [ ] Verify application details display
- [ ] Verify picture displays (if available)
- [ ] Verify current progress shows
- [ ] Verify next step shows
- [ ] Check browser console for errors

### Test 2: Authenticated Tracking
- [ ] Log in to the application
- [ ] Navigate to tracking page
- [ ] Enter the same GRIT APP ID
- [ ] Verify results match Test 1 exactly
- [ ] Verify picture displays
- [ ] Check browser console for errors

### Test 3: UUID Tracking
- [ ] Test tracking with UUID instead of GRIT APP ID
- [ ] Verify it works for both public and authenticated users
- [ ] Verify results are identical

### Test 4: Picture Display
- [ ] Verify picture displays in tracking result
- [ ] Verify picture displays in application detail page
- [ ] Check network tab for successful image loads
- [ ] Verify no 403/404 errors for pictures

## 🐛 Troubleshooting

### Issue: "Application not found" for public users
**Check:**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'applications' 
AND policyname = 'Public can track applications';
```
**Fix:** Apply migration 2 if policy doesn't exist

### Issue: Timeline steps not showing
**Check:**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'application_timeline_steps' 
AND policyname = 'Public can view timeline steps for tracking';
```
**Fix:** Apply migration 2 if policy doesn't exist

### Issue: Picture not displaying
**Check:**
1. Is bucket public? (Dashboard > Storage > documents > Settings)
2. Is pictures policy applied? (Run verification query above)
3. Check browser console for errors
4. Check network tab for 403/404 errors

**Fix:**
- Make bucket public (recommended)
- OR ensure pictures policy is applied
- OR check file path matches policy pattern

### Issue: Different results for authenticated vs public
**Check:**
1. Clear browser cache
2. Verify both use same Supabase client
3. Check browser console for errors
4. Verify all policies are applied

**Fix:** Ensure all migrations are applied correctly

## 📊 Success Criteria

✅ **Migration is successful when:**
1. Public users can track applications
2. Authenticated users can track applications
3. Both show identical results
4. Pictures display correctly
5. No console errors
6. All policies are applied

## 📝 Notes

- The server API endpoint is no longer used for tracking
- Other features may still use the server API (that's fine)
- Only tracking has been migrated to Supabase-only
- All code changes are complete - only database migrations need to be applied

## 🎯 Quick Start

1. **Apply Migration 1** (Pictures Policy)
2. **Apply Migration 2** (Tracking Policies)
3. **Make bucket public** (Optional but recommended)
4. **Test tracking** (Incognito + Authenticated)
5. **Verify pictures display**
6. **Done!** ✅
