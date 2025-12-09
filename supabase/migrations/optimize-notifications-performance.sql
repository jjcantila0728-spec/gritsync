-- Optimize notifications table performance
-- This migration adds composite indexes for common query patterns

-- Composite index for fetching unread notifications for a user (most common query)
-- This optimizes: SELECT * FROM notifications WHERE user_id = ? AND read = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created 
ON notifications(user_id, read, created_at DESC) 
WHERE read = false;

-- Composite index for fetching all notifications for a user ordered by date
-- This optimizes: SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- Index for filtering by type (used in admin dashboard)
CREATE INDEX IF NOT EXISTS idx_notifications_type_created 
ON notifications(type, created_at DESC);

-- Composite index for admin queries filtering by type and read status
CREATE INDEX IF NOT EXISTS idx_notifications_type_read_created 
ON notifications(type, read, created_at DESC);

-- Index on created_at for general sorting (if not already exists)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

-- Index on application_id for notifications linked to applications
CREATE INDEX IF NOT EXISTS idx_notifications_application_id 
ON notifications(application_id) 
WHERE application_id IS NOT NULL;

-- Analyze the table to update statistics
ANALYZE notifications;

