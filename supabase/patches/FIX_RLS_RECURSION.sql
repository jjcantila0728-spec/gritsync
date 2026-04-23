-- FIX: Infinite Recursion in RLS Policy for Users Table
-- Run this in Supabase SQL Editor to fix the recursion error

-- Step 1: Drop the problematic is_admin() function
DROP FUNCTION IF EXISTS public.is_admin();

-- Step 2: Create a new is_admin() function that uses auth.jwt() instead of querying users table
-- This avoids recursion by reading the role from the JWT token metadata
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Try to get role from JWT claims first (set during login)
  IF (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Fallback: Check auth.users metadata (no RLS on auth schema)
  -- This is safe because auth.users is not subject to RLS
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Alternative approach - Use a simpler function that checks auth.users directly
-- This avoids the recursion because auth.users is not subject to RLS
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND (
      raw_user_meta_data->>'role' = 'admin'
      OR id IN (
        SELECT id FROM public.users WHERE role = 'admin'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 4: Update the admin policies to use a direct check instead of the function
-- This is the safest approach - check auth.users directly (no RLS recursion)
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      auth.users.raw_user_meta_data->>'role' = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
      )
    )
  )
);

-- Actually, the above still has recursion. Let's use a better approach:
-- Check the role directly from auth.users metadata (no RLS on auth schema)
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
  OR
  -- Direct check without function call
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

-- Wait, that still causes recursion. The best solution is to:
-- 1. Store role in auth.users metadata during signup
-- 2. Check only auth.users (no RLS) for admin check

-- Final solution: Check auth.users metadata only (no RLS recursion)
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can update all users" ON users;
CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Step 5: Update the trigger function to set role in auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'client', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- Update auth metadata with role (for RLS checks)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "client"}'::jsonb
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Update existing users to have role in metadata
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', COALESCE(
    (SELECT role FROM public.users WHERE id = auth.users.id),
    'client'
  ))
WHERE raw_user_meta_data->>'role' IS NULL;

-- Done! The recursion should be fixed now.
-- The admin check now reads from auth.users metadata (no RLS) instead of querying public.users

