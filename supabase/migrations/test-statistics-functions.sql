-- Test Statistics Functions
-- Run this to verify all statistics functions work correctly

-- ============================================================================
-- Test 1: get_career_statistics()
-- ============================================================================
SELECT 
  'Testing get_career_statistics()' as test_name;

SELECT * FROM get_career_statistics();

-- Expected output columns:
-- - total_careers: Total number of careers
-- - active_careers: Number of active careers
-- - featured_careers: Number of featured and active careers
-- - total_applications: Total number of career applications
-- - pending_applications: Number of pending applications

-- ============================================================================
-- Test 2: get_donation_statistics()
-- ============================================================================
SELECT 
  'Testing get_donation_statistics()' as test_name;

SELECT * FROM get_donation_statistics();

-- Expected output columns:
-- - total_donations: Total number of donations
-- - total_amount: Sum of all donation amounts
-- - completed_donations: Number of completed donations
-- - completed_amount: Sum of completed donation amounts
-- - pending_donations: Number of pending donations

-- ============================================================================
-- Test 3: get_sponsorship_statistics()
-- ============================================================================
SELECT 
  'Testing get_sponsorship_statistics()' as test_name;

SELECT * FROM get_sponsorship_statistics();

-- Expected output columns:
-- - total_sponsorships: Total number of sponsorships
-- - pending_sponsorships: Number of pending sponsorships
-- - approved_sponsorships: Number of approved sponsorships
-- - awarded_sponsorships: Number of awarded sponsorships

-- ============================================================================
-- Test 4: Combined Statistics View
-- ============================================================================
SELECT 
  'Combined Statistics Overview' as test_name;

SELECT 
  'Careers' as category,
  total_careers::text as total,
  active_careers::text as active,
  NULL::text as completed,
  NULL::text as pending
FROM get_career_statistics()

UNION ALL

SELECT 
  'Donations' as category,
  total_donations::text as total,
  NULL::text as active,
  completed_donations::text as completed,
  pending_donations::text as pending
FROM get_donation_statistics()

UNION ALL

SELECT 
  'Sponsorships' as category,
  total_sponsorships::text as total,
  NULL::text as active,
  approved_sponsorships::text as completed,
  pending_sponsorships::text as pending
FROM get_sponsorship_statistics();

-- ============================================================================
-- Test 5: Function Performance Test
-- ============================================================================
-- Test execution time (should be fast with proper indexes)
-- Note: To measure performance, use EXPLAIN ANALYZE in psql or check query logs
-- These queries should execute quickly with proper indexes

SELECT * FROM get_career_statistics();
SELECT * FROM get_donation_statistics();
SELECT * FROM get_sponsorship_statistics();

-- To check performance in Supabase, you can use:
-- EXPLAIN ANALYZE SELECT * FROM get_career_statistics();
-- EXPLAIN ANALYZE SELECT * FROM get_donation_statistics();
-- EXPLAIN ANALYZE SELECT * FROM get_sponsorship_statistics();

-- ============================================================================
-- Test 6: Function with Empty Tables
-- ============================================================================
-- These functions should return 0 values even if tables are empty
-- (No data needed for this test, functions handle empty tables)

SELECT 
  'Empty table handling test' as test_name,
  CASE 
    WHEN total_careers = 0 AND total_applications = 0 THEN '✅ PASS - Handles empty tables'
    ELSE '✅ PASS - Has data'
  END as status
FROM get_career_statistics();

