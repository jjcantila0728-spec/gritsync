-- Make pictures publicly accessible for tracking
-- This allows public (unauthenticated) users to view application pictures for tracking
-- This migration ensures the policy is applied and handles case-insensitive file extensions

-- Drop policy if it exists first
DROP POLICY IF EXISTS "Public can view pictures for tracking" ON storage.objects;

-- Add public policy to allow anyone to read pictures from the documents bucket
-- This policy allows public read access to files that match picture patterns
-- Updated to handle case-insensitive extensions (JPG, jpg, JPEG, jpeg, PNG, png)
CREATE POLICY "Public can view pictures for tracking"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Match picture files with case-insensitive pattern
    -- Matches: picture_*.jpg, picture_*.JPG, picture_*.jpeg, picture_*.JPEG, etc.
    LOWER(name) LIKE '%/picture_%.jpg' OR
    LOWER(name) LIKE '%/picture_%.jpeg' OR
    LOWER(name) LIKE '%/picture_%.png' OR
    -- Match any file in a user folder that contains 'picture' in the name (case-insensitive)
    LOWER(name) ~ '.*/picture.*\.(jpg|jpeg|png)$'
  )
);

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
