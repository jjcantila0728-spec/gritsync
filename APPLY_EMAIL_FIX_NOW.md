# Quick Fix: Apply Email Permanence Now

## What to Do

### Option 1: Run in Supabase SQL Editor (Easiest)

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the ENTIRE contents of `fix-permanent-email-generation.sql`
3. Click "Run"
4. Check the output messages - should see cleanup happening

### Option 2: Create Migration

```bash
# In your terminal
cd supabase/migrations

# The file is already created: fix-permanent-email-generation.sql
# Just push to Supabase
supabase db push
```

## What It Will Do

✅ **Fixes the functions** to check for existing emails before creating new ones
✅ **Cleans up duplicates** automatically (keeps oldest, deactivates rest)
✅ **Shows status** of all client emails after cleanup
✅ **Logs everything** so you can see what happened

## Expected Output

You should see logs like:

```
NOTICE: User: Karl Cantila has 2 email addresses, cleaning up...
NOTICE: Kept email [id] and deactivated others for user [id]
NOTICE: === Email Addresses Status ===
NOTICE: User: Karl Cantila | Client Email: klcantila1@gritsync.com | Active: t | Primary: t
```

## Verify It Worked

Run this query to check:

```sql
-- Should show only ONE active email per user
SELECT 
  u.first_name || ' ' || u.last_name as name,
  COUNT(ea.id) as total,
  COUNT(ea.id) FILTER (WHERE ea.is_active) as active,
  STRING_AGG(ea.email_address, ', ') as emails
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
WHERE u.role = 'client'
GROUP BY u.id, u.first_name, u.last_name;
```

Each user should have:
- `total`: May be 2+ if had duplicates
- `active`: Should be 1 (only one active)
- `emails`: Shows all (active ones listed)

## After Fix

From now on:
- ✅ Email addresses are permanent once created
- ✅ Running migrations multiple times won't create duplicates
- ✅ Each user keeps their FIRST (oldest) email address
- ✅ Any accidental duplicates are automatically deactivated

## Need to Manually Clean Up?

If you want to PERMANENTLY DELETE the inactive duplicates (not just deactivate):

```sql
-- Optional: Delete inactive duplicates permanently
DELETE FROM email_addresses
WHERE address_type = 'client'
  AND is_active = FALSE
  AND EXISTS (
    SELECT 1 FROM email_addresses ea2
    WHERE ea2.user_id = email_addresses.user_id
      AND ea2.address_type = 'client'
      AND ea2.is_active = TRUE
  );
```

**But this is optional - deactivated ones don't hurt anything!**

## Done!

After running the migration, the duplicate email issue is permanently fixed. Each user will keep their original email address forever.

