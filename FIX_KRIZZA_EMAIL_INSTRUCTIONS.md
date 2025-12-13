# Fix Krizza Mae Cantila's Email

## Current Issue
- Name: **Krizza Mae Cantila** (compound first name)
- Current email might be wrong (like `klcantila1@gritsync.com`)
- Should be: **`kmcantila@gritsync.com`** (K + M + cantila)

## Quick Fix (30 seconds)

### Step 1: Open Supabase SQL Editor
Go to: Supabase Dashboard → SQL Editor → New Query

### Step 2: Copy & Paste
Copy the ENTIRE contents of **`FIX_KRIZZA_EMAIL_NOW.sql`**

### Step 3: Run
Click the **Run** button

### Step 4: Check Output
You should see:

```
NOTICE: Found user: Krizza Mae Cantila
NOTICE: Current email: klcantila1@gritsync.com (or whatever it was)
NOTICE: Expected email: kmcantila@gritsync.com
NOTICE: Deactivated old email: klcantila1@gritsync.com
NOTICE: Created new email: kmcantila@gritsync.com
NOTICE: ✅ Email updated successfully!
```

## What It Does

1. ✅ Updates the email generation function (compound name logic)
2. ✅ Finds Krizza Mae Cantila automatically
3. ✅ Checks if name is split (first_name="Krizza", middle_name="Mae")
4. ✅ Combines into compound first name if needed
5. ✅ Deactivates old email
6. ✅ Creates new email: **`kmcantila@gritsync.com`**
7. ✅ Tests that the generation is correct

## Email Logic

For **Krizza Mae Cantila**:
- Compound first name: "Krizza" + "Mae" (2 words)
- Logic: First letter of each word
- K + M + cantila = **`kmcantila@gritsync.com`**

## Verify

After running, check with:

```sql
SELECT 
  u.first_name,
  ea.email_address,
  ea.is_active
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE u.first_name ILIKE '%krizza%'
  AND ea.address_type = 'client';
```

Should show:
- ✅ `kmcantila@gritsync.com` (active)
- ✗ Old email (inactive)

## Expected Result

**New Email:** `kmcantila@gritsync.com` ✨

The email will update immediately throughout the app!

## If Name Was Split

If the database had:
- `first_name = "Krizza"`
- `middle_name = "Mae"`

The script will:
1. Combine them to: `first_name = "Krizza Mae"`
2. Set `middle_name = NULL`
3. Generate email using compound logic: `kmcantila@gritsync.com`

## Done!

Just run the SQL file and Krizza's email will be fixed! 🎉

