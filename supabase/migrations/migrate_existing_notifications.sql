-- Migrate existing notification settings from settings table to notification_types table
-- This ensures all current notifications, reminders, and greetings are visible in the frontend

-- First, ensure the notification_types table exists (in case migration order is different)
CREATE TABLE IF NOT EXISTS notification_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'email' CHECK (category IN ('email', 'reminder', 'greeting', 'system')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate email notification settings
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'emailTimelineUpdates',
  'Timeline Updates',
  'Notify users when application timeline steps are updated',
  'email',
  COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailTimelineUpdates'), true),
  true,
  '📋',
  1,
  '{}'::jsonb
ON CONFLICT (key) DO UPDATE SET
  enabled = COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailTimelineUpdates'), notification_types.enabled),
  updated_at = NOW();

INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'emailStatusChanges',
  'Status Changes',
  'Notify users when application status changes',
  'email',
  COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailStatusChanges'), true),
  true,
  '🔄',
  2,
  '{}'::jsonb
ON CONFLICT (key) DO UPDATE SET
  enabled = COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailStatusChanges'), notification_types.enabled),
  updated_at = NOW();

INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'emailPaymentUpdates',
  'Payment Updates',
  'Notify users about payment status and receipts',
  'email',
  COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailPaymentUpdates'), true),
  true,
  '💳',
  3,
  '{}'::jsonb
ON CONFLICT (key) DO UPDATE SET
  enabled = COALESCE((SELECT value::boolean FROM settings WHERE key = 'emailPaymentUpdates'), notification_types.enabled),
  updated_at = NOW();

-- Migrate reminder settings
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'profileReminder',
  'Profile Completion Reminder',
  'Remind users to complete their profile',
  'reminder',
  COALESCE((SELECT value::boolean FROM settings WHERE key = 'profileReminderEnabled'), true),
  true,
  '⏰',
  10,
  jsonb_build_object(
    'interval', COALESCE((SELECT value::integer FROM settings WHERE key = 'profileReminderInterval'), 24),
    'messages', jsonb_build_object(
      '0', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage0'), 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!'),
      '20', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage20'), 'Your profile is {completion}% complete. Add more details to make your applications faster!'),
      '40', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage40'), 'You''re {completion}% done with your profile. Keep going to complete it!'),
      '60', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage60'), 'Great progress! Your profile is {completion}% complete. Just a few more details needed!'),
      '80', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage80'), 'Almost there! Your profile is {completion}% complete. Finish the remaining details!')
    )
  )
ON CONFLICT (key) DO UPDATE SET
  enabled = COALESCE((SELECT value::boolean FROM settings WHERE key = 'profileReminderEnabled'), notification_types.enabled),
  config = jsonb_build_object(
    'interval', COALESCE((SELECT value::integer FROM settings WHERE key = 'profileReminderInterval'), (notification_types.config->>'interval')::integer, 24),
    'messages', jsonb_build_object(
      '0', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage0'), notification_types.config->'messages'->>'0', 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!'),
      '20', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage20'), notification_types.config->'messages'->>'20', 'Your profile is {completion}% complete. Add more details to make your applications faster!'),
      '40', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage40'), notification_types.config->'messages'->>'40', 'You''re {completion}% done with your profile. Keep going to complete it!'),
      '60', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage60'), notification_types.config->'messages'->>'60', 'Great progress! Your profile is {completion}% complete. Just a few more details needed!'),
      '80', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage80'), notification_types.config->'messages'->>'80', 'Almost there! Your profile is {completion}% complete. Finish the remaining details!')
    )
  ),
  updated_at = NOW();

-- Migrate greeting settings
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config)
SELECT 
  'birthdayGreeting',
  'Birthday Greetings',
  'Time-based birthday greeting messages',
  'greeting',
  true,
  true,
  '🎂',
  20,
  jsonb_build_object(
    'morning', COALESCE((SELECT value FROM settings WHERE key = 'greetingMorning'), 'Good morning'),
    'afternoon', COALESCE((SELECT value FROM settings WHERE key = 'greetingAfternoon'), 'Good afternoon'),
    'evening', COALESCE((SELECT value FROM settings WHERE key = 'greetingEvening'), 'Good evening'),
    'customEnabled', COALESCE((SELECT value::boolean FROM settings WHERE key = 'greetingCustomEnabled'), false)
  )
