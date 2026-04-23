-- Migration: Update Old Email Templates
-- This migration deactivates old template versions when enhanced versions exist
-- Run this after add-comprehensive-email-templates.sql

-- Deactivate old templates (these have been replaced by enhanced versions)
-- Only deactivate if the new enhanced versions exist

DO $$
BEGIN
  -- Deactivate old welcome template if enhanced version exists
  IF EXISTS (SELECT 1 FROM email_templates WHERE slug = 'welcome-new-user-enhanced' AND is_active = TRUE) THEN
    UPDATE email_templates 
    SET is_active = FALSE,
        description = COALESCE(description, '') || ' (Replaced by welcome-new-user-enhanced)',
        updated_at = NOW()
    WHERE slug = 'welcome-new-user' AND is_active = TRUE;
  END IF;

  -- Deactivate old application status template if enhanced version exists
  IF EXISTS (SELECT 1 FROM email_templates WHERE slug = 'application-status-change' AND is_active = TRUE) THEN
    UPDATE email_templates 
    SET is_active = FALSE,
        description = COALESCE(description, '') || ' (Replaced by application-status-change)',
        updated_at = NOW()
    WHERE slug = 'application-status-update' AND is_active = TRUE;
  END IF;

  -- Deactivate old payment receipt template if enhanced version exists
  IF EXISTS (SELECT 1 FROM email_templates WHERE slug = 'payment-receipt-enhanced' AND is_active = TRUE) THEN
    UPDATE email_templates 
    SET is_active = FALSE,
        description = COALESCE(description, '') || ' (Replaced by payment-receipt-enhanced)',
        updated_at = NOW()
    WHERE slug = 'payment-receipt' AND is_active = TRUE;
  END IF;
END $$;

