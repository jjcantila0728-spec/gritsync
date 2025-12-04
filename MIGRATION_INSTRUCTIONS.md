# Database Migration Instructions - Login Attempts Tracking

## ⚠️ Important: Copy ONLY the SQL Content

The error you're seeing (`import { getSupabaseAdmin }`) means JavaScript code was copied instead of SQL.

**Make sure you're copying from**: `supabase/migrations/add_login_attempts_tracking.sql`

**NOT from**: `server/utils/loginAttempts.js` (that's JavaScript, not SQL!)

---

## 📋 Step-by-Step Instructions

### Step 1: Open the Correct File
1. In your code editor, open: `supabase/migrations/add_login_attempts_tracking.sql`
2. **Verify** the file starts with: `-- Login Attempts Tracking Migration`
3. **Verify** it contains SQL commands like `CREATE TABLE`, `CREATE FUNCTION`, etc.
4. **DO NOT** open `server/utils/loginAttempts.js` (that's JavaScript)

### Step 2: Copy the SQL
1. Select **ALL** the content in `add_login_attempts_tracking.sql`
2. Copy it (Ctrl+C or Cmd+C)
3. The content should start with:
   ```sql
   -- Login Attempts Tracking Migration
   -- This migration adds login attempt tracking and account lockout functionality
   
   -- Create login_attempts table
   CREATE TABLE IF NOT EXISTS login_attempts (
   ```

### Step 3: Paste into Supabase
1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Click **New Query**
4. **Paste** the SQL content
5. **Verify** the pasted content is SQL (starts with `--` comments and `CREATE TABLE`)
6. **DO NOT** paste if you see `import` or `export` statements (that's JavaScript!)

### Step 4: Run the Migration
1. Click **Run** button (or press Ctrl+Enter)
2. Wait for execution
3. Check for errors in the results panel

---

## ✅ Expected Result

You should see:
- ✅ "Success. No rows returned" or similar success message
- ✅ No error messages
- ✅ Query executed successfully

---

## 🔍 Verification

After running, verify it worked:

```sql
-- Check if table exists
SELECT * FROM login_attempts LIMIT 1;

-- Check if column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'locked_until';

-- Test function
SELECT get_failed_login_attempts('test@example.com', 15);
```

---

## 🐛 Troubleshooting

### Error: "syntax error at or near import"
**Problem**: JavaScript code was copied instead of SQL

**Solution**:
1. Close Supabase SQL Editor
2. Open `supabase/migrations/add_login_attempts_tracking.sql` in your code editor
3. Verify it's SQL (starts with `--` comments)
4. Copy again
5. Paste into Supabase

### Error: "relation already exists"
**Problem**: Migration was already run

**Solution**: This is OK! The `IF NOT EXISTS` clauses handle this. The migration is safe to run multiple times.

### Error: "permission denied"
**Problem**: Insufficient permissions

**Solution**: 
1. Ensure you're using Supabase admin account
2. Or use Service Role key in connection settings

---

## 📝 Quick Copy-Paste Checklist

Before pasting into Supabase, verify:
- [ ] File is `add_login_attempts_tracking.sql` (not `.js`)
- [ ] Content starts with `-- Login Attempts Tracking Migration`
- [ ] Contains `CREATE TABLE` statements
- [ ] Contains `CREATE FUNCTION` statements
- [ ] **NO** `import` or `export` statements
- [ ] **NO** `const` or `function` JavaScript keywords

---

## 🎯 Correct File to Use

**✅ CORRECT**: `supabase/migrations/add_login_attempts_tracking.sql`
- Starts with SQL comments: `--`
- Contains SQL commands: `CREATE TABLE`, `CREATE FUNCTION`
- File extension: `.sql`

**❌ WRONG**: `server/utils/loginAttempts.js`
- Contains JavaScript: `import`, `export`
- File extension: `.js`
- This is NOT SQL!

---

If you're still having issues, make sure you're opening the `.sql` file, not the `.js` file!

