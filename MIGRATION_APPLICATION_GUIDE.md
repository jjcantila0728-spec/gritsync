# Database Migration Application Guide

## 🚀 Required Database Migrations

### 1. Login Attempts Tracking Migration

**File**: `supabase/migrations/add_login_attempts_tracking.sql`

**What it does**:
- Creates `login_attempts` table for tracking login attempts
- Adds `locked_until` column to `users` table
- Creates helper functions for lock management
- Sets up RLS policies for security

**How to Apply**:

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Open the file: `supabase/migrations/add_login_attempts_tracking.sql`
5. Copy the entire contents
6. Paste into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Verify no errors appear in the results

**Expected Result**: 
- ✅ Query executed successfully
- ✅ No errors in the output
- ✅ Tables and functions created

**Time Required**: ~1-2 minutes

**Verification**:

After running the migration, verify it worked:

```sql
-- Check if login_attempts table exists
SELECT * FROM login_attempts LIMIT 1;

-- Check if locked_until column exists in users
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'locked_until';

-- Test the functions
SELECT get_failed_login_attempts('test@example.com', 15);
SELECT is_account_locked('00000000-0000-0000-0000-000000000000');
```

---

## ✅ Migration Status

### Completed Migrations
- ✅ All core tables (users, applications, payments, etc.)
- ✅ RLS policies
- ✅ Storage buckets
- ✅ Helper functions
- ⏳ **Login attempts tracking** (pending - needs to be applied)

---

## 🧹 Cleanup Tasks (Optional)

### Old Files That Can Be Archived/Deleted

1. **Migration Scripts** (if no longer needed):
   - `server/migrate-application-ids.js` - Old migration script

2. **Old Database Files** (if no longer needed):
   - `server/db/index.js` - Old SQLite initialization (not imported anywhere)

**Note**: These files are kept for reference but can be safely archived or deleted if you're confident the migration is complete.

---

## 📋 Post-Migration Checklist

After applying the login attempts migration:

- [ ] Migration executed successfully
- [ ] Tables created and accessible
- [ ] Functions work correctly
- [ ] Test login attempt tracking
- [ ] Test account lockout functionality
- [ ] Test admin unlock functionality
- [ ] Verify RLS policies work correctly

---

## 🔍 Troubleshooting

### If Migration Fails

1. **Check for existing objects**: Some tables/functions might already exist
   - The migration uses `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION`
   - Should be safe to run multiple times

2. **Check permissions**: Ensure you have admin access to Supabase

3. **Check syntax**: Copy the entire file exactly as-is

4. **Check Supabase version**: Ensure you're using a recent version of Supabase

### Common Issues

**Issue**: "relation already exists"
- **Solution**: This is normal if running migration multiple times. The `IF NOT EXISTS` clauses handle this.

**Issue**: "function already exists"
- **Solution**: The `CREATE OR REPLACE FUNCTION` handles this automatically.

**Issue**: "permission denied"
- **Solution**: Ensure you're using the Supabase admin account or service role key.

---

## 📞 Support

If you encounter any issues:
1. Check the Supabase logs in the dashboard
2. Verify the SQL syntax is correct
3. Ensure all dependencies are met
4. Check that RLS policies don't conflict

---

## ✨ Next Steps After Migration

Once the migration is applied:

1. **Test the Features**:
   - Try logging in with wrong password multiple times
   - Verify account gets locked
   - Test admin unlock functionality
   - Check login attempt history

2. **Configure Settings**:
   - Go to `/admin/settings` → Security Settings
   - Configure `maxLoginAttempts` (default: 5)
   - Configure `sessionTimeout` (default: 30 minutes)

3. **Monitor**:
   - Check login attempts table periodically
   - Review locked accounts
   - Clean up old login attempts (optional)

---

**Status**: Ready to apply ✅


