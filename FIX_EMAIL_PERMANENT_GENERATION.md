# Fix: Email Addresses Permanent Once Generated

## Problem

When running migrations multiple times, duplicate client email addresses were being generated:
- User had `klcantila1@gritsync.com` (original)
- System generated `klcantila1@gritsync.com` again (duplicate)

This happened because the email generation function didn't check if the user already had an email before creating a new one.

## Root Cause

1. **Migration runs every time:** The migration in `add-auto-email-generation-trigger.sql` has a section (lines 115-136) that runs on every migration
2. **No existence check:** The `create_client_email_address` function created a new email without checking if one already exists
3. **Trigger re-fires:** If trigger is updated, it might process existing users again

## Solution

### 1. Updated `create_client_email_address` Function

**Before:**
```sql
-- Generated email without checking if user already has one
INSERT INTO email_addresses (...)
ON CONFLICT (email_address) DO NOTHING;
```

**After:**
```sql
-- Check if user already has a client email
SELECT email_address INTO v_existing_email
FROM email_addresses
WHERE user_id = p_user_id AND address_type = 'client'
LIMIT 1;

-- If exists, return it (don't create new)
IF v_existing_email IS NOT NULL THEN
  RETURN v_existing_email;
END IF;

-- Only create if none exists
INSERT INTO email_addresses (...)
```

### 2. Updated `handle_new_user` Trigger

Added check before calling email generation:

```sql
-- Check if user already has a client email
SELECT COUNT(*) INTO v_existing_email_count
FROM email_addresses
WHERE user_id = v_user_id AND address_type = 'client';

-- Only create if no email exists
IF v_existing_email_count = 0 THEN
  PERFORM create_client_email_address(v_user_id);
END IF;
```

### 3. Added Cleanup Logic

The migration automatically:
- Finds users with multiple email addresses
- Keeps the oldest (first created) one
- Deactivates any duplicates
- Logs the cleanup process

## How to Apply the Fix

### Step 1: Run the Migration

In Supabase SQL Editor or via migration:

```bash
# Apply the migration
supabase migration new fix-permanent-email-generation
# (Copy content from fix-permanent-email-generation.sql)
```

Or run directly in SQL Editor:
```sql
-- Run the contents of fix-permanent-email-generation.sql
```

### Step 2: Run Cleanup Script (Optional)

If you want to see details of what was cleaned up:

```sql
-- Run CLEANUP_DUPLICATE_EMAILS.sql in Supabase SQL Editor
```

This will:
- Show all duplicate emails
- Clean them up (keep oldest, deactivate rest)
- Verify the cleanup
- Show final status

### Step 3: Verify

Check that each user has only ONE active client email:

```sql
SELECT 
  u.first_name || ' ' || u.last_name as full_name,
  COUNT(ea.id) FILTER (WHERE ea.is_active = TRUE) as active_emails,
  STRING_AGG(ea.email_address, ', ') as all_emails
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id 
  AND ea.address_type = 'client'
WHERE u.role = 'client'
GROUP BY u.id, u.first_name, u.last_name
HAVING COUNT(ea.id) FILTER (WHERE ea.is_active = TRUE) > 1;
```

Should return **0 rows** (no users with multiple active emails).

## What Changed

### Function: `create_client_email_address`
- ✅ Now checks if user already has email before creating
- ✅ Returns existing email if found
- ✅ Only creates new email if none exists
- ✅ Logs actions for debugging

### Trigger: `handle_new_user`
- ✅ Checks email count before calling generation function
- ✅ Skips if user already has email
- ✅ Logs skip action

### Migration: `add-auto-email-generation-trigger.sql`
- ⚠️ The DO block (lines 115-136) still runs on every migration
- ✅ But now the function itself prevents duplicates
- ✅ Safe to run multiple times

## Benefits

1. **Permanent Emails** - Once generated, email address never changes
2. **No Duplicates** - Function prevents creating multiple emails per user
3. **Safe Re-runs** - Migrations can run multiple times without issues
4. **Automatic Cleanup** - Existing duplicates are automatically resolved
5. **Clear Logging** - All actions are logged for debugging

## Example Output

When running the migration, you'll see logs like:

```
NOTICE: === Email Addresses Status ===
NOTICE: User: Karl Cantila | Client Email: klcantila1@gritsync.com | Active: true | Primary: true
LOG: User [uuid] already has email address: klcantila1@gritsync.com
```

When cleaning up duplicates:

```
NOTICE: User: Karl Cantila (ID: [uuid]) has 2 email addresses
NOTICE:   ✓ Keeping: klcantila1@gritsync.com (ID: [uuid])
NOTICE:   ✗ Deactivated 1 duplicate(s)
```

## Future Protection

The fix ensures:
- ✅ New users get email on registration (once)
- ✅ Existing users keep their original email
- ✅ Re-running migrations doesn't create duplicates
- ✅ Manual calls to generation function are idempotent
- ✅ Trigger updates don't affect existing emails

## Files Created

1. `supabase/migrations/fix-permanent-email-generation.sql` - Main fix migration
2. `CLEANUP_DUPLICATE_EMAILS.sql` - Manual cleanup script with verification
3. `FIX_EMAIL_PERMANENT_GENERATION.md` - This documentation

## Quick Test

After applying the fix:

```sql
-- Try to generate email for existing user (should return existing)
SELECT create_client_email_address('[user_id]');

-- Check user's emails
SELECT email_address, is_active, created_at
FROM email_addresses
WHERE user_id = '[user_id]' AND address_type = 'client'
ORDER BY created_at;
```

Should show only ONE active email address, and function should return the existing one without creating new.

## Summary

✅ Email addresses are now permanent once generated
✅ No more duplicates from re-running migrations
✅ Existing duplicates are automatically cleaned up
✅ Safe to run migrations multiple times
✅ Functions are now idempotent (safe to call repeatedly)

