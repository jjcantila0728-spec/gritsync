# Fix Krizza's Email - Step by Step

## Problem
Active email in `email_addresses` table is NOT showing `kmcantila@gritsync.com`

## Solution - Two Steps

### Step 1: Diagnose (See What's Wrong)

1. Open **Supabase SQL Editor**
2. Copy and paste contents of **`DIAGNOSE_KRIZZA_EMAIL.sql`**
3. Click **Run**
4. Review the output - it shows:
   - User record
   - All email addresses
   - What email should be generated
   - If conflicts exist

**Look for:**
- What is the current `first_name` in users table?
- What emails exist for this user?
- Is `kmcantila@gritsync.com` already in the database?

### Step 2: Force Fix (Apply the Fix)

1. Still in SQL Editor
2. Copy and paste contents of **`FORCE_FIX_KRIZZA_EMAIL.sql`**
3. Click **Run**
4. Check the output messages

**Expected output:**
```
NOTICE: ✅ Activated existing email: kmcantila@gritsync.com
OR
NOTICE: ✅ Created new email: kmcantila@gritsync.com
NOTICE: ✅ Email fix complete
```

## What the Fix Does

1. ✅ Updates user record: `first_name = 'Krizza Mae'`, `middle_name = NULL`
2. ✅ Deactivates ALL existing client emails for this user
3. ✅ Handles conflicts if `kmcantila@gritsync.com` exists elsewhere
4. ✅ Creates or activates `kmcantila@gritsync.com` as active and primary
5. ✅ Verifies the result

## Verify After Fix

Run this query to confirm:

```sql
SELECT 
  email_address,
  is_active,
  is_primary,
  is_verified
FROM email_addresses
WHERE email_address = 'kmcantila@gritsync.com';
```

**Should show:**
- `email_address`: kmcantila@gritsync.com
- `is_active`: **true**
- `is_primary`: **true**
- `is_verified`: **true**

## If Still Not Working

### Check for Unique Constraint Issue

```sql
-- Check if email exists for another user
SELECT 
  ea.email_address,
  u.first_name || ' ' || u.last_name as owner,
  ea.user_id
FROM email_addresses ea
JOIN users u ON u.id = ea.user_id
WHERE ea.email_address = 'kmcantila@gritsync.com';
```

### Check if User Was Found

```sql
-- Verify user exists
SELECT id, first_name, middle_name, last_name
FROM users
WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
  AND last_name ILIKE '%cantila%';
```

### Manual Fix (If Needed)

If the script didn't work, manually run:

```sql
-- 1. Find user ID
SELECT id FROM users 
WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
  AND last_name ILIKE '%cantila%';

-- 2. Deactivate all emails (replace [user_id] with actual ID)
UPDATE email_addresses
SET is_active = FALSE, is_primary = FALSE
WHERE user_id = '[user_id]' AND address_type = 'client';

-- 3. Insert the correct email (replace [user_id] with actual ID)
INSERT INTO email_addresses (
  email_address,
  display_name,
  user_id,
  is_system_address,
  address_type,
  is_active,
  is_verified,
  is_primary,
  can_send,
  can_receive
) VALUES (
  'kmcantila@gritsync.com',
  'Krizza Mae Cantila',
  '[user_id]',
  FALSE,
  'client',
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE
)
ON CONFLICT (email_address) DO UPDATE
SET 
  user_id = EXCLUDED.user_id,
  is_active = TRUE,
  is_primary = TRUE,
  is_verified = TRUE,
  updated_at = NOW();
```

## Files to Use

1. **`DIAGNOSE_KRIZZA_EMAIL.sql`** - Run first (diagnostics)
2. **`FORCE_FIX_KRIZZA_EMAIL.sql`** - Run second (fix)
3. `FIX_KRIZZA_EMAIL_STEP_BY_STEP.md` - This guide

## Expected Final State

After running the fix:

```sql
SELECT email_address, is_active, is_primary
FROM email_addresses
WHERE email_address = 'kmcantila@gritsync.com';
```

**Result:**
```
email_address            | is_active | is_primary
-------------------------|-----------|------------
kmcantila@gritsync.com   | true      | true
```

## Done!

After Step 2, refresh your app - the email should now show as `kmcantila@gritsync.com` in the active email_addresses table! ✨

