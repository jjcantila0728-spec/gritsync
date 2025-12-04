# Deployment Guide - Quote Saving to Supabase

Complete step-by-step guide for deploying the quote saving feature.

## 📋 Pre-Deployment Checklist

Before starting, ensure you have:

- [ ] Access to Supabase Dashboard (admin)
- [ ] Database backup (recommended)
- [ ] Development environment tested
- [ ] Environment variables configured
- [ ] All code changes committed

## 🚀 Deployment Steps

### Phase 1: Pre-Migration Safety Check

**Run the pre-migration check to ensure it's safe to proceed:**

```bash
node pre-migration-check.js
```

**Expected Result**: ✅ All checks passed or warnings (no blockers)

**If checks fail**: Review errors and fix issues before proceeding

**Time Required**: ~1 minute

---

### Phase 2: Apply Database Migration

**This is the critical step - do not skip!**

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Load Migration Script**
   - Open file: `supabase/migrations/fix_public_quotations.sql`
   - Copy the entire contents (all 75 lines)

4. **Execute Migration**
   - Paste into SQL Editor
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for execution to complete

5. **Verify Execution**
   - Check for any errors in the output
   - Should see "Success. No rows returned" or similar
   - If errors appear, review and fix

**Time Required**: ~2 minutes

**⚠️ Important**: 
- Migration is idempotent (safe to run multiple times)
- Uses `DROP POLICY IF EXISTS` to handle existing policies
- Will not affect existing quotations

---

### Phase 3: Verify Migration

**Run the verification script to confirm migration was applied:**

```bash
node verify-quote-migration.js
```

**Expected Result**: ✅ All checks passed

**If verification fails**:
- Review error messages
- Check Supabase logs
- Re-run migration if needed

**Time Required**: ~1 minute

---

### Phase 4: Test in Development

**Test the functionality before deploying to production:**

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Test Quote Generation**
   - Open `http://localhost:3000/quote` in incognito mode
   - Generate a test quote
   - Verify quote is saved
   - Note the quote ID

3. **Test Admin View**
   - Login as admin
   - Go to `/admin/quotations`
   - Verify test quote appears
   - Test editing and deletion

4. **Test Quote Viewing**
   - Use the quote ID from step 2
   - Open in new incognito window
   - Verify quote loads correctly

**Time Required**: ~10 minutes

**See `TESTING_GUIDE.md` for detailed test cases**

---

### Phase 5: Deploy to Production

**Once development testing passes:**

1. **Deploy Frontend**
   - Push code changes to repository
   - Deploy via your deployment platform (Vercel, Netlify, etc.)
   - Wait for deployment to complete

2. **Verify Production Environment**
   - Check environment variables are set
   - Verify Supabase project is correct
   - Test quote generation in production

3. **Monitor**
   - Watch for errors in logs
   - Monitor quote generation
   - Check database for new quotes

**Time Required**: ~5-10 minutes (depending on deployment platform)

---

## 🔍 Post-Deployment Verification

### Database Verification

Run these queries in Supabase SQL Editor:

```sql
-- Check user_id is nullable
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quotations' AND column_name = 'user_id';
-- Expected: is_nullable = 'YES'

-- Check policies exist
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'quotations' AND policyname LIKE '%anonymous%';
-- Expected: 3 policies

-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'quotations' 
AND (indexname LIKE '%validity_date%' OR indexname LIKE '%created_at%');
-- Expected: 2 indexes
```

### Application Verification

- [ ] Quotes can be generated without login
- [ ] Quotes are saved to database
- [ ] Quotes appear in admin panel
- [ ] Quotes can be viewed by ID
- [ ] No console errors
- [ ] No database errors

---

## 🔄 Rollback Procedure

**If you need to revert the migration:**

1. **Review Rollback Script**
   - Open `supabase/migrations/rollback_public_quotations.sql`
   - Read warnings carefully

2. **Handle Existing Data**
   - Check for quotes with `user_id = null`:
     ```sql
     SELECT COUNT(*) FROM quotations WHERE user_id IS NULL;
     ```
   - Either delete them or assign to users

3. **Run Rollback**
   - Copy rollback script to Supabase SQL Editor
   - Execute carefully
   - Verify rollback succeeded

4. **Revert Code Changes**
   - Revert frontend code if needed
   - Redeploy application

**⚠️ Warning**: Rollback will remove ability for anonymous users to create quotes

---

## 📊 Monitoring

### Key Metrics to Monitor

1. **Quote Generation Rate**
   - Monitor number of quotes created per day
   - Check for any sudden drops (may indicate errors)

2. **Error Rate**
   - Monitor Supabase logs for errors
   - Check application logs for client-side errors
   - Watch for RLS policy violations

3. **Database Performance**
   - Monitor query performance
   - Check index usage
   - Watch for slow queries

### Setting Up Alerts (Optional)

1. **Supabase Alerts**
   - Set up alerts for database errors
   - Monitor RLS policy violations
   - Watch for connection issues

2. **Application Alerts**
   - Monitor quote generation failures
   - Track error rates
   - Alert on unusual patterns

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: Migration fails with "policy already exists"

**Solution**: The migration uses `DROP POLICY IF EXISTS`, so this shouldn't happen. If it does:
1. Manually drop the policy first
2. Re-run migration

#### Issue: Quotes not saving after migration

**Solution**:
1. Check RLS policies are created
2. Verify anonymous user permissions
3. Check browser console for errors
4. Review Supabase logs

#### Issue: Verification script fails

**Solution**:
1. Check environment variables
2. Verify Supabase connection
3. Review specific error messages
4. Check Supabase dashboard for issues

#### Issue: Quotes not visible in admin

**Solution**:
1. Verify you're logged in as admin
2. Check RLS policies for admin access
3. Refresh the page
4. Check browser console

---

## ✅ Success Criteria

Deployment is successful when:

- ✅ Migration applied without errors
- ✅ Verification script passes
- ✅ Quotes can be generated anonymously
- ✅ Quotes are saved to database
- ✅ Quotes visible in admin panel
- ✅ No errors in logs
- ✅ Production environment working

---

## 📚 Additional Resources

- **Implementation Details**: `QUOTE_SAVING_IMPLEMENTATION.md`
- **Testing Guide**: `TESTING_GUIDE.md`
- **Migration Checklist**: `MIGRATION_CHECKLIST.md`
- **Next Steps**: `NEXT_STEPS.md`

---

## 🆘 Support

If you encounter issues:

1. Check troubleshooting section above
2. Review Supabase logs
3. Check application logs
4. Verify environment variables
5. Review migration script for errors

---

**Ready to deploy?** Start with Phase 1: Pre-Migration Safety Check! 🚀

