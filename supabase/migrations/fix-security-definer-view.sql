-- Migration: Fix security definer view issue
-- This migration fixes the active_email_addresses view to ensure it respects RLS
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

-- Drop the existing view
DROP VIEW IF EXISTS active_email_addresses;

-- Recreate the view without any security definer properties
-- Views in PostgreSQL automatically respect RLS policies on underlying tables
CREATE VIEW active_email_addresses
WITH (security_invoker = true) AS
SELECT 
  ea.id,
  ea.email_address,
  ea.display_name,
  ea.user_id,
  ea.address_type,
  ea.department,
  ea.is_primary,
  ea.can_send,
  ea.can_receive,
  u.first_name,
  u.last_name,
  u.role as user_role
FROM email_addresses ea
LEFT JOIN users u ON ea.user_id = u.id
WHERE ea.is_active = TRUE;

-- Grant permissions (view will respect RLS on underlying tables)
GRANT SELECT ON active_email_addresses TO authenticated;

-- Add comment
COMMENT ON VIEW active_email_addresses IS 'View of active email addresses that respects RLS policies on underlying tables';






