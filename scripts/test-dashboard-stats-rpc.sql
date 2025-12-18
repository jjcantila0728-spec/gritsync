-- Quick test script for get_dashboard_stats function
-- Run this in Supabase SQL Editor to verify the function works

-- Test 1: Check function exists
SELECT 
  routine_name, 
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_dashboard_stats';

-- Test 2: Test function as admin (will use security definer, so it should work)
-- Note: This will use the service role context, so it should return admin stats
SELECT * FROM get_dashboard_stats(true);

-- Test 3: Test function as client (will be scoped to current user if authenticated)
-- Note: If run in SQL Editor without auth context, will return zeros
SELECT * FROM get_dashboard_stats(false);

-- Test 4: Verify function handles edge cases
-- Should return zeros for unauthenticated client calls
SELECT 
  CASE 
    WHEN total_applications = 0 AND total_quotations = 0 AND revenue = 0 
    THEN '✅ Function handles unauthenticated calls correctly'
    ELSE '⚠️ Function may not handle unauthenticated calls correctly'
  END as test_result
FROM get_dashboard_stats(false)
WHERE (SELECT current_setting('request.jwt.claims', true)) IS NULL 
   OR (SELECT current_setting('request.jwt.claims', true)) = '{}';

-- Test 5: Check function permissions
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN p.prosecdef THEN 'security definer'
    ELSE 'security invoker'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_dashboard_stats';







