# Apply: One Email Per User Rule

## Quick Summary

**Rule:** Each user can only have **ONE active business/client email address**

## Apply Now (30 seconds)

### Step 1: Run Migration

1. Open **Supabase SQL Editor**
2. Copy **ENTIRE** contents of **`enforce-single-client-email-per-user.sql`**
3. Paste and click **Run**
4. Done! ✅

### Step 2: Verify (Optional)

Run **`VERIFY_SINGLE_EMAIL_PER_USER.sql`** to confirm it worked.

## What It Does

1. ✅ **Cleans up duplicates** - Keeps oldest email, deactivates others
2. ✅ **Adds unique constraint** - Database prevents multiple active emails
3. ✅ **Adds trigger** - Automatically deactivates old when activating new
4. ✅ **Updates functions** - Email creation checks for existing emails

## Expected Output

```
NOTICE: === Cleaning up duplicate client emails ===
NOTICE: User [id] has 2 active client emails
NOTICE:   Kept: [id] (oldest)
NOTICE:   Deactivated: 1 duplicate(s)
NOTICE: === Cleanup complete ===
NOTICE: ✅ All users have at most one active client email
```

## After Migration

### For Existing Users
- Multiple active emails → Only oldest remains active
- Others are deactivated (not deleted)

### For New Users
- Can only have ONE active email
- If generation runs twice, returns same email (no duplicate)

### For Email Updates
- Activating new email automatically deactivates old one
- Use `set_primary_client_email()` function for safe switching

## Verify It Worked

```sql
-- Should return 0 rows (no violations)
SELECT user_id, COUNT(*) as active_count
FROM email_addresses
WHERE address_type = 'client' AND is_active = TRUE
GROUP BY user_id
HAVING COUNT(*) > 1;
```

## Files

1. **`enforce-single-client-email-per-user.sql`** ← Run this!
2. `VERIFY_SINGLE_EMAIL_PER_USER.sql` - Verification
3. `ONE_EMAIL_PER_USER_ENFORCEMENT.md` - Full docs

## That's It!

Just run the migration and the rule is enforced! 🎉

