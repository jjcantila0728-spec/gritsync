# Quick Fix Checklist - 403 Errors

## ✅ Step-by-Step Checklist

### Step 1: Run the Fix Script
- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Copy entire `COMPLETE_OVERHAUL_403_FIX.sql`
- [ ] Paste and Run
- [ ] Wait for "Success" message
- [ ] Check for any errors (should be none)

### Step 2: Verify (Optional)
- [ ] Run `DEBUG_JWT_AND_ROLE.sql`
- [ ] Check that your role shows as 'admin' in both raw_user_meta_data and app_metadata
- [ ] Verify `is_admin()` function returns true

### Step 3: **CRITICAL - Refresh Session**
- [ ] **Log out** of the application
- [ ] **Close ALL browser tabs** with the app
- [ ] **Wait 5-10 seconds**
- [ ] **Open new tab**
- [ ] **Log back in**

### Step 4: Test
- [ ] Open DevTools (F12)
- [ ] Go to Console tab
- [ ] Navigate to `/admin/clients`
- [ ] Check console - should see NO 403 errors
- [ ] Verify client data loads
- [ ] Check dashboard - stats should load

## ❌ If Still Not Working

### Check 1: Are you actually admin?
```sql
SELECT 
  email,
  raw_user_meta_data->>'role' as raw_role,
  app_metadata->>'role' as app_role
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE';
```
Both should show `'admin'`

### Check 2: Test the function
```sql
SELECT public.is_admin();
```
Should return `true`

### Check 3: Count policies
```sql
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users';
```
Should return `6`

### Check 4: Try incognito mode
- Open incognito/private window
- Log in fresh
- Test again

## 🎯 Success Criteria

You'll know it's working when:
- ✅ No 403 errors in browser console
- ✅ `/admin/clients` page loads with data
- ✅ Dashboard shows stats
- ✅ No permission denied errors

## 📝 Notes

- **Most common issue**: Not logging out/in after running the script
- **Second most common**: Role not set in `app_metadata` (script fixes this)
- **Third most common**: Browser cache (use incognito to test)

