# One Business Email Per User - Enforcement

## Rule
**Each user can only have ONE active business/client email address at a time.**

## Implementation

### What Was Added

1. **Unique Index** - Database-level constraint preventing multiple active emails
2. **Trigger** - Automatically deactivates old emails when new one is activated
3. **Updated Functions** - Email creation functions check for existing emails
4. **Cleanup Script** - Removes existing duplicates (keeps oldest)

### How It Works

#### 1. Unique Index
```sql
CREATE UNIQUE INDEX idx_one_active_client_email_per_user
ON email_addresses (user_id)
WHERE address_type = 'client' AND is_active = TRUE;
```

**Prevents:** Database will reject attempts to create multiple active emails for same user.

#### 2. Trigger
```sql
CREATE TRIGGER trigger_enforce_single_active_client_email
BEFORE INSERT OR UPDATE ON email_addresses
```

**Behavior:** When activating a new email, automatically deactivates all other active emails for that user.

#### 3. Function Updates
- `create_client_email_address()` - Returns existing email if found, doesn't create duplicate
- `set_primary_client_email()` - Safely switches primary email (deactivates others)

## How to Apply

### Step 1: Run Migration

**In Supabase SQL Editor:**
1. Copy contents of `enforce-single-client-email-per-user.sql`
2. Paste and run
3. Check output for cleanup messages

**Or via CLI:**
```bash
supabase db push
```

### Step 2: Verify

Run `VERIFY_SINGLE_EMAIL_PER_USER.sql` to check:
- ✅ No violations (users with multiple active emails)
- ✅ Index exists
- ✅ Trigger exists
- ✅ Summary statistics

## What Happens

### For Existing Users

**Before Migration:**
- Some users might have multiple active emails
- No enforcement

**After Migration:**
- Duplicates are cleaned up (oldest kept, others deactivated)
- Unique constraint prevents new duplicates
- Trigger enforces rule going forward

### For New Users

**Registration:**
1. User registers
2. System checks: Does user have active email? **No**
3. Creates email: `kmcantila@gritsync.com`
4. Email is active and primary

**If Email Generation Runs Again:**
1. System checks: Does user have active email? **Yes** (`kmcantila@gritsync.com`)
2. Returns existing email (doesn't create new one)
3. User keeps original email ✅

### For Email Updates

**Switching Primary Email:**
```sql
SELECT set_primary_client_email('[user_id]', 'newemail@gritsync.com');
```

**What Happens:**
1. Finds the new email address
2. Deactivates ALL other client emails for that user
3. Activates and sets new email as primary
4. User now has only ONE active email ✅

## Benefits

1. ✅ **Data Integrity** - Database enforces the rule
2. ✅ **Automatic Cleanup** - Trigger handles edge cases
3. ✅ **No Duplicates** - Functions prevent creating multiple emails
4. ✅ **Safe Updates** - Helper function for switching emails
5. ✅ **Backwards Compatible** - Existing data is cleaned up automatically

## Edge Cases Handled

### Case 1: User Has Multiple Active Emails
**Solution:** Migration deactivates all except oldest

### Case 2: Email Generation Runs Multiple Times
**Solution:** Function checks for existing email and returns it

### Case 3: Manual Email Activation
**Solution:** Trigger automatically deactivates others

### Case 4: Concurrent Inserts
**Solution:** Unique index prevents database-level violations

## Verification Queries

### Check for Violations
```sql
SELECT user_id, COUNT(*) as active_count
FROM email_addresses
WHERE address_type = 'client' AND is_active = TRUE
GROUP BY user_id
HAVING COUNT(*) > 1;
```

**Should return:** 0 rows ✅

### Check User's Emails
```sql
SELECT 
  email_address,
  is_active,
  is_primary
FROM email_addresses
WHERE user_id = '[user_id]'
  AND address_type = 'client'
ORDER BY created_at DESC;
```

**Should show:** Only ONE with `is_active = TRUE` ✅

## Functions Available

### `create_client_email_address(user_id)`
- Creates email only if user doesn't have one
- Returns existing email if found
- Enforces one email per user

### `set_primary_client_email(user_id, email_address)`
- Safely switches primary email
- Deactivates all other emails
- Sets new email as active and primary

## Migration Output

When you run the migration, you'll see:

```
NOTICE: === Cleaning up duplicate client emails ===
NOTICE: User [id] has 2 active client emails
NOTICE:   Kept: [id] (oldest)
NOTICE:   Deactivated: 1 duplicate(s)
NOTICE: === Cleanup complete ===
NOTICE: ✅ All users have at most one active client email
```

## Testing

### Test 1: Try to Create Duplicate (Should Fail)
```sql
-- This should fail due to unique index
INSERT INTO email_addresses (
  email_address, user_id, address_type, is_active, is_primary
) VALUES (
  'test@gritsync.com', '[user_id]', 'client', TRUE, TRUE
);
-- Error: duplicate key value violates unique constraint
```

### Test 2: Activate New Email (Should Deactivate Old)
```sql
-- User has: oldemail@gritsync.com (active)
-- Activate: newemail@gritsync.com

UPDATE email_addresses
SET is_active = TRUE, is_primary = TRUE
WHERE email_address = 'newemail@gritsync.com'
  AND user_id = '[user_id]';

-- Result: newemail is active, oldemail is automatically deactivated
```

### Test 3: Generate Email Twice (Should Return Same)
```sql
-- First call
SELECT create_client_email_address('[user_id]');
-- Returns: kmcantila@gritsync.com

-- Second call (should return same, not create new)
SELECT create_client_email_address('[user_id]');
-- Returns: kmcantila@gritsync.com (same email)
```

## Files

1. **`enforce-single-client-email-per-user.sql`** - Main migration (apply this)
2. **`VERIFY_SINGLE_EMAIL_PER_USER.sql`** - Verification script
3. **`ONE_EMAIL_PER_USER_ENFORCEMENT.md`** - This documentation

## Summary

✅ **One active email per user** - Enforced at database level
✅ **Automatic cleanup** - Existing duplicates are resolved
✅ **Prevention** - Functions and triggers prevent new duplicates
✅ **Safe updates** - Helper function for switching emails
✅ **Verified** - Run verification script to confirm

## Apply Now

Run in Supabase SQL Editor:
```sql
-- Copy and paste enforce-single-client-email-per-user.sql
```

Or via migration:
```bash
supabase db push
```

Then verify:
```sql
-- Run VERIFY_SINGLE_EMAIL_PER_USER.sql
```

Done! Each user will now have exactly ONE active business email address. 🎉

