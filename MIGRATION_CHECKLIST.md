# Migration Checklist - Quote Saving to Supabase

Use this checklist to ensure the migration is applied correctly.

## Pre-Migration Checklist

- [ ] Backup your Supabase database (recommended)
- [ ] Verify you have admin access to Supabase Dashboard
- [ ] Note current number of quotations in database (for verification)
- [ ] Ensure development environment is ready

## Migration Steps

### Step 1: Apply Migration

1. [ ] Open Supabase Dashboard
2. [ ] Navigate to **SQL Editor**
3. [ ] Open file: `supabase/migrations/fix_public_quotations.sql`
4. [ ] Copy entire contents of the migration file
5. [ ] Paste into SQL Editor
6. [ ] Click **Run** to execute
7. [ ] Verify no errors in the output

### Step 2: Verify Migration

1. [ ] Run verification script: `node verify-quote-migration.js`
2. [ ] All checks should pass ✅
3. [ ] If any checks fail, review errors and re-run migration

### Step 3: Test Functionality

1. [ ] Test quote generation (anonymous user)
   - [ ] Generate quote at `http://localhost:3000/quote`
   - [ ] Verify quote is saved
   - [ ] Verify quote ID is generated
   - [ ] Verify quote can be viewed by ID

2. [ ] Test admin view
   - [ ] Login as admin
   - [ ] Navigate to `/admin/quotations`
   - [ ] Verify new quote appears in list
   - [ ] Verify client information is displayed
   - [ ] Verify validity date is shown

3. [ ] Test quote management
   - [ ] Edit a quote in admin panel
   - [ ] Save changes
   - [ ] Verify changes persist
   - [ ] Delete a test quote
   - [ ] Verify quote is removed

## Post-Migration Verification

### Database Checks

- [ ] Verify `user_id` column is nullable:
  ```sql
  SELECT column_name, is_nullable 
  FROM information_schema.columns 
  WHERE table_name = 'quotations' AND column_name = 'user_id';
  ```
  Expected: `is_nullable = 'YES'`

- [ ] Verify RLS policies exist:
  ```sql
  SELECT policyname, cmd, roles 
  FROM pg_policies 
  WHERE tablename = 'quotations' AND policyname LIKE '%anonymous%';
  ```
  Expected: Should see 3 policies for anonymous users

- [ ] Verify indexes exist:
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename = 'quotations' 
  AND indexname LIKE '%validity_date%' OR indexname LIKE '%created_at%';
  ```
  Expected: Should see indexes for validity_date and created_at

### Application Checks

- [ ] Quotes can be generated without authentication
- [ ] Quotes are saved with `user_id: null`
- [ ] Quotes have `validity_date` set (30 days from creation)
- [ ] Quotes are visible in admin panel
- [ ] Quotes can be viewed by ID (anonymous access)
- [ ] No console errors in browser
- [ ] No errors in Supabase logs

## Rollback Plan (if needed)

If migration causes issues:

1. **Rollback SQL** (run in Supabase SQL Editor):
   ```sql
   -- Remove anonymous policies
   DROP POLICY IF EXISTS "Allow anonymous quotation inserts" ON quotations;
   DROP POLICY IF EXISTS "Allow anonymous quotation reads by email" ON quotations;
   DROP POLICY IF EXISTS "Allow anonymous quotation updates" ON quotations;
   
   -- Restore original policy
   DROP POLICY IF EXISTS "Users can view their own quotations" ON quotations;
   CREATE POLICY "Users can view their own quotations"
   ON quotations FOR SELECT
   TO authenticated
   USING (auth.uid() = user_id);
   
   -- Make user_id NOT NULL again (WARNING: This will fail if there are NULL values)
   -- ALTER TABLE quotations ALTER COLUMN user_id SET NOT NULL;
   ```

2. **Note**: If you have quotes with `user_id: null`, you'll need to either:
   - Delete them first, OR
   - Assign them to a user before making user_id NOT NULL

## Troubleshooting

### Error: "column user_id is not null"

**Cause**: Migration step 1 didn't run successfully

**Solution**: 
1. Check if there are existing quotes with constraints
2. Run the ALTER TABLE command individually:
   ```sql
   ALTER TABLE quotations ALTER COLUMN user_id DROP NOT NULL;
   ```

### Error: "policy already exists"

**Cause**: Policies were created in a previous migration attempt

**Solution**: 
- The migration now uses `DROP POLICY IF EXISTS`, so this should be handled
- If still failing, manually drop policies first

### Error: "permission denied"

**Cause**: RLS policies are blocking the operation

**Solution**:
1. Check if you're using the correct Supabase project
2. Verify service role key if using server-side operations
3. Check RLS is enabled on the table

### Quotes not saving

**Symptoms**: Error when creating quote

**Solutions**:
1. Check browser console for specific error
2. Verify RLS policies allow anonymous inserts
3. Check Supabase logs for detailed errors
4. Verify environment variables are correct

## Success Criteria

✅ Migration runs without errors
✅ Verification script passes all checks
✅ Quotes can be generated anonymously
✅ Quotes are saved to database
✅ Quotes are visible in admin panel
✅ No errors in application logs

## Next Steps After Migration

1. Monitor quote generation for first 24 hours
2. Check database for any unexpected issues
3. Verify quote expiration logic works correctly
4. Consider setting up monitoring/alerts for quote generation
5. Document any custom business logic or edge cases discovered

## Support

If you encounter issues:
1. Check `TESTING_GUIDE.md` for detailed test cases
2. Review `QUOTE_SAVING_IMPLEMENTATION.md` for implementation details
3. Check Supabase logs for detailed error messages
4. Verify all environment variables are set correctly

