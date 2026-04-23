# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Run Base Migrations (2 min)

In Supabase SQL Editor, run these in order:

```sql
-- 1. Base schema
-- Copy and paste: supabase/schema.sql

-- 2. Partner agencies and career applications
-- Copy and paste: supabase/migrations/add-career-applications-and-partner-agencies.sql

-- 3. Careers table
-- Copy and paste: supabase/migrations/add-careers-table.sql

-- 4. Sponsorships and donations
-- Copy and paste: supabase/migrations/add-sponsorships-and-donations.sql
```

### Step 2: Apply Fixes (1 min)

```sql
-- Copy and paste: supabase/migrations/fix-migration-dependencies-and-indexes.sql
```

### Step 3: Verify (1 min)

```sql
-- Copy and paste: supabase/migrations/verify-all-migrations.sql
```

Look for ✅ PASS messages.

### Step 4: Test Functions (1 min)

```sql
-- Copy and paste: supabase/migrations/test-statistics-functions.sql
```

All functions should return data (even if zeros).

## ✅ Done!

Your database is now set up with:
- ✅ All tables created
- ✅ Performance indexes added
- ✅ Data validation in place
- ✅ Statistics functions ready
- ✅ RLS policies configured

## 🎯 Next: Use the Statistics Functions

In your application code:

```typescript
// Get career statistics
const { data } = await supabase.rpc('get_career_statistics');

// Get donation statistics
const { data } = await supabase.rpc('get_donation_statistics');

// Get sponsorship statistics
const { data } = await supabase.rpc('get_sponsorship_statistics');
```

## 📚 Need More Details?

- See `MIGRATION_EXECUTION_GUIDE.md` for detailed instructions
- See `MVP_IMPROVEMENTS.md` for what was fixed and improved
- See `NEXT_STEPS_CHECKLIST.md` for comprehensive next steps



