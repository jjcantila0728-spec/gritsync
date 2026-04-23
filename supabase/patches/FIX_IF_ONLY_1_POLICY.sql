-- FIX: If only 1 policy was created instead of 6
-- Run this if CHECK_WHAT_WAS_CREATED.sql shows fewer than 6 policies

-- Step 1: Check what policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'users';

-- Step 2: Drop all existing policies
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- Step 3: Create ALL 6 policies one by one (with error handling)

-- Policy 1: Users can view their own profile (CRITICAL)
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Admins can view all users
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Policy 4: Admins can update all users
CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Policy 5: Service role can insert users
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 6: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 4: Verify all 6 were created
SELECT 
  'Verification' as status,
  COUNT(*) as policies_created,
  CASE 
    WHEN COUNT(*) = 6 THEN 'SUCCESS ✅ All 6 policies created'
    WHEN COUNT(*) < 6 THEN 'WARNING ⚠️ Only ' || COUNT(*) || ' policies created'
    ELSE 'ERROR ❌ Unexpected count'
  END as result
FROM pg_policies 
WHERE tablename = 'users';

-- List them
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users' ORDER BY policyname;

