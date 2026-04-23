-- Fix app_metadata storage issue
-- This migration fixes the "column app_metadata does not exist" error
-- by updating the is_admin_user() function to handle missing app_metadata gracefully

-- ============================================================================
-- STEP 1: Update is_admin_user() function to handle app_metadata safely
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Primary check: auth.users raw_user_meta_data (most reliable, no RLS recursion)
  -- This is what other migrations use and is the standard approach
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (raw_user_meta_data->>'role')::text = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: check public.users table role column
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, try both checks as fallback
    RETURN (
      EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND (raw_user_meta_data->>'role')::text = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
    );
END;
$$;

-- ============================================================================
-- STEP 2: Create alternative admin check function that doesn't use app_metadata
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_user_safe()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Primary check: auth.users raw_user_meta_data (most reliable, no RLS recursion)
  -- This matches the pattern used in other migrations
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (raw_user_meta_data->>'role')::text = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: check public.users table role column
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  );
END;
$$;

-- ============================================================================
-- STEP 3: Update storage policies to use the safer function
-- ============================================================================

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can upload all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete all documents" ON storage.objects;

-- Also drop any other admin-related policies that might exist
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE '%admin%'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Recreate admin policies with safer function
CREATE POLICY "Admins can upload all documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
);

CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
);

CREATE POLICY "Admins can update all documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
)
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
);

CREATE POLICY "Admins can delete all documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user_safe()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Diagnostic: Check where admin role is stored for current user
SELECT 
  auth.uid() as current_user_id,
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) as role_in_auth_users,
  (SELECT role FROM public.users WHERE id = auth.uid()) as role_in_public_users,
  public.is_admin_user() as is_admin_original,
  public.is_admin_user_safe() as is_admin_safe;

-- If functions return false, you may need to set the admin role:
-- Option 1: Set in auth.users (recommended)
-- UPDATE auth.users 
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE id = auth.uid();
--
-- Option 2: Set in public.users
-- UPDATE public.users 
-- SET role = 'admin'
-- WHERE id = auth.uid();

-- Check that policies were created
SELECT 
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%admin%'
ORDER BY policyname;

