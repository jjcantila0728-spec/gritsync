-- Make pictures publicly accessible for tracking
-- This allows public (unauthenticated) users to view application pictures for tracking
--
-- IMPORTANT: Run this in Supabase SQL Editor

-- Drop policy if it exists first
DROP POLICY IF EXISTS "Public can view pictures for tracking" ON storage.objects;

-- Add public policy to allow anyone to read pictures from the documents bucket
-- This policy allows public read access to files that match picture patterns
CREATE POLICY "Public can view pictures for tracking"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Match picture files (jpg, jpeg, png)
    name LIKE '%/picture_%.jpg' OR
    name LIKE '%/picture_%.jpeg' OR
    name LIKE '%/picture_%.png' OR
    -- Match any file in a user folder that contains 'picture' in the name
    name ~ '.*/picture.*\.(jpg|jpeg|png)$'
  )
);

-- Alternative: Make the entire documents bucket public (less secure but simpler)
-- To do this, go to Supabase Dashboard > Storage > documents > Settings
-- and toggle "Public bucket" to ON

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname = 'Public can view pictures for tracking';
