-- Login Attempts Tracking Migration
-- This migration adds login attempt tracking and account lockout functionality

-- Create login_attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- Store email even if user doesn't exist (for security)
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  failure_reason TEXT -- e.g., 'invalid_password', 'user_not_found', 'account_locked'
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_attempted_at ON login_attempts(email, attempted_at);

-- Add locked_until column to users table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'locked_until'
  ) THEN
    ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Enable RLS on login_attempts
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for login_attempts
-- Users can view their own login attempts
CREATE POLICY "Users can view their own login attempts"
ON login_attempts FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all login attempts
CREATE POLICY "Admins can view all login attempts"
ON login_attempts FOR SELECT
USING (public.is_admin());

-- System can insert login attempts (no auth required for failed attempts)
CREATE POLICY "System can insert login attempts"
ON login_attempts FOR INSERT
WITH CHECK (true);

-- Admins can delete login attempts (for cleanup)
CREATE POLICY "Admins can delete login attempts"
ON login_attempts FOR DELETE
USING (public.is_admin());

-- Function to get failed login attempts count for a user/email within time window
CREATE OR REPLACE FUNCTION get_failed_login_attempts(
  p_email TEXT,
  p_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM login_attempts
  WHERE email = p_email
    AND success = false
    AND attempted_at > NOW() - (p_minutes || ' minutes')::INTERVAL;
  
  RETURN COALESCE(attempt_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  locked_until_ts TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT locked_until INTO locked_until_ts
  FROM users
  WHERE id = p_user_id;
  
  IF locked_until_ts IS NULL THEN
    RETURN false;
  END IF;
  
  IF locked_until_ts > NOW() THEN
    RETURN true;
  ELSE
    -- Lock expired, clear it
    UPDATE users SET locked_until = NULL WHERE id = p_user_id;
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to lock account
CREATE OR REPLACE FUNCTION lock_account(
  p_user_id UUID,
  p_lock_duration_minutes INTEGER DEFAULT 30
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET locked_until = NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unlock account
CREATE OR REPLACE FUNCTION unlock_account(
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET locked_until = NULL
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear old login attempts (for cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts(
  p_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM login_attempts
  WHERE attempted_at < NOW() - (p_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