ON CONFLICT (key) DO UPDATE SET
  config = jsonb_build_object(
    'morning', COALESCE((SELECT value FROM settings WHERE key = 'greetingMorning'), notification_types.config->>'morning', 'Good morning'),
    'afternoon', COALESCE((SELECT value FROM settings WHERE key = 'greetingAfternoon'), notification_types.config->>'afternoon', 'Good afternoon'),
    'evening', COALESCE((SELECT value FROM settings WHERE key = 'greetingEvening'), notification_types.config->>'evening', 'Good evening'),
    'customEnabled', COALESCE((SELECT value::boolean FROM settings WHERE key = 'greetingCustomEnabled'), (notification_types.config->>'customEnabled')::boolean, false)
  ),
  updated_at = NOW();

-- Ensure all other default notifications exist (in case they weren't created yet)
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config) VALUES
  ('emailVerification', 'Email Verification', 'Send email verification on registration', 'email', true, true, '✉️', 4, '{}'::jsonb),
  ('emailForgotPassword', 'Forgot Password', 'Send password reset emails', 'email', true, true, '🔑', 5, '{}'::jsonb),
  ('emailPaymentReceipt', 'Payment Receipts', 'Send payment receipt emails', 'email', true, true, '🧾', 6, '{}'::jsonb),
  ('emailBirthdayGreeting', 'Birthday Greetings', 'Send birthday greeting emails', 'email', true, true, '🎉', 7, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Helper function to convert text to boolean
CREATE OR REPLACE FUNCTION text_to_boolean(text_val TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN text_val IN ('true', 't', '1', 'yes', 'on');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the migration to use the helper function
DO $$
BEGIN
  -- Update emailTimelineUpdates
  UPDATE notification_types
  SET enabled = COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'emailTimelineUpdates')), enabled)
  WHERE key = 'emailTimelineUpdates';

  -- Update emailStatusChanges
  UPDATE notification_types
  SET enabled = COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'emailStatusChanges')), enabled)
  WHERE key = 'emailStatusChanges';

  -- Update emailPaymentUpdates
  UPDATE notification_types
  SET enabled = COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'emailPaymentUpdates')), enabled)
  WHERE key = 'emailPaymentUpdates';

  -- Update profileReminder
  UPDATE notification_types
  SET 
    enabled = COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'profileReminderEnabled')), enabled),
    config = jsonb_build_object(
      'interval', COALESCE((SELECT value::integer FROM settings WHERE key = 'profileReminderInterval'), (config->>'interval')::integer, 24),
      'messages', jsonb_build_object(
        '0', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage0'), config->'messages'->>'0', 'Your profile is only {completion}% complete. Complete your profile to speed up your application process!'),
        '20', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage20'), config->'messages'->>'20', 'Your profile is {completion}% complete. Add more details to make your applications faster!'),
        '40', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage40'), config->'messages'->>'40', 'You''re {completion}% done with your profile. Keep going to complete it!'),
        '60', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage60'), config->'messages'->>'60', 'Great progress! Your profile is {completion}% complete. Just a few more details needed!'),
        '80', COALESCE((SELECT value FROM settings WHERE key = 'profileReminderMessage80'), config->'messages'->>'80', 'Almost there! Your profile is {completion}% complete. Finish the remaining details!')
      )
    )
  WHERE key = 'profileReminder';

  -- Update birthdayGreeting
  UPDATE notification_types
  SET config = jsonb_build_object(
    'morning', COALESCE((SELECT value FROM settings WHERE key = 'greetingMorning'), config->>'morning', 'Good morning'),
    'afternoon', COALESCE((SELECT value FROM settings WHERE key = 'greetingAfternoon'), config->>'afternoon', 'Good afternoon'),
    'evening', COALESCE((SELECT value FROM settings WHERE key = 'greetingEvening'), config->>'evening', 'Good evening'),
    'customEnabled', COALESCE(text_to_boolean((SELECT value FROM settings WHERE key = 'greetingCustomEnabled')), (config->>'customEnabled')::boolean, false)
  )
  WHERE key = 'birthdayGreeting';
END $$;
