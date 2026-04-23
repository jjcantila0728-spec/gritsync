-- Fix RLS policy to allow admins to upload/update files in user folders
-- This migration adds UPDATE policy for admins and ensures INSERT policy works correctly
-- 
-- IMPORTANT: Run this in Supabase SQL Editor
-- The issue is that when using upsert: true, Supabase tries to UPDATE existing files,
-- but there's no UPDATE policy for admins, causing "new row violates row-level security policy" errors

-- Ensure the is_admin_user() function exists (it should already exist from fix-storage-policies.sql)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$;

-- Drop existing admin UPDATE policy if it exists (INSERT and DELETE should already exist)
DROP POLICY IF EXISTS "Admins can update all documents" ON storage.objects;

-- Create UPDATE policy for admins (allows updating/overwriting existing files)
-- This is needed when using upsert: true in storage.upload()
CREATE POLICY "Admins can update all documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
)
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Verify the policies were created
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND (policyname LIKE '%admin%' OR policyname LIKE '%Admin%')
ORDER BY policyname;

