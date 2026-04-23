-- Simple RLS Verification Script
-- Run this in Supabase SQL Editor
-- You can run each section separately if needed

-- 1. Check RLS Status on All Tables
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'ENABLED' 
    ELSE 'DISABLED - ACTION REQUIRED' 
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

-- 2. Count Policies per Table
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'users' AND COUNT(*) >= 4 THEN 'GOOD'
    WHEN tablename = 'applications' AND COUNT(*) >= 5 THEN 'GOOD'
    WHEN tablename = 'quotations' AND COUNT(*) >= 4 THEN 'GOOD'
    WHEN tablename = 'application_payments' AND COUNT(*) >= 3 THEN 'GOOD'
    WHEN tablename = 'application_timeline_steps' AND COUNT(*) >= 2 THEN 'GOOD'
    WHEN tablename = 'user_documents' AND COUNT(*) >= 3 THEN 'GOOD'
    WHEN tablename = 'notifications' AND COUNT(*) >= 2 THEN 'GOOD'
    WHEN tablename = 'settings' AND COUNT(*) >= 2 THEN 'GOOD'
    ELSE 'REVIEW NEEDED'
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

-- 3. List All Policies by Table
SELECT 
  tablename,
  policyname,
  cmd as command,
  roles::text as roles
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

-- 4. Check Table Permissions
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

-- 5. Verify Storage Buckets
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

-- 6. Verify Functions Exist
SELECT 
  routine_name as function_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN ('generate_grit_id', 'is_admin', 'is_admin_user')
ORDER BY routine_name;

-- 7. Summary Report
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
