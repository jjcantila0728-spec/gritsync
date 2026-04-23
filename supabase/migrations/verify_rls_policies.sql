-- Verification Script for RLS Policies
-- Run this in Supabase SQL Editor to verify all RLS policies are correctly configured
-- This helps ensure your database is ready for production

-- Section 1: Check RLS Status on All Tables
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED' 
    ELSE '❌ DISABLED - ACTION REQUIRED' 
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'users',
    'applications',
    'quotations',
    'user_details',
    'user_documents',
    'application_payments',
    'receipts',
    'processing_accounts',
    'application_timeline_steps',
    'notifications',
    'settings',
    'services'
  )
ORDER BY tablename;

-- Section 2: Count Policies per Table
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'users' AND COUNT(*) >= 4 THEN '✅ GOOD'
    WHEN tablename = 'applications' AND COUNT(*) >= 5 THEN '✅ GOOD'
    WHEN tablename = 'quotations' AND COUNT(*) >= 4 THEN '✅ GOOD'
    WHEN tablename = 'application_payments' AND COUNT(*) >= 3 THEN '✅ GOOD'
    WHEN tablename = 'application_timeline_steps' AND COUNT(*) >= 2 THEN '✅ GOOD'
    WHEN tablename = 'user_documents' AND COUNT(*) >= 3 THEN '✅ GOOD'
    WHEN tablename = 'notifications' AND COUNT(*) >= 2 THEN '✅ GOOD'
    WHEN tablename = 'settings' AND COUNT(*) >= 2 THEN '✅ GOOD'
    ELSE '⚠️  REVIEW NEEDED'
  END as status
FROM pg_policies 
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
)
GROUP BY tablename
ORDER BY tablename;

-- Section 3: List All Policies by Table
SELECT 
  tablename,
  policyname,
  cmd as command,
  roles::text as roles,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Reading'
    WHEN cmd = 'INSERT' THEN 'Creating'
    WHEN cmd = 'UPDATE' THEN 'Updating'
    WHEN cmd = 'DELETE' THEN 'Deleting'
    ELSE cmd
  END as description
FROM pg_policies 
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
)
ORDER BY tablename, cmd, policyname;

-- Section 4: Check Table Permissions
SELECT 
  grantee,
  table_name,
  STRING_AGG(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN (
    'users',
    'applications',
    'quotations',
    'user_details',
    'user_documents',
    'application_payments',
    'receipts',
    'processing_accounts',
    'application_timeline_steps',
    'notifications',
    'settings',
    'services'
  )
  AND grantee IN ('authenticated', 'anon')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- Section 5: Verify Storage Buckets
-- Note: Storage policies must be checked manually in Supabase Dashboard -> Storage -> Policies
SELECT 
  name as bucket_name,
  id as bucket_id,
  CASE 
    WHEN public THEN 'PUBLIC'
    ELSE 'PRIVATE'
  END as visibility,
  CASE 
    WHEN name = 'documents' AND NOT public THEN 'CORRECT'
    WHEN name = 'pictures' AND public THEN 'CORRECT'
    ELSE 'REVIEW'
  END as status,
  created_at
FROM storage.buckets
WHERE name IN ('documents', 'pictures')
ORDER BY name;

-- Section 6: Verify Functions Exist
SELECT 
  routine_name as function_name,
  routine_type,
  CASE 
    WHEN routine_name IN ('generate_grit_id', 'is_admin', 'is_admin_user') THEN '✅ REQUIRED'
    ELSE 'ℹ️  CUSTOM'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN ('generate_grit_id', 'is_admin', 'is_admin_user')
ORDER BY routine_name;

-- Section 7: Check Triggers
SELECT 
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation,
  CASE 
    WHEN trigger_name LIKE '%user%' OR trigger_name LIKE '%profile%' THEN '✅ USER PROFILE'
    WHEN trigger_name LIKE '%grit%' OR trigger_name LIKE '%id%' THEN '✅ GRIT ID'
    ELSE 'ℹ️  OTHER'
  END as category
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%user%' OR trigger_name LIKE '%profile%' OR trigger_name LIKE '%grit%' OR trigger_name LIKE '%id%')
ORDER BY event_object_table, trigger_name;

-- Section 8: Summary Report
SELECT 
  'RLS Verification Summary' as report_type,
  COUNT(DISTINCT tablename) as tables_with_rls,
  COUNT(*) as total_policies,
  COUNT(DISTINCT CASE WHEN cmd = 'SELECT' THEN tablename END) as tables_with_select,
  COUNT(DISTINCT CASE WHEN cmd = 'INSERT' THEN tablename END) as tables_with_insert,
  COUNT(DISTINCT CASE WHEN cmd = 'UPDATE' THEN tablename END) as tables_with_update,
  COUNT(DISTINCT CASE WHEN cmd = 'DELETE' THEN tablename END) as tables_with_delete
FROM pg_policies
WHERE tablename IN (
  'users',
  'applications',
  'quotations',
  'user_details',
  'user_documents',
  'application_payments',
  'receipts',
  'processing_accounts',
  'application_timeline_steps',
  'notifications',
  'settings',
  'services'
);

-- NOTES:
-- 1. All tables should have RLS ENABLED
-- 2. Each table should have appropriate policies for:
--    - Users: Can access their own data
--    - Admins: Can access all data
--    - Public: Can access tracking data (if applicable)
-- 3. Storage buckets should be configured:
--    - documents: PRIVATE
--    - pictures: PUBLIC (for tracking)
-- 4. Review any tables or policies marked with warnings
