# Email Generation: Compound First Names Support

## New Logic

### Rule 1: Compound First Names (2 words)
**If first name has 2 words, use first letter of each word**

Examples:
- `Joy Jeric Cantila` → `jjcantila@gritsync.com`
- `Krizza Mae Cantila` → `kmcantila@gritsync.com`
- `Mary Jane Smith` → `mjsmith@gritsync.com`
- `John Paul Doe` → `jpdoe@gritsync.com`

### Rule 2: Single First Name + Middle Name
**If first name is 1 word and has middle name, use first letter of each**

Examples:
- `Karl Louie Cantila` → `klcantila@gritsync.com`
- `Maria Teresa Santos` → `mtsantos@gritsync.com`
- `John Michael Doe` → `jmdoe@gritsync.com`

### Rule 3: Single First Name Only
**If only first name (no middle name or compound), use just first initial**

Examples:
- `John Doe` → `jdoe@gritsync.com`
- `Maria Santos` → `msantos@gritsync.com`

## How It Works

### Detection Logic

```sql
-- 1. Split first_name by spaces
first_name_words = SPLIT("Joy Jeric", " ")  -- ["Joy", "Jeric"]

-- 2. Count words
word_count = 2

-- 3. Apply logic based on count
IF word_count >= 2:
  -- Compound: use first letter of word 1 + first letter of word 2
  initials = "j" + "j" = "jj"
  
ELSE IF middle_name exists:
  -- Single + middle: use first letter of first + first letter of middle
  initials = "k" + "l" = "kl"
  
ELSE:
  -- Single only: use first letter of first name
  initials = "j"
```

### Full Examples

| First Name | Middle Name | Last Name | Generated Email |
|------------|-------------|-----------|-----------------|
| Joy Jeric | - | Cantila | jjcantila@gritsync.com |
| Krizza Mae | - | Cantila | kmcantila@gritsync.com |
| Karl | Louie | Cantila | klcantila@gritsync.com |
| Maria | Teresa | Santos | mtsantos@gritsync.com |
| John | - | Doe | jdoe@gritsync.com |
| Mary Jane Rose | - | Smith | mjsmith@gritsync.com |

Note: 3+ word first names use first 2 words only.

## Implementation

### Files Modified

1. **`update-email-generation-compound-names.sql`**
   - New `generate_client_email()` function
   - Handles compound first names
   - Includes test cases
   - Shows preview of changes

### How to Apply

#### Method 1: Run in SQL Editor (Recommended)

1. Go to Supabase SQL Editor
2. Copy contents of `update-email-generation-compound-names.sql`
3. Run it
4. Check the test output and preview

#### Method 2: As Migration

```bash
supabase db push
```

### What Happens

When you run the migration:

1. ✅ Updates the `generate_client_email()` function
2. ✅ Runs test cases showing examples
3. ✅ Shows preview of how existing users would be affected
4. ⚠️ **Does NOT change existing emails** (they remain permanent)

## For New Users

All new user registrations will automatically use the new logic:

1. User registers with name "Joy Jeric Cantila"
2. System detects compound first name
3. Generates email: `jjcantila@gritsync.com`
4. Email is permanent once created

## For Existing Users

**Existing emails are NOT changed automatically** (they remain permanent).

If you want to update existing users:

### Option A: Preview Changes Only

```sql
-- See what would change
SELECT 
  u.first_name,
  u.middle_name,
  u.last_name,
  ea.email_address as current,
  generate_client_email(u.first_name, u.middle_name, u.last_name) as new_format
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE u.role = 'client' AND ea.is_active = TRUE;
```

### Option B: Regenerate Specific User

```sql
-- Manually regenerate for one user
DO $$
DECLARE
  v_user_id UUID := 'user-uuid-here';
BEGIN
  -- Deactivate old
  UPDATE email_addresses
  SET is_active = FALSE
  WHERE user_id = v_user_id AND address_type = 'client';
  
  -- Create new
  PERFORM create_client_email_address(v_user_id);
END $$;
```

### Option C: Bulk Regenerate

Use `REGENERATE_EMAILS_WITH_NEW_LOGIC.sql` to:
- Preview all changes
- Regenerate for users with compound names
- Verify results

**⚠️ WARNING:** Only do this if you're sure! Email addresses should generally remain permanent.

## Testing

The migration includes automatic tests:

```
Test 1: Joy Jeric Cantila → jjcantila@gritsync.com
Test 2: Krizza Mae Cantila → kmcantila@gritsync.com
Test 3: Karl Louie Cantila → klcantila@gritsync.com
Test 4: John Doe → jdoe@gritsync.com
Test 5: Mary Jane Rose Smith → mjsmith@gritsync.com
```

All tests run automatically when you apply the migration.

## Collision Handling

If generated email already exists, adds number suffix:

```
jjcantila@gritsync.com (exists)
→ jjcantila1@gritsync.com

jjcantila1@gritsync.com (exists)
→ jjcantila2@gritsync.com
```

## Special Cases

### Three+ Word First Names
Uses first 2 words only:
- `Mary Jane Rose Smith` → `mjsmith@gritsync.com` (M + J)

### Names with Special Characters
Removes from lastname:
- `O'Brien` → `obrien`
- `De La Cruz` → `delacruz`

### Single Letter Names
Works fine:
- `A B Cruz` → `abcruz@gritsync.com`

## Backwards Compatibility

- ✅ Old emails remain valid
- ✅ Old logic still works for existing users
- ✅ New logic only applies to new generations
- ✅ No breaking changes

## Summary

✅ Compound first names use both initials (jj, km)
✅ Single names with middle use both initials (kl)
✅ Single names only use first initial (j)
✅ Existing emails remain permanent
✅ New users get smart email generation
✅ Easy to test and preview
✅ Handles collisions automatically

## Files

1. `update-email-generation-compound-names.sql` - Main migration
2. `REGENERATE_EMAILS_WITH_NEW_LOGIC.sql` - Optional regeneration script
3. `EMAIL_GENERATION_COMPOUND_NAMES.md` - This documentation

## Apply Now

Run in Supabase SQL Editor:
```sql
-- Copy and paste update-email-generation-compound-names.sql
```

Or via migration:
```bash
supabase db push
```

Check the test output to verify it works correctly!

