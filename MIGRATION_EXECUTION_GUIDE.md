# Migration Execution Guide

## Quick Start

Run these migrations in order in your Supabase SQL Editor:

### Step 1: Base Schema (if not already run)
```sql
-- Run: supabase/schema.sql
-- This creates the base tables and functions
```

### Step 2: Core Migrations (in order)
```sql
-- 1. Partner Agencies and Career Applications
-- Run: supabase/migrations/add-career-applications-and-partner-agencies.sql

-- 2. Careers Table
-- Run: supabase/migrations/add-careers-table.sql

-- 3. Sponsorships and Donations
-- Run: supabase/migrations/add-sponsorships-and-donations.sql
```

### Step 3: Fixes and Optimizations
```sql
-- Run: supabase/migrations/fix-migration-dependencies-and-indexes.sql
-- This adds indexes, constraints, and helper functions
```

### Step 4: Apply Patches (if needed)
```sql
-- If you have issues with anonymous inserts:
-- Run: supabase/patches/fix-sponsorships-anonymous-insert.sql
-- Run: supabase/patches/fix-donations-anonymous-insert.sql
-- Run: supabase/patches/fix-donations-rls-complete.sql
```

## Verification

After running migrations, verify everything works:

```sql
-- Check tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('careers', 'career_applications', 'partner_agencies', 'nclex_sponsorships', 'donations')
ORDER BY tablename;

-- Check indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('careers', 'career_applications', 'nclex_sponsorships', 'donations')
ORDER BY tablename, indexname;

-- Test statistics functions
SELECT * FROM get_career_statistics();
SELECT * FROM get_donation_statistics();
SELECT * FROM get_sponsorship_statistics();
```

## Common Issues and Solutions

### Issue: "partner_agencies table must exist"
**Solution**: Run `add-career-applications-and-partner-agencies.sql` before `add-careers-table.sql`

### Issue: "update_updated_at_column function is missing"
**Solution**: Run `schema.sql` first to create base functions

### Issue: "Permission denied" errors
**Solution**: Check RLS policies are enabled and properly configured

### Issue: Slow queries
**Solution**: Ensure all indexes from `fix-migration-dependencies-and-indexes.sql` are created

## Migration Checklist

- [ ] Base schema (`schema.sql`) is applied
- [ ] Partner agencies migration is applied
- [ ] Careers table migration is applied
- [ ] Sponsorships and donations migration is applied
- [ ] Fix migration is applied
- [ ] All tables exist (verification query)
- [ ] All indexes exist (verification query)
- [ ] Statistics functions work (verification query)
- [ ] RLS policies are enabled
- [ ] Test insert/select operations work

## Rollback (if needed)

If you need to rollback:

```sql
-- Drop tables (in reverse order)
DROP TABLE IF EXISTS careers CASCADE;
DROP TABLE IF EXISTS career_applications CASCADE;
DROP TABLE IF EXISTS partner_agencies CASCADE;
DROP TABLE IF EXISTS nclex_sponsorships CASCADE;
DROP TABLE IF EXISTS donations CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_career_statistics();
DROP FUNCTION IF EXISTS get_donation_statistics();
DROP FUNCTION IF EXISTS get_sponsorship_statistics();
DROP FUNCTION IF EXISTS increment_career_views(UUID);
DROP FUNCTION IF EXISTS increment_career_applications(UUID);
```

**Warning**: Only use rollback in development. In production, create proper migration rollback scripts.



