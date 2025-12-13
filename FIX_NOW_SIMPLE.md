# Quick Fix: Krizza's Email Not Showing as Active

## The Problem
`kmcantila@gritsync.com` is not showing as active in `email_addresses` table

## Solution (Choose One)

### Option 1: All-in-One Fix (Recommended - 1 Step)

1. Open **Supabase SQL Editor**
2. Copy **ENTIRE** contents of **`FIX_KRIZZA_ALL_IN_ONE.sql`**
3. Paste and click **Run**
4. Done! ✅

**What it does:**
- Shows current state (diagnostic)
- Fixes user name if split
- Deactivates old emails
- Creates/activates `kmcantila@gritsync.com`
- Verifies the result

---

### Option 2: Step-by-Step (If you want to see details)

**Step 1:** Run `DIAGNOSE_KRIZZA_EMAIL.sql` to see what's wrong

**Step 2:** Run `FORCE_FIX_KRIZZA_EMAIL.sql` to apply the fix

---

## What to Expect

After running, you'll see output like:

```
✅ Found user ID: [uuid]
✅ Updated user name: first_name = "Krizza Mae", middle_name = NULL
✅ Deactivated all existing client emails
✅ Created/Updated email: kmcantila@gritsync.com
✅ FIX COMPLETE!
```

Then verification shows:
```
email_address            | is_active | is_primary
-------------------------|-----------|------------
kmcantila@gritsync.com   | true      | true
```

## Verify It Worked

Run this query:

```sql
SELECT 
  email_address,
  is_active,
  is_primary
FROM email_addresses
WHERE email_address = 'kmcantila@gritsync.com';
```

**Should show:**
- `email_address`: `kmcantila@gritsync.com`
- `is_active`: `true` ✅
- `is_primary`: `true` ✅

## Files Available

1. **`FIX_KRIZZA_ALL_IN_ONE.sql`** ← EASIEST (recommended)
2. `DIAGNOSE_KRIZZA_EMAIL.sql` - Diagnostic only
3. `FORCE_FIX_KRIZZA_EMAIL.sql` - Fix only
4. `FIX_KRIZZA_EMAIL_STEP_BY_STEP.md` - Detailed guide

## That's It!

Just run `FIX_KRIZZA_ALL_IN_ONE.sql` and the email will be fixed! 🎉

