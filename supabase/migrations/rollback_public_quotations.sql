-- Rollback Script for Public Quotations Migration
-- 
-- WARNING: This will remove the ability for anonymous users to create quotations
-- Only run this if you need to revert the migration
--
-- Before running:
-- 1. Ensure no quotes with user_id = null exist (or assign them to users)
-- 2. Backup your database
-- 3. Test in a development environment first

-- ============================================================================
-- STEP 1: Remove anonymous RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow anonymous quotation inserts" ON quotations;
DROP POLICY IF EXISTS "Allow anonymous quotation reads by email" ON quotations;
DROP POLICY IF EXISTS "Allow anonymous quotation updates" ON quotations;

-- ============================================================================
-- STEP 2: Restore original "Users can view their own quotations" policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own quotations" ON quotations;
CREATE POLICY "Users can view their own quotations"
ON quotations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 3: Remove indexes (optional - they don't hurt to keep)
-- ============================================================================

-- Uncomment if you want to remove the indexes:
-- DROP INDEX IF EXISTS idx_quotations_validity_date;
-- DROP INDEX IF EXISTS idx_quotations_created_at;

-- ============================================================================
-- STEP 4: Make user_id NOT NULL again
-- ============================================================================
-- 
-- WARNING: This will fail if there are any quotations with user_id = null
-- You must either:
-- 1. Delete all quotes with user_id = null, OR
-- 2. Assign them to a user before running this
--
-- To check for null user_id quotes:
-- SELECT COUNT(*) FROM quotations WHERE user_id IS NULL;
--
-- To delete them:
-- DELETE FROM quotations WHERE user_id IS NULL;
--
-- Uncomment the line below after handling null user_id quotes:
-- ALTER TABLE quotations ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- STEP 5: Remove column comments (optional)
-- ============================================================================

COMMENT ON COLUMN quotations.user_id IS NULL;
COMMENT ON COLUMN quotations.validity_date IS NULL;

