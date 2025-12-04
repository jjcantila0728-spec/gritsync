# 🔧 FINAL FIX: Step-by-Step Troubleshooting for 403 Error

Since you're still getting 403 errors, let's diagnose and fix this systematically.

## ⚠️ IMPORTANT: Run These Steps in Order

### STEP 1: Verify What's Actually Wrong

Run this in Supabase SQL Editor to see the current state:

```sql
-- Check 1: Does user exist in auth.users?
SELECT 'auth.users' as source, id, email, raw_user_meta_data->>'role' as role
FROM auth.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 2: Does user exist in public.users?
SELECT 'public.users' as source, id, email, role, grit_id
FROM public.users 
WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';

-- Check 3: What policies exist?
SELECT policyname, cmd, roles::text as roles
FROM pg_policies 
WHERE tablename = 'users';

-- Check 4: Is RLS enabled?
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
```

**Write down the results** - this tells us what's missing.

---

### STEP 2: Run the Simple Fix

Run `SIMPLE_FIX_403.sql` in Supabase SQL Editor. This is the most direct fix.

**After running, check the output:**
- Should show "Policies created: 6"
- Should show "User profile exists: 1"

If either shows 0, that's the problem.

---

### STEP 3: If User Profile is Missing

If Check 2 in Step 1 returned 0 rows, run this:

```sql
-- Create the user profile
INSERT INTO public.users (id, email, role, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client'),
  'GRIT' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0'),
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = COALESCE(EXCLUDED.role, users.role),
  updated_at = NOW();
```

---

### STEP 4: If Policies Are Missing

If Check 3 in Step 1 shows fewer than 6 policies, run this:

```sql
-- Drop all existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- Create the critical SELECT policy
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create UPDATE policy
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create admin policies
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Create INSERT policies
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
```

---

### STEP 5: Test RLS Policy Directly

Run this to simulate what happens when your app tries to read the user:

```sql
-- Simulate the user query
SET request.jwt.claim.sub = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
SELECT * FROM users WHERE id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50';
RESET request.jwt.claim.sub;
```

**If this returns no rows**, the RLS policy isn't working. The issue is with the policy definition.

**If this returns a row**, the policy works, but something else is wrong (maybe the JWT token in your app).

---

### STEP 6: Check Browser Session

In your browser console (F12), run:

```javascript
// Check if you're actually authenticated
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
console.log('User ID:', session?.user?.id)
```

**The User ID should match:** `03a0bd9f-c3e3-4b1d-ab74-93318b295f50`

If it doesn't match, you're logged in as a different user.

---

### STEP 7: Clear Everything and Try Again

1. **Sign out** completely from your app
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Close all browser tabs** with your app
4. **Open a new tab** and go to your app
5. **Sign in again**

---

### STEP 8: Nuclear Option - Test Without RLS

**⚠️ ONLY FOR TESTING - DO NOT LEAVE THIS ON**

```sql
-- Temporarily disable RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

**Test your app now.** If it works, the problem is definitely with the RLS policies.

**Then immediately re-enable RLS:**
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

And recreate the policies using Step 4.

---

## 🎯 Most Common Issues

### Issue 1: Policy uses wrong syntax
**Fix:** Make sure the policy uses `auth.uid() = id` (not `auth.uid() = users.id`)

### Issue 2: User profile doesn't exist
**Fix:** Run Step 3 to create it

### Issue 3: Policies weren't created
**Fix:** Run Step 4 to create them

### Issue 4: Wrong user ID
**Fix:** Check Step 6 - make sure you're logged in as the right user

### Issue 5: RLS not enabled
**Fix:** Run `ALTER TABLE users ENABLE ROW LEVEL SECURITY;`

---

## 📋 Checklist

Before saying it's still broken, verify:

- [ ] User exists in `auth.users` (Step 1, Check 1)
- [ ] User exists in `public.users` (Step 1, Check 2)
- [ ] 6 policies exist (Step 1, Check 3)
- [ ] RLS is enabled (Step 1, Check 4)
- [ ] Test query works (Step 5)
- [ ] Browser session matches user ID (Step 6)
- [ ] Cleared cache and signed in again (Step 7)

If all of these are ✅ and you still get 403, there might be a Supabase configuration issue. Share the results of Step 1 and I can help further.







