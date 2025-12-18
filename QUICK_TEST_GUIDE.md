# Quick Test Guide - Supabase Optimizations

## 🚀 Quick Start (5 minutes)

### Step 1: Verify Function Exists (30 seconds)
Run in Supabase SQL Editor:
```sql
SELECT * FROM get_dashboard_stats(true);
```
**Expected**: Returns a row with stats or zeros (if no data)

### Step 2: Test Dashboard (2 minutes)
1. Log in as admin
2. Go to `/dashboard`
3. Check browser console - should see **1 RPC call** instead of 9+ queries
4. Verify stats display correctly

### Step 3: Test Applications List (2 minutes)
1. Go to `/applications`
2. Check browser Network tab - should see **3 queries** total
3. Verify all applications load with timeline data

### Step 4: Verify Performance (30 seconds)
- Dashboard should load faster
- Applications list should load faster
- No console errors

---

## ✅ Success Criteria

- [x] Dashboard stats display correctly
- [x] Applications list loads correctly
- [x] Network tab shows reduced queries
- [x] No console errors
- [x] Faster load times

---

## 🐛 If Something's Wrong

1. **Stats show wrong numbers**: Check RPC function exists and is callable
2. **Applications missing data**: Check batch queries are working (Network tab)
3. **Auth errors**: Clear cache, log out/in
4. **Function not found**: Run migration SQL again

---

## 📞 Need Help?

- Full testing guide: `SUPABASE_OPTIMIZATION_TESTING_CHECKLIST.md`
- Deployment guide: `SUPABASE_OPTIMIZATION_DEPLOYMENT.md`
- Verification script: `npm run verify:optimizations`
