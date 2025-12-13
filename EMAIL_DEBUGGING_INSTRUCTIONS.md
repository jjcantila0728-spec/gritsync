# Email Fetch Debugging - Enhanced Logging

## 🔍 Situation

- GritSync email **EXISTS** in database: `klcantila@gritsync.com`
- Visible in Supabase UI: `public.active_email_addresses`
- BUT frontend still shows: `kmcantila@gmail.com`

## ✅ What I Just Added

### Enhanced Logging in NCLEXApplication.tsx

Added comprehensive console logging to debug exactly what's happening:

```typescript
🔍 Fetching GritSync email for user ID: [uuid]
🔍 User auth email: kmcantila@gmail.com
📊 Query result: { data: {...}, error: {...} }
```

### Fallback to active_email_addresses View

If the main query fails, the code now:
1. Tries `email_addresses` table first
2. If that fails, tries `active_email_addresses` view
3. If that fails, queries ALL emails for the user to see what exists
4. Shows detailed error information

## 🧪 Next Steps - PLEASE DO THIS

### Step 1: Refresh the Page

1. Go to: `http://localhost:5000/application/new`
2. Open browser console (F12 → Console tab)
3. Refresh the page (Ctrl+R or F5)

### Step 2: Check Console Output

Look for these messages in the console and **share what you see**:

#### Scenario A: Success ✅
```
🔍 Fetching GritSync email for user ID: [some-uuid]
🔍 User auth email: kmcantila@gmail.com
📊 Query result: { data: { email_address: 'klcantila@gritsync.com', ... }, error: null }
✅ GritSync email found in useEffect: klcantila@gritsync.com
```
**Result:** Email field should show `klcantila@gritsync.com`

#### Scenario B: Error on Main Query, Success on View ⚠️
```
🔍 Fetching GritSync email for user ID: [some-uuid]
🔍 User auth email: kmcantila@gmail.com
📊 Query result: { data: null, error: {...} }
❌ Error fetching GritSync email in useEffect: [error details]
🔄 Trying active_email_addresses view...
📊 View result: { data: { email_address: 'klcantila@gritsync.com' }, error: null }
✅ GritSync email found in VIEW: klcantila@gritsync.com
```
**Result:** Email field should show `klcantila@gritsync.com` (fetched from view)
**Issue:** RLS policy might be blocking main table access

#### Scenario C: No Data Found ❌
```
🔍 Fetching GritSync email for user ID: [some-uuid]
🔍 User auth email: kmcantila@gmail.com
📊 Query result: { data: null, error: null }
⚠️ No GritSync email found, using auth email: kmcantila@gmail.com
```
**Result:** Email field shows Gmail
**Issue:** Query returned empty (but email exists in DB)

#### Scenario D: Error on Everything ❌
```
🔍 Fetching GritSync email for user ID: [some-uuid]
🔍 User auth email: kmcantila@gmail.com
📊 Query result: { data: null, error: {...} }
❌ Error fetching GritSync email in useEffect: [error details]
🔄 Trying active_email_addresses view...
📊 View result: { data: null, error: {...} }
📊 All emails for user: null or []
```
**Result:** Email field shows Gmail
**Issue:** RLS policy or permissions blocking access

---

## 🔧 Possible Issues & Fixes

### Issue 1: Row Level Security (RLS) Policy

**Problem:** User doesn't have SELECT permission on `email_addresses` table

**Check:**
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'email_addresses';
```

**Fix:**
```sql
-- Enable RLS (if not enabled)
ALTER TABLE email_addresses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own emails
CREATE POLICY "Users can read own email addresses"
ON email_addresses
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- OR if you want everyone to read all emails:
CREATE POLICY "Anyone can read email addresses"
ON email_addresses
FOR SELECT
TO authenticated
USING (true);
```

### Issue 2: View Permissions

**Problem:** User doesn't have access to `active_email_addresses` view

**Fix:**
```sql
-- Grant access to the view
GRANT SELECT ON active_email_addresses TO authenticated;
```

### Issue 3: is_active = FALSE

**Problem:** Email exists but `is_active = false`

**Check:**
```sql
SELECT email_address, is_active, is_primary
FROM email_addresses
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com');
```

**Fix:**
```sql
UPDATE email_addresses
SET is_active = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com')
  AND address_type = 'client';
```

### Issue 4: is_primary = FALSE

**Problem:** Email exists but `is_primary = false`

**Check:** Same query as Issue 3

**Fix:**
```sql
UPDATE email_addresses
SET is_primary = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com')
  AND address_type = 'client';
```

### Issue 5: Multiple Client Emails

**Problem:** Multiple client emails exist, none marked as primary

**Check:**
```sql
SELECT email_address, address_type, is_primary, is_active, created_at
FROM email_addresses
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com')
  AND address_type = 'client'
ORDER BY created_at DESC;
```

**Fix:**
```sql
-- Set the most recent one as primary
WITH latest_email AS (
  SELECT id
  FROM email_addresses
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com')
    AND address_type = 'client'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE email_addresses
SET is_primary = true
WHERE id IN (SELECT id FROM latest_email);

-- Set all others as not primary
UPDATE email_addresses
SET is_primary = false
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com')
  AND address_type = 'client'
  AND id NOT IN (SELECT id FROM latest_email);
```

---

## 📋 Debugging Checklist

After refreshing the page, please share:

- [ ] What do you see in the browser console? (copy/paste the logs)
- [ ] Does the email field show `klcantila@gritsync.com` or still Gmail?
- [ ] Any error messages in red in the console?
- [ ] Run this query and share result:

```sql
SELECT 
  ea.email_address,
  ea.address_type,
  ea.is_primary,
  ea.is_active,
  ea.can_send,
  ea.can_receive,
  ea.created_at
FROM email_addresses ea
WHERE ea.user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com')
ORDER BY ea.created_at DESC;
```

---

## 🎯 What the Logs Will Tell Us

| Log Message | Meaning | Next Step |
|------------|---------|-----------|
| `✅ GritSync email found` | SUCCESS! Email fetched correctly | Nothing - it's working! |
| `❌ Error fetching...` | Query failed with error | Check RLS policies |
| `📊 All emails: []` | Query succeeded but returned empty | Check is_primary, is_active flags |
| `📊 All emails: null` | Query blocked by RLS | Fix RLS policy |
| `✅ Found in VIEW` | Main table blocked, but view works | Update main table RLS |

---

## 🚀 Quick Fix (If RLS is the Issue)

If you see RLS errors in console, run this:

```sql
-- Quick fix for RLS
DROP POLICY IF EXISTS "Users can read own email addresses" ON email_addresses;

CREATE POLICY "Users can read own email addresses"
ON email_addresses
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Ensure user has access
GRANT SELECT ON email_addresses TO authenticated;
GRANT SELECT ON active_email_addresses TO authenticated;
```

---

**Please refresh the page and share the console output!** 🙏

That will tell us exactly what's going wrong and how to fix it.

