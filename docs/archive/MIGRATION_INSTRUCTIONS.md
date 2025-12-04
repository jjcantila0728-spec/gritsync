# Application ID Migration Instructions

## Problem
The frontend is showing old UUID-based application IDs (e.g., `76fdd29e-7d9c-48c3-af43-7313b05183ba`) instead of the new permanent format (`AP` + 12 alphanumeric characters).

## Solution
You need to run the Supabase migration script to:
1. Convert the `applications.id` column from UUID to TEXT
2. Migrate all existing UUIDs to permanent IDs
3. Update all related tables
4. Set up automatic ID generation for new applications

## Steps to Migrate

### 1. Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**

### 2. Run the Migration Script
1. Open the file: `supabase/migrate-application-ids.sql`
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** to execute the migration

### 3. Verify Migration
After running the script, you should see:
- A summary showing how many applications were migrated
- All applications should now have IDs in the format `APXXXXXXXXXXXX` (14 characters total)

### 4. Refresh Frontend
1. Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R)
2. The frontend should now display the new permanent IDs

## What the Migration Does

1. **Changes column type**: Converts `applications.id` from UUID to TEXT
2. **Migrates existing data**: Updates all UUID-based IDs to permanent format
3. **Updates foreign keys**: Updates all related tables (payments, timeline steps, processing accounts)
4. **Sets up defaults**: Creates a function to auto-generate permanent IDs for new applications

## Important Notes

- **Backup first**: Consider backing up your database before running the migration
- **Downtime**: The migration may cause brief downtime while it runs
- **New applications**: After migration, new applications will automatically get permanent IDs
- **Frontend code**: The frontend code has been updated to generate permanent IDs when creating applications

## Troubleshooting

If you see errors:
1. Check that all foreign key constraints are properly handled
2. Verify that related tables exist
3. Check the Supabase logs for detailed error messages

## After Migration

Once complete:
- All existing applications will have permanent IDs
- New applications will automatically get permanent IDs
- The frontend will display IDs in the format: `NCLEX Processing - APXXXXXXXXXXXX`

