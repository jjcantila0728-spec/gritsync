-- Recommended database indexes to optimize query performance
-- Run these in Supabase SQL Editor to improve query speed
-- These indexes support the optimized query patterns implemented in the application

-- Applications table indexes
-- Supports: applicationsAPI.getAll() with user_id filtering
CREATE INDEX IF NOT EXISTS idx_applications_user_id_created_at 
ON applications(user_id, created_at DESC);

-- Supports: Dashboard stats queries
CREATE INDEX IF NOT EXISTS idx_applications_status 
ON applications(status) WHERE status IS NOT NULL;

-- Supports: Application detail queries
CREATE INDEX IF NOT EXISTS idx_applications_grit_app_id 
ON applications(grit_app_id) WHERE grit_app_id IS NOT NULL;

-- Application timeline steps indexes
-- Supports: Batched timeline queries in applicationsAPI.getAll()
CREATE INDEX IF NOT EXISTS idx_timeline_steps_application_id 
ON application_timeline_steps(application_id);

-- Supports: Timeline completion checks
CREATE INDEX IF NOT EXISTS idx_timeline_steps_application_step_status 
ON application_timeline_steps(application_id, step_key, status) 
WHERE status = 'completed';

-- Application payments indexes
-- Supports: Batched payment queries in applicationsAPI.getAll()
CREATE INDEX IF NOT EXISTS idx_payments_application_id 
ON application_payments(application_id);

-- Supports: Dashboard revenue calculations
CREATE INDEX IF NOT EXISTS idx_payments_status_amount 
ON application_payments(status, amount) 
WHERE status = 'paid';

-- Supports: User-scoped payment queries
CREATE INDEX IF NOT EXISTS idx_payments_user_id_status 
ON application_payments(user_id, status);

-- Quotations indexes
-- Supports: Dashboard stats and user-scoped queries
CREATE INDEX IF NOT EXISTS idx_quotations_user_id_created_at 
ON quotations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_status 
ON quotations(status) WHERE status IS NOT NULL;

-- Processing accounts indexes
-- Supports: Batched GritSync account queries in clientsAPI.getAllWithGmailAccounts()
CREATE INDEX IF NOT EXISTS idx_processing_accounts_application_id_type 
ON processing_accounts(application_id, account_type) 
WHERE account_type = 'gritsync';

-- User documents indexes
-- Supports: Document queries in ApplicationDetail
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id_type 
ON user_documents(user_id, document_type);

CREATE INDEX IF NOT EXISTS idx_user_documents_user_id_uploaded_at 
ON user_documents(user_id, uploaded_at DESC);

-- Users table indexes
-- Supports: Client queries
CREATE INDEX IF NOT EXISTS idx_users_role_created_at 
ON users(role, created_at DESC) 
WHERE role = 'client';

-- Notifications indexes
-- Supports: Notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_created_at 
ON notifications(user_id, read, created_at DESC);

-- Email logs indexes (if table exists)
-- Supports: Email analytics queries
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_user_id_created_at 
ON email_logs(recipient_user_id, created_at DESC) 
WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_status_created_at 
ON email_logs(status, created_at DESC);

-- Composite indexes for common query patterns
-- Dashboard stats optimization
CREATE INDEX IF NOT EXISTS idx_applications_user_status_created 
ON applications(user_id, status, created_at DESC);

-- Application detail optimization
CREATE INDEX IF NOT EXISTS idx_timeline_steps_app_key_status 
ON application_timeline_steps(application_id, step_key, status);

-- Comments
COMMENT ON INDEX idx_applications_user_id_created_at IS 
'Optimizes user-scoped application list queries with sorting';

COMMENT ON INDEX idx_timeline_steps_application_id IS 
'Optimizes batched timeline step queries for multiple applications';

COMMENT ON INDEX idx_payments_application_id IS 
'Optimizes batched payment queries for multiple applications';

COMMENT ON INDEX idx_processing_accounts_application_id_type IS 
'Optimizes batched GritSync account queries for AdminClients page';

-- Analyze tables after creating indexes (helps query planner)
ANALYZE applications;
ANALYZE application_timeline_steps;
ANALYZE application_payments;
ANALYZE quotations;
ANALYZE processing_accounts;
ANALYZE user_documents;
ANALYZE users;
ANALYZE notifications;







