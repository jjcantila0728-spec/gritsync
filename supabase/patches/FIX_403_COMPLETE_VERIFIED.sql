-- FIX: 403 Errors - Complete Fix with Verification
-- Run this ENTIRE script in Supabase SQL Editor
-- This fixes all 403 permission errors and verifies admin role

-- ============================================================================
-- STEP 1: Verify and fix admin role in auth.users metadata
-- Replace 'YOUR_ADMIN_USER_ID' with your actual admin user ID
-- Or run the query below to find your admin user ID first
-- ============================================================================

-- First, let's check if admin role is set correctly
-- Run this to see your user ID and current role:
-- SELECT id, email, raw_user_meta_data->>'role' as role FROM auth.users WHERE email = 'your-admin-email@example.com';

-- Update admin role in auth.users metadata (replace with your admin user ID)
-- Uncomment and update the line below with your admin user ID:
-- UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb WHERE id = 'YOUR_ADMIN_USER_ID';

-- ============================================================================
-- STEP 2: Drop all existing policies on users table to start fresh
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Create basic user policies (users can view/update their own profile)
-- ============================================================================
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STEP 4: Create admin policies using auth.users metadata (NO RLS RECURSION)
-- This is the CRITICAL fix - check auth.users directly, not public.users
-- ============================================================================
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  -- Check auth.users metadata directly (no RLS on auth schema = no recursion)
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================================
-- STEP 5: Service role can insert (for triggers)
-- ============================================================================
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- STEP 6: Update is_admin() function to use auth.users (for other uses)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Use auth.users metadata directly (no RLS recursion)
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 7: Grant necessary permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ============================================================================
-- STEP 8: Fix application_payments policy for admin access
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all payments" ON application_payments;
CREATE POLICY "Admins can view all payments"
ON application_payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
  OR auth.uid() = user_id
);

-- ============================================================================
-- STEP 9: Update trigger function to include all required fields
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  -- Generate unique GRIT-ID (required field)
  new_grit_id := generate_grit_id();
  
  -- Extract first_name and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Insert user profile with all required fields
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'),
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW();
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'))
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the trigger
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 10: Ensure generate_grit_id() function exists
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_grit_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric ID
    new_id := UPPER(
      SUBSTRING(
        MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT),
        1, 8
      )
    );
    
    -- Check if this ID already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE grit_id = new_id) INTO exists_check;
    
    -- If it doesn't exist, we're done
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 11: DIAGNOSTIC QUERIES - Run these to verify everything is set up correctly
-- ============================================================================

-- Check your current user's role in auth.users:
-- SELECT id, email, raw_user_meta_data->>'role' as role
-- FROM auth.users 
-- WHERE id = auth.uid();

-- Check if you can see all users (should work if you're admin):
-- SELECT COUNT(*) FROM users WHERE role = 'client';

-- Check RLS policies on users table:
-- SELECT * FROM pg_policies WHERE tablename = 'users';

-- ============================================================================
-- STEP 12: MANUAL FIX - If you're still getting 403, run this with your admin email
-- Replace 'your-admin-email@example.com' with your actual admin email
-- ============================================================================
-- UPDATE auth.users 
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE email = 'your-admin-email@example.com';

-- Also update the public.users table to match:
-- UPDATE public.users 
-- SET role = 'admin'
-- WHERE email = 'your-admin-email@example.com';

