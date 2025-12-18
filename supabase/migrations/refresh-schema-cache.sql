-- Refresh Schema Cache
-- This script helps refresh Supabase's PostgREST schema cache
-- Run this if you get "table not found" errors even though the table exists

-- Method 1: Notify PostgREST to reload schema
-- This works if you have direct database access
NOTIFY pgrst, 'reload schema';

-- Method 2: Query the table to force cache refresh
-- Sometimes just querying the table helps refresh the cache
SELECT COUNT(*) FROM document_compilation_jobs;

-- Method 3: Check if table actually exists
SELECT 
  'Table exists check' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'document_compilation_jobs'
    ) THEN '✅ Table EXISTS in database'
    ELSE '❌ Table does NOT exist - run migration'
  END as status;

-- Method 4: List all columns to force metadata refresh
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'document_compilation_jobs'
ORDER BY ordinal_position;






