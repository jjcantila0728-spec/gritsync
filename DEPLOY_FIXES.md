# How to Deploy the Fixes

## Quick Start

Follow these steps in order to fix all errors:

### Step 1: Apply Database Migration (REQUIRED)

This fixes the 400 Bad Request error for processing_accounts.

**Option A: Supabase Dashboard (Easiest)**
1. Go to https://warfdcbvnapietbkpild.supabase.co/project/_/sql
2. Click "New Query"
3. Copy and paste this SQL:

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

4. Click "Run" or press Ctrl+Enter
5. Verify it says "Success. No rows returned"

**Option B: Using Migration File**
If you have Supabase CLI set up:
```bash
npx supabase db push
```

### Step 2: Redeploy Edge Function (REQUIRED)

This fixes the 500 Internal Server Error for PDF generation.

**Option A: Supabase Dashboard**
1. Go to https://warfdcbvnapietbkpild.supabase.co/project/_/functions
2. Find the `fill-pdf-form` function
3. Click "Deploy new version"
4. The code is already updated in `supabase/functions/fill-pdf-form/index.ts`

**Option B: Using Supabase CLI**
```bash
npx supabase functions deploy fill-pdf-form
```

### Step 3: Test the Fixes

1. **Test Processing Accounts:**
   - Open your application in the browser
   - Go to ApplicationDetail page
   - Open browser DevTools Console (F12)
   - Check that the 400 Bad Request error is gone

2. **Test PDF Generation:**
   - On an ApplicationDetail page, generate a G-1145 form
   - Check that the PDF downloads successfully
   - Verify the 500 Internal Server Error is gone in the console

## What Was Fixed?

### 1. Database Schema Issue (400 Error)
- Added 'gritsync' to allowed account_type values
- Updated unique constraint to include 'gritsync'
- Migrated existing 'gmail' accounts to 'gritsync'

### 2. PDF Generation Error (500 Error)
- Improved error handling in edge function
- Added fallback mechanisms for PDF filling
- Better handling of malformed PDF forms
- Multiple save strategies to ensure PDF is always returned

## Troubleshooting

### Migration Fails
If the migration fails, it's likely because:
- The constraint already exists (safe to ignore)
- There are no records to update (safe to ignore)

### Edge Function Deploy Fails
If deploying fails:
1. Check you're logged in: `npx supabase login`
2. Check you're linked to the project
3. Try deploying through the dashboard instead

### Errors Still Occur
If you still see errors after deploying:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Do a hard refresh (Ctrl+Shift+R)
3. Check browser console for any new error messages
4. Verify both Step 1 and Step 2 were completed

## Files Changed
- ✅ `supabase/migrations/add-gritsync-account-type.sql` (NEW)
- ✅ `supabase/schema.sql` (Updated)
- ✅ `supabase/functions/fill-pdf-form/index.ts` (Updated)
- ✅ `src/lib/supabase-api.ts` (Updated TypeScript types)

## Need Help?
If you encounter any issues:
1. Check the browser console for detailed error messages
2. Check the Supabase Edge Function logs
3. Verify the migration was applied successfully in the database

