-- Verification Script for MVP Security Optimization
-- Run this AFTER running optimize-security-mvp.sql
-- This verifies that all security optimizations were applied correctly

-- ============================================================================
-- PART 1: Verify Admin Functions
-- ============================================================================
SELECT 
  'Admin Functions' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'is_admin' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN '✅ is_admin() exists'
    ELSE '❌ is_admin() missing'
  END as status;

SELECT 
  'Admin Functions' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'is_admin_user' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN '✅ is_admin_user() exists'
    ELSE '❌ is_admin_user() missing'
  END as status;

-- ============================================================================
-- PART 2: Verify RLS is Enabled on All Tables
-- ============================================================================
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED' 
    ELSE '❌ DISABLED' 
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
    'services',
    'password_reset_tokens'
  )
ORDER BY tablename;

-- Check newer tables (if they exist)
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED' 
    ELSE '❌ DISABLED' 
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'nclex_sponsorships',
    'donations',
    'careers',
    'career_applications',
    'partner_agencies'
  )
ORDER BY tablename;

-- ============================================================================
-- PART 3: Count Policies per Table (MVP should have fewer, cleaner policies)
-- ============================================================================
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'users' AND COUNT(*) BETWEEN 5 AND 7 THEN '✅ GOOD'
    WHEN tablename = 'applications' AND COUNT(*) BETWEEN 4 AND 6 THEN '✅ GOOD'
    WHEN tablename = 'quotations' AND COUNT(*) BETWEEN 7 AND 9 THEN '✅ GOOD'
    WHEN tablename = 'user_details' AND COUNT(*) = 3 THEN '✅ GOOD'
    WHEN tablename = 'user_documents' AND COUNT(*) BETWEEN 7 AND 9 THEN '✅ GOOD'
    WHEN tablename = 'application_payments' AND COUNT(*) BETWEEN 3 AND 5 THEN '✅ GOOD'
    WHEN tablename = 'receipts' AND COUNT(*) BETWEEN 1 AND 3 THEN '✅ GOOD'
    WHEN tablename = 'processing_accounts' AND COUNT(*) BETWEEN 3 AND 5 THEN '✅ GOOD'
    WHEN tablename = 'application_timeline_steps' AND COUNT(*) BETWEEN 3 AND 5 THEN '✅ GOOD'
    WHEN tablename = 'notifications' AND COUNT(*) BETWEEN 2 AND 4 THEN '✅ GOOD'
    WHEN tablename = 'settings' AND COUNT(*) BETWEEN 2 AND 4 THEN '✅ GOOD'
    WHEN tablename = 'services' AND COUNT(*) BETWEEN 3 AND 5 THEN '✅ GOOD'
    ELSE '⚠️  REVIEW'
  END as status
FROM pg_policies 
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
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- PART 4: Verify Policy Naming Convention (MVP uses standardized names)
-- ============================================================================
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN policyname LIKE tablename || '_%' THEN '✅ Standardized'
    ELSE '⚠️  Non-standard'
  END as naming_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'users',
    'applications',
    'quotations',
    'user_details',
    'user_documents',
    'application_payments'
  )
ORDER BY tablename, policyname
LIMIT 20;

-- ============================================================================
-- PART 5: Verify Admin Policies Use is_admin() Function
-- ============================================================================
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual::text LIKE '%is_admin()%' OR with_check::text LIKE '%is_admin()%' THEN '✅ Uses is_admin()'
    WHEN qual::text LIKE '%is_admin_user()%' OR with_check::text LIKE '%is_admin_user()%' THEN '✅ Uses is_admin_user()'
    ELSE '⚠️  Check manually'
  END as admin_check_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND policyname LIKE '%admin%'
ORDER BY tablename, policyname
LIMIT 15;

-- ============================================================================
-- PART 6: Verify Grants are Set Correctly
-- ============================================================================
SELECT 
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges
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
    'settings',
    'services'
  )
  AND grantee IN ('authenticated', 'anon')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- ============================================================================
-- PART 7: Summary Report
-- ============================================================================
SELECT 
  'SUMMARY' as report_section,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as tables_with_rls,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
  (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('is_admin', 'is_admin_user') AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) as admin_functions;

-- ============================================================================
-- PART 8: Check for Common Issues
-- ============================================================================
-- Check if there are any policies that might cause recursion
SELECT 
  'Potential Issues' as check_type,
  tablename,
  policyname,
  'Policy queries users table - verify no recursion' as note
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%users%' 
    OR with_check::text LIKE '%users%'
  )
  AND tablename != 'users'
  AND policyname LIKE '%admin%'
LIMIT 10;

-- ============================================================================
-- VERIFICATION COMPLETE
-- ============================================================================
-- Review the results above:
-- ✅ All checks should show "GOOD" or "ENABLED" status
-- ⚠️  Any "REVIEW" or warnings should be investigated
-- ❌ Any "DISABLED" or "missing" items need to be fixed

