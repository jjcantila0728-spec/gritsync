-- Migration Compatibility Checker
-- Run this script to check for potential migration conflicts and issues
-- This helps prevent crashes from incompatible migrations

-- ============================================================================
-- 1. CHECK FOR MISSING DEPENDENCIES
-- ============================================================================

-- Check if required tables exist
DO $$
DECLARE
  missing_tables text[] := ARRAY[]::text[];
  required_tables text[] := ARRAY[
    'users',
    'applications',
    'quotations',
    'application_payments',
    'application_timeline_steps',
    'user_documents',
    'notifications'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY required_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = tbl
    ) THEN
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE WARNING 'Missing required tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE '✓ All required tables exist';
  END IF;
END $$;

-- Check if required functions exist
DO $$
DECLARE
  missing_functions text[] := ARRAY[]::text[];
  required_functions text[] := ARRAY[
    'get_dashboard_stats',
    'is_admin',
    'get_career_statistics',
    'get_donation_statistics',
    'get_sponsorship_statistics'
  ];
  func text;
BEGIN
  FOREACH func IN ARRAY required_functions
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = func
    ) THEN
      missing_functions := array_append(missing_functions, func);
    END IF;
  END LOOP;
  
  IF array_length(missing_functions, 1) > 0 THEN
    RAISE WARNING 'Missing required functions: %', array_to_string(missing_functions, ', ');
  ELSE
    RAISE NOTICE '✓ All required functions exist';
  END IF;
END $$;

-- ============================================================================
-- 2. CHECK FOR ORPHANED FOREIGN KEYS
-- ============================================================================

-- Check for applications with invalid user_id
SELECT 
  'applications' as table_name,
  COUNT(*) as orphaned_records
FROM applications a
LEFT JOIN users u ON a.user_id = u.id
WHERE u.id IS NULL;

-- Check for quotations with invalid user_id
SELECT 
  'quotations' as table_name,
  COUNT(*) as orphaned_records
FROM quotations q
LEFT JOIN users u ON q.user_id = u.id
WHERE u.id IS NULL;

-- Check for application_payments with invalid application_id
SELECT 
  'application_payments' as table_name,
  COUNT(*) as orphaned_records
FROM application_payments ap
LEFT JOIN applications a ON ap.application_id = a.id
WHERE a.id IS NULL;

-- ============================================================================
-- 3. CHECK FOR INDEX ISSUES
-- ============================================================================

-- Check for missing indexes on foreign keys
SELECT 
  t.relname as table_name,
  a.attname as column_name,
  'Missing index on foreign key' as issue
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
LEFT JOIN pg_index i ON i.indrelid = t.oid AND a.attnum = ANY(i.indkey)
WHERE c.contype = 'f'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND i.indexrelid IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pg_index idx
    WHERE idx.indrelid = t.oid
    AND a.attnum = ANY(idx.indkey)
  );

-- ============================================================================
-- 4. CHECK FOR RLS POLICY ISSUES
-- ============================================================================

-- Check tables with RLS enabled but no policies
SELECT 
  schemaname,
  tablename,
  'RLS enabled but no policies' as issue
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  )
  AND EXISTS (
    SELECT 1 
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = schemaname
      AND c.relname = tablename
      AND c.relrowsecurity = true
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_policies p
    WHERE p.schemaname = schemaname
      AND p.tablename = tablename
  );

-- ============================================================================
-- 5. CHECK FOR PERFORMANCE ISSUES
-- ============================================================================

-- Check for tables without primary keys
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  'Table missing primary key' as issue
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conrelid = c.oid 
    AND contype = 'p'
  )
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE '_realtime%';

-- Check for large tables without indexes on frequently queried columns
-- (This is a sample - adjust based on your query patterns)
SELECT 
  schemaname,
  tablename,
  attname,
  'Consider adding index on frequently queried column' as suggestion
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100  -- High cardinality columns
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = pg_stats.schemaname
      AND tablename = pg_stats.tablename
      AND indexdef LIKE '%' || pg_stats.attname || '%'
  )
LIMIT 10;

-- ============================================================================
-- 6. CHECK FOR DATA INTEGRITY ISSUES
-- ============================================================================

-- Check for NULL values in required columns (adjust based on your schema)
SELECT 
  'applications' as table_name,
  COUNT(*) as records_with_null_status
FROM applications
WHERE status IS NULL;

SELECT 
  'applications' as table_name,
  COUNT(*) as records_with_null_user_id
FROM applications
WHERE user_id IS NULL;

-- ============================================================================
-- 7. CHECK FOR CONNECTION/SESSION ISSUES
-- ============================================================================

-- Check current connection count (requires superuser or monitoring role)
WITH connection_stats AS (
  SELECT 
    datname,
    count(*) as connection_count,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
  FROM pg_stat_activity
  WHERE datname = current_database()
  GROUP BY datname
)
SELECT 
  datname,
  connection_count,
  max_connections,
  CASE 
    WHEN connection_count > max_connections * 0.8 
    THEN 'WARNING: High connection usage (>80%)'
    ELSE 'OK'
  END as status,
  ROUND((connection_count::numeric / max_connections::numeric) * 100, 1) as usage_percentage
FROM connection_stats;

-- ============================================================================
-- 8. SUMMARY REPORT
-- ============================================================================

DO $$
DECLARE
  table_count int;
  function_count int;
  index_count int;
  policy_count int;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
  
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public';
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public';
  
  -- Count RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRATION COMPATIBILITY CHECK SUMMARY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Tables: %', table_count;
  RAISE NOTICE 'Functions: %', function_count;
  RAISE NOTICE 'Indexes: %', index_count;
  RAISE NOTICE 'RLS Policies: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Review the warnings and issues above before running new migrations.';
  RAISE NOTICE '============================================================================';
END $$;

