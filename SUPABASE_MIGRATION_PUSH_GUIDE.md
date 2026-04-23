# 🚀 Push All Supabase Migrations - Complete Guide

## Quick Start

### Option 1: Supabase Dashboard (Easiest - Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Apply Migrations**
   - Open each migration file from `supabase/migrations/`
   - Copy the entire content
   - Paste into SQL Editor
   - Click "Run" (or press Ctrl+Enter)
   - Wait for success message
   - Repeat for each migration file

**Note**: Apply migrations in chronological order (check file names/timestamps)

---

### Option 2: Install Supabase CLI (Best for Automation)

#### Install CLI

**Windows:**
```powershell
# Using winget
winget install Supabase.CLI

# Or using npm
npm install -g supabase

# Or download from: https://github.com/supabase/cli/releases
```

#### Login and Link Project

```bash
# Login to Supabase
supabase login

# Link to your project (get project-ref from Supabase dashboard URL)
supabase link --project-ref your-project-ref
```

#### Push Migrations

```bash
# Push all pending migrations
supabase db push

# Or push specific migration
supabase migration up
```

---

### Option 3: Using psql (PostgreSQL Client)

1. **Get Connection String**
   - Go to Supabase Dashboard → Settings → Database
   - Copy the connection string (URI format)

2. **Connect and Run Migrations**
   ```bash
   # Connect to database
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
   
   # Run each migration
   \i supabase/migrations/add-email-queue-table.sql
   \i supabase/migrations/add-workflows-system.sql
   # ... etc
   ```

---

## Migration Files to Apply

### Recent Feature Migrations (Apply These First)

1. **Email System**
   - `add-email-queue-table.sql` - Email scheduling and queue
   - `add-email-templates-system.sql` - Email templates
   - `add-email-logs-table.sql` - Email logging
   - `add-email-addresses-system.sql` - Email addresses management
   - `add-email-signatures-and-logos.sql` - Email signatures
   - `add-email-campaigns-system.sql` - Email campaigns and newsletters

2. **Workflows System**
   - `add-workflows-system.sql` - Automated workflows

3. **Analytics System**
   - `add-analytics-system.sql` - Advanced analytics and reporting

### Core Migrations

- `add-careers-table.sql`
- `add-career-applications-and-partner-agencies.sql`
- `add-sponsorships-and-donations.sql`
- `add-ead-application-support.sql`
- `add-service-required-documents.sql`

### Fix Migrations (Apply After Core)

- `fix-migration-dependencies-and-indexes.sql`
- `fix-rls-performance-and-indexes.sql`
- `fix-email-logs-rls-for-clients.sql`
- `fix-email-logs-update-policy.sql`
- `fix-storage-admin-upload-policies.sql`
- `fix-storage-signature-upload-policies.sql`

### Verification Migrations

- `verify-all-migrations.sql` - Verify all migrations applied
- `verify-security-optimization.sql` - Verify security settings

---

## Migration Order (Recommended)

Apply migrations in this order:

1. **Core Tables** (if not already applied)
   - Base schema tables
   - Core application tables

2. **Feature Migrations** (in order)
   - Email system migrations
   - Workflows system
   - Analytics system
   - Email campaigns

3. **Fix Migrations** (after features)
   - RLS policies
   - Indexes
   - Performance optimizations

4. **Verification** (last)
   - Run verification scripts

---

## Verification Checklist

After pushing migrations, verify:

### Database Tables
```sql
-- Check key tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'email_queue',
  'workflows',
  'workflow_runs',
  'analytics_cache',
  'email_campaigns',
  'email_subscribers'
)
ORDER BY tablename;
```

### Functions
```sql
-- Check key functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_email_queue_stats',
  'get_emails_to_process',
  'execute_workflow',
  'get_application_analytics'
)
ORDER BY routine_name;
```

### RLS Policies
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('email_queue', 'workflows', 'email_campaigns');
```

### Indexes
```sql
-- Check indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN ('email_queue', 'workflows', 'email_campaigns')
ORDER BY tablename, indexname;
```

---

## Troubleshooting

### Error: "relation already exists"
- The table/function already exists
- Skip this migration or use `CREATE OR REPLACE`

### Error: "permission denied"
- Check RLS policies
- Ensure you're using service role key for admin operations

### Error: "function does not exist"
- A dependency migration hasn't been run
- Check migration order and dependencies

### Error: "duplicate key value"
- Data already exists
- May need to clean up or use `ON CONFLICT` handling

---

## Important Notes

⚠️ **Always backup your database before applying migrations**

⚠️ **Test migrations in development environment first**

⚠️ **Apply migrations in order (check file timestamps)**

⚠️ **Some migrations depend on others - check dependencies**

⚠️ **Verify each migration completes successfully**

---

## Need Help?

- Check Supabase logs: Dashboard → Logs → Postgres Logs
- Verify migration status: Dashboard → Database → Migrations
- Review migration files for dependencies
- Check error messages in SQL Editor

---

## Success Indicators

✅ All migrations run without errors
✅ All tables exist and are accessible
✅ All functions are created and working
✅ RLS policies are enabled
✅ Indexes are created
✅ No duplicate constraints or policies



