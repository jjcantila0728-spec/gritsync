-- Fix Quotations Delete Policy
-- This ensures admins can delete all quotations, including those with NULL user_id
-- Uses a SECURITY DEFINER function to avoid RLS recursion issues

-- Step 1: Create or replace a SECURITY DEFINER function to check admin status
-- This function runs with elevated privileges and can access auth.users without RLS
CREATE OR REPLACE FUNCTION public.is_admin_for_quotations()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check auth.users directly (no RLS on auth schema)
  -- Only check raw_user_meta_data as app_metadata doesn't exist
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin_for_quotations() TO authenticated;

-- Step 2: Drop existing delete policies
DROP POLICY IF EXISTS "Admins can delete all quotations" ON quotations;
DROP POLICY IF EXISTS "Users can delete their own quotations" ON quotations;

-- Step 3: Recreate user delete policy (for their own quotations)
CREATE POLICY "Users can delete their own quotations"
ON quotations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 4: Recreate admin delete policy using the SECURITY DEFINER function
-- This policy allows admins to delete ANY quotation, including public ones (NULL user_id)
CREATE POLICY "Admins can delete all quotations"
ON quotations FOR DELETE
TO authenticated
USING (public.is_admin_for_quotations());

-- Step 5: Grant DELETE permission explicitly
GRANT DELETE ON public.quotations TO authenticated;

-- Step 6: Verify the policies exist
SELECT 
  policyname,
  cmd as command,
  roles
FROM pg_policies 
WHERE tablename = 'quotations' 
  AND cmd = 'DELETE'
ORDER BY policyname;

-- Step 7: Test the function (optional - remove in production)
-- SELECT public.is_admin_for_quotations() as is_admin_check;
