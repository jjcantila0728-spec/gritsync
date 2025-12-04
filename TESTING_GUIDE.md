# Quote Saving - Testing Guide

This guide helps you test the quote saving functionality after applying the migration.

## Prerequisites

1. ✅ Migration has been applied in Supabase SQL Editor
2. ✅ Environment variables are set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
3. ✅ Development server is running (`npm run dev`)

## Step 1: Verify Migration

Run the verification script to ensure the migration was applied correctly:

```bash
node verify-quote-migration.js
```

Expected output:
- ✅ All checks should pass
- If any checks fail, review the error messages and re-run the migration

## Step 2: Test Quote Generation (Anonymous User)

### Test Case 1: Generate Quote Without Login

1. **Open** `http://localhost:3000/quote` in an **incognito/private window** (to ensure no authentication)
2. **Fill out** the quote form:
   - Select service (e.g., "NCLEX Processing")
   - Select state (e.g., "New York")
   - Enter first name, last name, email, mobile number
   - Select payment type
   - Review and submit
3. **Verify**:
   - Quote is generated successfully
   - You see a success toast message
   - You're redirected to `/quote/GQ...` (with the quote ID)
   - Quote details are displayed correctly
   - Validity date is shown (30 days from now)

### Test Case 2: View Quote by ID

1. **Copy** the quote ID from the URL (format: `GQ...`)
2. **Open** a new incognito window
3. **Navigate** to `http://localhost:3000/quote/{quote-id}`
4. **Verify**:
   - Quote loads and displays correctly
   - All client information is shown
   - Line items are displayed
   - Validity date is shown

## Step 3: Test Admin View

### Test Case 3: View Quotes in Admin Panel

1. **Login** as admin user
2. **Navigate** to `http://localhost:3000/admin/quotations`
3. **Verify**:
   - The quote you just created appears in the list
   - Client information is displayed (name, email)
   - Validity date is shown
   - Line items are displayed correctly
   - Quote has `user_id: null` (check in browser dev tools if needed)

### Test Case 4: Edit Quote in Admin Panel

1. **Click** "Edit" on the quote you created
2. **Modify** some fields (e.g., amount, description)
3. **Save** the changes
4. **Verify**:
   - Changes are saved successfully
   - Updated quote appears in the list
   - Changes persist after page refresh

### Test Case 5: Delete Quote in Admin Panel

1. **Click** "Delete" on a test quote
2. **Confirm** deletion
3. **Verify**:
   - Quote is removed from the list
   - Success message is shown
   - Quote is deleted from database

## Step 4: Test Quote Persistence

### Test Case 6: Verify Quote Persists

1. **Generate** a new quote (as anonymous user)
2. **Note** the quote ID
3. **Wait** a few minutes (or check database directly)
4. **Verify**:
   - Quote still exists in database
   - Quote can be viewed by ID
   - Quote appears in admin panel

### Test Case 7: Check Expiration Logic

1. **View** a quote that was created recently
2. **Verify**:
   - Expiration date is shown (30 days from creation)
   - Quote is not marked as expired
3. **Note**: To test expiration, you would need to manually set `validity_date` to a past date in the database

## Step 5: Test Edge Cases

### Test Case 8: Multiple Quotes from Same Email

1. **Generate** multiple quotes using the same email address
2. **Verify**:
   - All quotes are saved successfully
   - Each quote has a unique ID
   - All quotes appear in admin panel
   - Quotes can be viewed independently

### Test Case 9: Quote with All Fields

1. **Generate** a quote with:
   - All optional fields filled
   - Staggered payment type
   - Multiple line items
2. **Verify**:
   - All data is saved correctly
   - All fields are displayed in admin panel
   - Quote can be edited and saved

## Step 6: Database Verification

### Check Database Directly

1. **Open** Supabase Dashboard → Table Editor → `quotations`
2. **Verify**:
   - New quotes have `user_id: null`
   - `validity_date` is set (30 days from `created_at`)
   - `client_email` is populated
   - `line_items` contains the metadata structure
   - All other fields are populated correctly

### Check RLS Policies

1. **Open** Supabase Dashboard → Authentication → Policies
2. **Verify** policies exist:
   - "Allow anonymous quotation inserts"
   - "Allow anonymous quotation reads by email"
   - "Allow anonymous quotation updates"
   - Updated "Users can view their own quotations" policy

## Troubleshooting

### Issue: Quote not saving

**Symptoms**: Error when submitting quote form

**Solutions**:
1. Check browser console for errors
2. Verify migration was applied correctly
3. Check RLS policies in Supabase
4. Verify environment variables are set

### Issue: Quote not visible in admin panel

**Symptoms**: Quote created but not showing in admin list

**Solutions**:
1. Check if you're logged in as admin
2. Refresh the admin page
3. Check browser console for errors
4. Verify quote exists in database

### Issue: Cannot view quote by ID

**Symptoms**: 404 or error when accessing quote by ID

**Solutions**:
1. Verify quote ID is correct
2. Check RLS policies allow anonymous reads
3. Verify quote exists in database
4. Check browser console for errors

### Issue: Migration errors

**Symptoms**: SQL errors when running migration

**Solutions**:
1. Check if policies already exist (use `DROP POLICY IF EXISTS`)
2. Verify table structure matches schema
3. Check for syntax errors in migration SQL
4. Run migration steps individually if needed

## Success Criteria

✅ All test cases pass
✅ Quotes are saved with `user_id: null`
✅ Quotes persist in database
✅ Quotes are visible in admin panel
✅ Quotes can be viewed by ID (anonymous)
✅ Quotes can be edited/deleted by admin
✅ No console errors
✅ No database errors

## Next Steps

After successful testing:
1. Monitor quote generation in production
2. Set up monitoring for expired quotes (if needed)
3. Consider adding automated cleanup for expired quotes (optional)
4. Document any custom business logic

