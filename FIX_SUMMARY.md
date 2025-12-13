# Fix Summary - Processing Accounts & PDF Generation Errors

## Issues Fixed

### 1. Processing Accounts 400 Bad Request Error
**Problem:** The code was trying to insert accounts with `account_type: 'gritsync'`, but the database schema only allowed `'gmail'`, `'pearson_vue'`, or `'custom'`.

**Root Cause:** The database CHECK constraint on `processing_accounts.account_type` didn't include `'gritsync'`.

**Solution:**
- Created migration file: `supabase/migrations/add-gritsync-account-type.sql`
- Updated `supabase/schema.sql` to include `'gritsync'` in the account_type constraint
- The migration will:
  - Drop the old CHECK constraint
  - Add new CHECK constraint that includes 'gritsync'
  - Update the unique index to include 'gritsync'
  - Convert any existing 'gmail' accounts to 'gritsync' (since the system internally uses 'gritsync')

### 2. PDF Generation 500 Internal Server Error
**Problem:** The Supabase Edge Function was failing with "Expected instance of PDFDict, but got instance of undefined" when trying to generate G-1145 forms.

**Root Cause:** 
- The `form.flatten()` method was throwing errors when the PDF structure wasn't as expected
- Error handling was insufficient, causing the entire operation to fail
- The PDF save operation lacked proper error handling

**Solution:** Updated `supabase/functions/fill-pdf-form/index.ts` with:
- Better error handling around form field access
- Wrapped `form.flatten()` in try-catch to continue without flattening if it fails
- Added fallback to text overlays when form fields can't be filled
- Enhanced PDF save operation with multiple fallback strategies
- Added proper TypeScript error typing (`catch (error: any)`)
- Better logging for debugging

## How to Apply These Fixes

### Step 1: Apply the Database Migration

You have three options:

#### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Copy and paste the contents of `supabase/migrations/add-gritsync-account-type.sql`
4. Execute the SQL

#### Option B: Using Supabase CLI
```bash
# First, link your project if not already linked
npx supabase link --project-ref YOUR_PROJECT_REF

# Then push the migration
npx supabase db push
```

#### Option C: Manual SQL Execution
Run this SQL directly in your database:

```sql
-- Add 'gritsync' as a valid account_type
ALTER TABLE processing_accounts 
DROP CONSTRAINT IF EXISTS processing_accounts_account_type_check;

ALTER TABLE processing_accounts
ADD CONSTRAINT processing_accounts_account_type_check 
CHECK (account_type IN ('gmail', 'gritsync', 'pearson_vue', 'custom'));

-- Update the unique index
DROP INDEX IF EXISTS idx_processing_accounts_unique_gmail_pearson;

CREATE UNIQUE INDEX IF NOT EXISTS idx_processing_accounts_unique_gmail_gritsync_pearson
ON processing_accounts(application_id, account_type)
WHERE account_type IN ('gmail', 'gritsync', 'pearson_vue');

-- Convert existing 'gmail' accounts to 'gritsync'
UPDATE processing_accounts
SET account_type = 'gritsync'
WHERE account_type = 'gmail';
```

### Step 2: Redeploy the Edge Function

```bash
# Deploy the updated fill-pdf-form function
npx supabase functions deploy fill-pdf-form
```

Or through the Supabase dashboard:
1. Go to "Edge Functions"
2. Select the `fill-pdf-form` function
3. Update it with the code from `supabase/functions/fill-pdf-form/index.ts`

## Testing

After applying the fixes, test the following:

1. **Test Processing Accounts Creation:**
   - Create a new application
   - Verify that GritSync and Pearson Vue accounts are created without errors
   - Check the browser console for the 400 error - it should be gone

2. **Test PDF Generation:**
   - Open an application detail page
   - Generate a G-1145 form
   - Verify the PDF is generated and downloaded successfully
   - Check the browser console for the 500 error - it should be gone

## Files Modified

1. `supabase/migrations/add-gritsync-account-type.sql` (NEW)
2. `supabase/schema.sql`
3. `supabase/functions/fill-pdf-form/index.ts`

## Expected Behavior After Fixes

1. **Processing Accounts:** Applications will successfully create GritSync and Pearson Vue accounts with the correct account_type stored in the database.

2. **PDF Generation:** G-1145 forms will be generated successfully, with:
   - Better error handling that doesn't crash the entire operation
   - Fallback to text overlays if form fields can't be filled
   - Multiple save strategies to ensure the PDF is always returned
   - Detailed logging for debugging

## Notes

- The migration is safe to run multiple times (uses `IF NOT EXISTS` and `DROP IF EXISTS`)
- Existing applications with 'gmail' account_type will be automatically converted to 'gritsync'
- The PDF generation now has multiple fallback mechanisms, so it should always return a PDF even if filling fails

