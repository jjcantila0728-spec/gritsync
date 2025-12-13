# Fix Karl's Email Right Now

## Current Issue
Email shows: `klcantila1@gritsync.com`
Should be: `klcantila@gritsync.com`

## Solution (30 seconds)

### Step 1: Open Supabase SQL Editor
Go to: Supabase Dashboard → SQL Editor → New Query

### Step 2: Copy & Paste
Copy the ENTIRE contents of **`FIX_KARL_EMAIL_NOW.sql`**

### Step 3: Run
Click the **Run** button

### Step 4: Check Output
You should see:

```
NOTICE: Found user: Karl Louie Cantila
NOTICE: Current email: klcantila1@gritsync.com
NOTICE: Deactivated: klcantila1@gritsync.com
NOTICE: Created new email: klcantila@gritsync.com
NOTICE: ✅ Email updated successfully!
NOTICE: Old: klcantila1@gritsync.com → New: klcantila@gritsync.com
```

## What It Does

1. ✅ Updates the email generation function (with compound name logic)
2. ✅ Finds Karl Cantila's user record
3. ✅ Deactivates old email (`klcantila1@gritsync.com`)
4. ✅ Creates new email (`klcantila@gritsync.com`)
5. ✅ Shows the result

## Verify

After running, refresh your app or check with:

```sql
SELECT email_address, is_active
FROM email_addresses
WHERE email_address LIKE '%cantila%'
ORDER BY created_at DESC;
```

Should show:
- ✅ `klcantila@gritsync.com` (active)
- ✗ `klcantila1@gritsync.com` (inactive)

## Done!

The email will immediately update throughout the app. No need to restart anything.

New email: **klcantila@gritsync.com** ✨

