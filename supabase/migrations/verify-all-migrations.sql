-- Comprehensive Migration Verification Script
-- Run this after all migrations to verify everything is set up correctly

-- ============================================================================
-- 1. VERIFY ALL TABLES EXIST
-- ============================================================================
SELECT 
  'Tables Check' as check_type,
  CASE 
    WHEN COUNT(*) = 5 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing tables'
  END as status,
  COUNT(*) as found_count,
  'Expected: 5 tables' as expected
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
);

-- List all tables
SELECT 
  'Table: ' || tablename as item,
  '✅ EXISTS' as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
)
ORDER BY tablename;

-- ============================================================================
-- 2. VERIFY ALL INDEXES EXIST
-- ============================================================================
SELECT 
  'Indexes Check' as check_type,
  CASE 
    WHEN COUNT(*) >= 20 THEN '✅ PASS'
    ELSE '⚠️  WARNING - Some indexes may be missing'
  END as status,
  COUNT(*) as found_count,
  'Expected: At least 20 indexes' as expected
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
);

-- List all indexes by table
SELECT 
  tablename,
  indexname,
  '✅ EXISTS' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
)
ORDER BY tablename, indexname;

-- ============================================================================
-- 3. VERIFY ALL FUNCTIONS EXIST
-- ============================================================================
SELECT 
  'Functions Check' as check_type,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing functions'
  END as status,
  COUNT(*) as found_count,
  'Expected: At least 5 functions' as expected
FROM pg_proc 
WHERE proname IN (
  'update_updated_at_column',
  'increment_career_views',
  'increment_career_applications',
  'get_career_statistics',
  'get_donation_statistics',
  'get_sponsorship_statistics'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- List all functions
SELECT 
  'Function: ' || proname as item,
  '✅ EXISTS' as status
FROM pg_proc 
WHERE proname IN (
  'update_updated_at_column',
  'increment_career_views',
  'increment_career_applications',
  'get_career_statistics',
  'get_donation_statistics',
  'get_sponsorship_statistics'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- ============================================================================
-- 4. VERIFY RLS IS ENABLED
-- ============================================================================
SELECT 
  'RLS Check' as check_type,
  CASE 
    WHEN COUNT(*) = 5 THEN '✅ PASS'
    ELSE '❌ FAIL - RLS not enabled on all tables'
  END as status,
  COUNT(*) as enabled_count,
  'Expected: 5 tables with RLS enabled' as expected
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
)
AND rowsecurity = true;

-- List RLS status per table
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
)
ORDER BY tablename;

-- ============================================================================
-- 5. VERIFY RLS POLICIES EXIST
-- ============================================================================
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN tablename = 'careers' AND COUNT(*) >= 5 THEN '✅ GOOD'
    WHEN tablename = 'career_applications' AND COUNT(*) >= 6 THEN '✅ GOOD'
    WHEN tablename = 'partner_agencies' AND COUNT(*) >= 5 THEN '✅ GOOD'
    WHEN tablename = 'nclex_sponsorships' AND COUNT(*) >= 6 THEN '✅ GOOD'
    WHEN tablename = 'donations' AND COUNT(*) >= 4 THEN '✅ GOOD'
    ELSE '⚠️  REVIEW NEEDED'
  END as status
FROM pg_policies 
WHERE tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
)
GROUP BY tablename
ORDER BY tablename;

-- List all policies
SELECT 
  tablename,
  policyname,
  cmd as command,
  roles::text as roles
FROM pg_policies 
WHERE tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
)
ORDER BY tablename, policyname;

-- ============================================================================
-- 6. VERIFY CONSTRAINTS EXIST
-- ============================================================================
SELECT 
  'Constraints Check' as check_type,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ PASS'
    ELSE '⚠️  WARNING - Some constraints may be missing'
  END as status,
  COUNT(*) as found_count
FROM pg_constraint 
WHERE conname IN (
  'career_applications_email_format_check',
  'nclex_sponsorships_email_format_check',
  'donations_amount_positive_check'
);

-- List constraints
SELECT 
  conname as constraint_name,
  conrelid::regclass as table_name,
  '✅ EXISTS' as status
FROM pg_constraint 
WHERE conname IN (
  'career_applications_email_format_check',
  'nclex_sponsorships_email_format_check',
  'donations_amount_positive_check'
)
ORDER BY conname;

-- ============================================================================
-- 7. VERIFY TRIGGERS EXIST
-- ============================================================================
SELECT 
  'Triggers Check' as check_type,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅ PASS'
    ELSE '⚠️  WARNING - Some triggers may be missing'
  END as status,
  COUNT(*) as found_count
FROM pg_trigger 
WHERE tgname IN (
  'update_careers_updated_at',
  'update_career_applications_updated_at',
  'update_partner_agencies_updated_at',
  'update_nclex_sponsorships_updated_at',
  'update_donations_updated_at'
)
AND NOT tgisinternal;

-- List triggers
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  '✅ EXISTS' as status
FROM pg_trigger 
WHERE tgname IN (
  'update_careers_updated_at',
  'update_career_applications_updated_at',
  'update_partner_agencies_updated_at',
  'update_nclex_sponsorships_updated_at',
  'update_donations_updated_at'
)
AND NOT tgisinternal
ORDER BY tgname;

-- ============================================================================
-- 8. TEST STATISTICS FUNCTIONS
-- ============================================================================
-- Test get_career_statistics
SELECT 
  'Function Test: get_career_statistics' as test_name,
  CASE 
    WHEN total_careers IS NOT NULL THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM get_career_statistics();

-- Test get_donation_statistics
SELECT 
  'Function Test: get_donation_statistics' as test_name,
  CASE 
    WHEN total_donations IS NOT NULL THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM get_donation_statistics();

-- Test get_sponsorship_statistics
SELECT 
  'Function Test: get_sponsorship_statistics' as test_name,
  CASE 
    WHEN total_sponsorships IS NOT NULL THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM get_sponsorship_statistics();

-- ============================================================================
-- 9. VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================================================
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✅ EXISTS' as status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
)
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
SELECT 
  '=== VERIFICATION SUMMARY ===' as summary;

SELECT 
  'Total Tables' as metric,
  COUNT(*)::text as value
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
);

SELECT 
  'Total Indexes' as metric,
  COUNT(*)::text as value
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
);

SELECT 
  'Total RLS Policies' as metric,
  COUNT(*)::text as value
FROM pg_policies 
WHERE tablename IN (
  'careers',
  'career_applications', 
  'partner_agencies',
  'nclex_sponsorships',
  'donations'
);

SELECT 
  'Total Functions' as metric,
  COUNT(*)::text as value
FROM pg_proc 
WHERE proname IN (
  'update_updated_at_column',
  'increment_career_views',
  'increment_career_applications',
  'get_career_statistics',
  'get_donation_statistics',
  'get_sponsorship_statistics'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

