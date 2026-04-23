-- Fix signed URL access for documents bucket
-- Note: Signed URLs should bypass RLS automatically, but if images aren't loading,
-- check the following:

-- 1. CORS Configuration in Supabase Dashboard:
--    Go to Storage > Settings > CORS
--    Ensure your domain is allowed, or use '*' for development

-- 2. Storage Bucket Public Access:
--    Signed URLs work even with private buckets, but ensure the bucket exists

-- 3. Verify the file exists:
--    Check Storage > documents bucket to ensure the file path is correct

-- This migration doesn't add policies (signed URLs bypass RLS)
-- Instead, it's a reminder to check CORS configuration
SELECT 
  'Signed URLs should work without additional policies' as note,
  'Check CORS configuration in Supabase Dashboard > Storage > Settings' as action;

