-- FIX: Clients Not Showing in Admin Clients Page
-- Run this in Supabase SQL Editor to fix the issue

-- ============================================================================
-- STEP 1: Update the trigger function to include first_name, last_name, and grit_id
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
-- STEP 2: Fix the admin policy to use auth.users metadata directly (avoids RLS recursion)
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (
  -- Check auth.users metadata directly (no RLS on auth schema, so no recursion)
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can update all users" ON users;
CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
TO authenticated
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================================================
-- STEP 3: Update is_admin() function to use auth.users metadata (for other uses)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Use auth.users metadata instead of querying public.users to avoid RLS recursion
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND (raw_user_meta_data->>'role' = 'admin' OR app_metadata->>'role' = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 4: Grant necessary permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.users TO authenticated;

-- ============================================================================
-- STEP 5: Ensure generate_grit_id() function exists (if not already created)
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

