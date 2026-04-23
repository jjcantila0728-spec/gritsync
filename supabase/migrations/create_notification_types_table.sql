-- Create notification_types table for managing notification configurations
-- This allows admins to create, edit, delete, and activate/deactivate notifications dynamically

CREATE TABLE IF NOT EXISTS notification_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE, -- e.g., 'emailTimelineUpdates', 'emailStatusChanges'
  name TEXT NOT NULL, -- Display name, e.g., 'Timeline Updates'
  description TEXT, -- Description of what this notification does
  category TEXT NOT NULL DEFAULT 'email' CHECK (category IN ('email', 'reminder', 'greeting', 'system')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_enabled BOOLEAN NOT NULL DEFAULT true, -- Default state for new users
  config JSONB DEFAULT '{}'::jsonb, -- Additional configuration (interval, messages, etc.)
  icon TEXT, -- Icon name or emoji
  sort_order INTEGER DEFAULT 0, -- For ordering in UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view notification types"
ON notification_types FOR SELECT
USING (true);

CREATE POLICY "Admins can manage notification types"
ON notification_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_types_category ON notification_types(category);
CREATE INDEX IF NOT EXISTS idx_notification_types_enabled ON notification_types(enabled);
CREATE INDEX IF NOT EXISTS idx_notification_types_sort_order ON notification_types(sort_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_notification_types_updated_at ON notification_types;
CREATE TRIGGER update_notification_types_updated_at
  BEFORE UPDATE ON notification_types
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_types_updated_at();

-- Insert default notification types
INSERT INTO notification_types (key, name, description, category, enabled, default_enabled, icon, sort_order, config) VALUES
  ('emailTimelineUpdates', 'Timeline Updates', 'Notify users when application timeline steps are updated', 'email', true, true, '📋', 1, '{}'::jsonb),
  ('emailStatusChanges', 'Status Changes', 'Notify users when application status changes', 'email', true, true, '🔄', 2, '{}'::jsonb),
  ('emailPaymentUpdates', 'Payment Updates', 'Notify users about payment status and receipts', 'email', true, true, '💳', 3, '{}'::jsonb),
  ('emailVerification', 'Email Verification', 'Send email verification on registration', 'email', true, true, '✉️', 4, '{}'::jsonb),
  ('emailForgotPassword', 'Forgot Password', 'Send password reset emails', 'email', true, true, '🔑', 5, '{}'::jsonb),
  ('emailPaymentReceipt', 'Payment Receipts', 'Send payment receipt emails', 'email', true, true, '🧾', 6, '{}'::jsonb),
  ('emailBirthdayGreeting', 'Birthday Greetings', 'Send birthday greeting emails', 'email', true, true, '🎉', 7, '{}'::jsonb),
  ('profileReminder', 'Profile Completion Reminder', 'Remind users to complete their profile', 'reminder', true, true, '⏰', 10, '{"interval": 24, "messages": {"0": "Your profile is only {completion}% complete. Complete your profile to speed up your application process!", "20": "Your profile is {completion}% complete. Add more details to make your applications faster!", "40": "You''re {completion}% done with your profile. Keep going to complete it!", "60": "Great progress! Your profile is {completion}% complete. Just a few more details needed!", "80": "Almost there! Your profile is {completion}% complete. Finish the remaining details!"}}'::jsonb),
  ('birthdayGreeting', 'Birthday Greetings', 'Time-based birthday greeting messages', 'greeting', true, true, '🎂', 20, '{"morning": "Good morning", "afternoon": "Good afternoon", "evening": "Good evening", "customEnabled": false}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();
