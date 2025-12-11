-- Smart Notification System
-- This file adds automated notification triggers for:
-- 1. Document requirement reminders
-- 2. Payment reminders
-- 3. Application timeline progress updates
-- 4. Profile completion reminders

-- First, update the notifications table to support more notification types
DO $$ 
BEGIN
  -- Drop the old check constraint if it exists
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Add new check constraint with more notification types
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN (
      'timeline_update', 
      'status_change', 
      'payment', 
      'general',
      'document_reminder',
      'payment_reminder',
      'profile_completion'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add link field to notifications for custom navigation
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- Create function to check missing required documents
CREATE OR REPLACE FUNCTION check_missing_documents(p_user_id UUID)
RETURNS TABLE(document_type TEXT, document_name TEXT) AS $$
BEGIN
  RETURN QUERY
  WITH required_docs AS (
    SELECT unnest(ARRAY['picture', 'diploma', 'passport']) AS doc_type,
           unnest(ARRAY['2x2 Picture', 'Nursing Diploma', 'Passport']) AS doc_name
  )
  SELECT rd.doc_type, rd.doc_name
  FROM required_docs rd
  WHERE NOT EXISTS (
    SELECT 1 FROM user_documents ud
    WHERE ud.user_id = p_user_id
    AND ud.document_type = rd.doc_type
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to check incomplete profile
CREATE OR REPLACE FUNCTION check_incomplete_profile(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_incomplete BOOLEAN;
BEGIN
  SELECT 
    first_name IS NULL OR 
    last_name IS NULL OR 
    mobile_number IS NULL OR 
    date_of_birth IS NULL OR
    city IS NULL OR
    province IS NULL
  INTO v_incomplete
  FROM user_details
  WHERE user_id = p_user_id;
  
  -- If no record exists, profile is incomplete
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;
  
  RETURN COALESCE(v_incomplete, TRUE);
END;
$$ LANGUAGE plpgsql;

-- Create function to generate document reminder notifications
CREATE OR REPLACE FUNCTION generate_document_reminders()
RETURNS void AS $$
DECLARE
  v_user RECORD;
  v_missing_doc RECORD;
  v_missing_count INTEGER;
  v_notification_exists BOOLEAN;
BEGIN
  -- Loop through all users
  FOR v_user IN 
    SELECT id, email FROM users WHERE role = 'client'
  LOOP
    -- Count missing documents
    SELECT COUNT(*) INTO v_missing_count
    FROM check_missing_documents(v_user.id);
    
    IF v_missing_count > 0 THEN
      -- Check if we already sent a notification in the last 7 days
      SELECT EXISTS(
        SELECT 1 FROM notifications
        WHERE user_id = v_user.id
        AND type = 'document_reminder'
        AND created_at > NOW() - INTERVAL '7 days'
      ) INTO v_notification_exists;
      
      IF NOT v_notification_exists THEN
        -- Create a notification for missing documents
        INSERT INTO notifications (user_id, type, title, message, link, read)
        VALUES (
          v_user.id,
          'document_reminder',
          'Missing Required Documents',
          format('You have %s missing document%s. Please upload them to proceed with your application.', 
                 v_missing_count, 
                 CASE WHEN v_missing_count > 1 THEN 's' ELSE '' END),
          '/documents',
          FALSE
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate profile completion reminders
CREATE OR REPLACE FUNCTION generate_profile_completion_reminders()
RETURNS void AS $$
DECLARE
  v_user RECORD;
  v_is_incomplete BOOLEAN;
  v_notification_exists BOOLEAN;
BEGIN
  -- Loop through all users
  FOR v_user IN 
    SELECT id, email FROM users WHERE role = 'client'
  LOOP
    -- Check if profile is incomplete
    v_is_incomplete := check_incomplete_profile(v_user.id);
    
    IF v_is_incomplete THEN
      -- Check if we already sent a notification in the last 7 days
      SELECT EXISTS(
        SELECT 1 FROM notifications
        WHERE user_id = v_user.id
        AND type = 'profile_completion'
        AND created_at > NOW() - INTERVAL '7 days'
      ) INTO v_notification_exists;
      
      IF NOT v_notification_exists THEN
        -- Create a notification for incomplete profile
        INSERT INTO notifications (user_id, type, title, message, link, read)
        VALUES (
          v_user.id,
          'profile_completion',
          'Complete Your Profile',
          'Please complete your profile information to proceed with your NCLEX application.',
          '/my-details',
          FALSE
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate payment reminders
CREATE OR REPLACE FUNCTION generate_payment_reminders()
RETURNS void AS $$
DECLARE
  v_app RECORD;
  v_notification_exists BOOLEAN;
  v_days_since_creation INTEGER;
BEGIN
  -- Find applications with pending payments that are older than 3 days
  FOR v_app IN 
    SELECT 
      a.id,
      a.user_id,
      a.status,
      ap.id as payment_id,
      ap.payment_type,
      ap.amount,
      ap.created_at as payment_created_at,
      EXTRACT(DAY FROM NOW() - ap.created_at)::INTEGER as days_pending
    FROM applications a
    JOIN application_payments ap ON ap.application_id = a.id
    WHERE ap.status = 'pending'
    AND ap.created_at < NOW() - INTERVAL '3 days'
    AND a.status NOT IN ('completed', 'cancelled')
  LOOP
    v_days_since_creation := v_app.days_pending;
    
    -- Check if we already sent a notification in the last 3 days
    SELECT EXISTS(
      SELECT 1 FROM notifications
      WHERE user_id = v_app.user_id
      AND application_id = v_app.id
      AND type = 'payment_reminder'
      AND created_at > NOW() - INTERVAL '3 days'
    ) INTO v_notification_exists;
    
    IF NOT v_notification_exists THEN
      -- Create a payment reminder notification
      INSERT INTO notifications (user_id, application_id, type, title, message, read)
      VALUES (
        v_app.user_id,
        v_app.id,
        'payment_reminder',
        'Payment Reminder',
        format('Your payment of $%.2f for %s is still pending. Please complete the payment to continue.', 
               v_app.amount,
               CASE v_app.payment_type
                 WHEN 'step1' THEN 'Step 1'
                 WHEN 'step2' THEN 'Step 2'
                 WHEN 'full' THEN 'Full Payment'
                 ELSE 'your application'
               END),
        FALSE
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for timeline step updates
CREATE OR REPLACE FUNCTION notify_timeline_step_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_step_message TEXT;
BEGIN
  -- Get the user_id for this application
  SELECT user_id INTO v_user_id
  FROM applications
  WHERE id = NEW.application_id;
  
  -- Only create notification if status changed to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_step_message := format('Step "%s" has been completed in your application timeline.', NEW.step_name);
    
    INSERT INTO notifications (user_id, application_id, type, title, message, read)
    VALUES (
      v_user_id,
      NEW.application_id,
      'timeline_update',
      'Timeline Updated',
      v_step_message,
      FALSE
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for credentialing step reminder
CREATE OR REPLACE FUNCTION notify_credentialing_reminder()
RETURNS void AS $$
DECLARE
  v_app RECORD;
  v_notification_exists BOOLEAN;
  v_app_submission_completed BOOLEAN;
  v_credentialing_completed BOOLEAN;
BEGIN
  -- Find applications where step 1 is completed but step 2 (credentialing) is not started or pending
  FOR v_app IN 
    SELECT DISTINCT
      a.id,
      a.user_id,
      a.status
    FROM applications a
    WHERE a.status NOT IN ('completed', 'cancelled')
  LOOP
    -- Check if application submission step is completed
    SELECT EXISTS(
      SELECT 1 FROM application_timeline_steps
      WHERE application_id = v_app.id
      AND step_key = 'app_submission'
      AND status = 'completed'
    ) INTO v_app_submission_completed;
    
    -- Check if credentialing step is completed
    SELECT EXISTS(
      SELECT 1 FROM application_timeline_steps
      WHERE application_id = v_app.id
      AND step_key = 'credentialing'
      AND status = 'completed'
    ) INTO v_credentialing_completed;
    
    -- If app submission is done but credentialing is not, send reminder
    IF v_app_submission_completed AND NOT v_credentialing_completed THEN
      -- Check if we already sent this notification in the last 5 days
      SELECT EXISTS(
        SELECT 1 FROM notifications
        WHERE user_id = v_app.user_id
        AND application_id = v_app.id
        AND type = 'timeline_update'
        AND title = 'Time for Credentialing'
        AND created_at > NOW() - INTERVAL '5 days'
      ) INTO v_notification_exists;
      
      IF NOT v_notification_exists THEN
        -- Create credentialing reminder
        INSERT INTO notifications (user_id, application_id, type, title, message, read)
        VALUES (
          v_app.user_id,
          v_app.id,
          'timeline_update',
          'Time for Credentialing',
          'Your application is ready for the Credentialing step. Please download the request letter and Form 2F, then submit them to your school registrar. Don''t forget to bring about 1,500 PHP for school fees.',
          FALSE
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS timeline_step_update_trigger ON application_timeline_steps;

-- Create trigger for timeline step updates
CREATE TRIGGER timeline_step_update_trigger
  AFTER INSERT OR UPDATE ON application_timeline_steps
  FOR EACH ROW
  EXECUTE FUNCTION notify_timeline_step_update();

-- Create trigger function for payment status updates
CREATE OR REPLACE FUNCTION notify_payment_status_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_payment_message TEXT;
BEGIN
  -- Get the user_id for this payment
  SELECT user_id INTO v_user_id
  FROM applications
  WHERE id = NEW.application_id;
  
  -- Only notify if payment status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    v_payment_message := format('Your payment of $%.2f has been successfully processed.', NEW.amount);
    
    INSERT INTO notifications (user_id, application_id, type, title, message, read)
    VALUES (
      v_user_id,
      NEW.application_id,
      'payment',
      'Payment Confirmed',
      v_payment_message,
      FALSE
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS payment_status_update_trigger ON application_payments;

-- Create trigger for payment status updates
CREATE TRIGGER payment_status_update_trigger
  AFTER INSERT OR UPDATE ON application_payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_status_update();

-- Create a scheduled job to run periodic notification checks
-- Note: This requires pg_cron extension to be enabled
-- You can also run these functions manually or via a cron job

-- Example: To enable pg_cron, run: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Then schedule the jobs:

-- Run document reminders every day at 9 AM
-- SELECT cron.schedule('document-reminders', '0 9 * * *', 'SELECT generate_document_reminders()');

-- Run profile completion reminders every day at 10 AM
-- SELECT cron.schedule('profile-reminders', '0 10 * * *', 'SELECT generate_profile_completion_reminders()');

-- Run payment reminders every day at 2 PM
-- SELECT cron.schedule('payment-reminders', '0 14 * * *', 'SELECT generate_payment_reminders()');

-- Run credentialing reminders every day at 11 AM
-- SELECT cron.schedule('credentialing-reminders', '0 11 * * *', 'SELECT notify_credentialing_reminder()');

-- Manual execution (you can run these anytime):
-- SELECT generate_document_reminders();
-- SELECT generate_profile_completion_reminders();
-- SELECT generate_payment_reminders();
-- SELECT notify_credentialing_reminder();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_missing_documents TO authenticated;
GRANT EXECUTE ON FUNCTION check_incomplete_profile TO authenticated;
GRANT EXECUTE ON FUNCTION generate_document_reminders TO authenticated;
GRANT EXECUTE ON FUNCTION generate_profile_completion_reminders TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payment_reminders TO authenticated;
GRANT EXECUTE ON FUNCTION notify_credentialing_reminder TO authenticated;

COMMENT ON FUNCTION check_missing_documents IS 'Returns list of missing required documents for a user';
COMMENT ON FUNCTION check_incomplete_profile IS 'Checks if a user profile is incomplete';
COMMENT ON FUNCTION generate_document_reminders IS 'Generates notifications for users with missing documents';
COMMENT ON FUNCTION generate_profile_completion_reminders IS 'Generates notifications for users with incomplete profiles';
COMMENT ON FUNCTION generate_payment_reminders IS 'Generates notifications for pending payments';
COMMENT ON FUNCTION notify_credentialing_reminder IS 'Generates reminders for credentialing step based on timeline progress';

