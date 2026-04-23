-- Sessions Management Migration
-- This migration adds server-side session management functionality

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, -- JWT token or session token
  refresh_token TEXT UNIQUE, -- Optional refresh token
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT, -- Device/browser fingerprint for security
  device_name TEXT, -- Human-readable device name
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT -- e.g., 'logout', 'password_change', 'security_breach', 'admin_revoke'
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_active ON sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- Enable RLS on sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
-- Users can view their own active sessions
CREATE POLICY "Users can view their own sessions"
ON sessions FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON sessions FOR SELECT
USING (public.is_admin());

-- System can insert sessions (authenticated users)
CREATE POLICY "Authenticated users can create sessions"
ON sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (for activity tracking)
CREATE POLICY "Users can update their own sessions"
ON sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can revoke their own sessions
CREATE POLICY "Users can revoke their own sessions"
ON sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  (revoked_at IS NOT NULL OR is_active = false)
);

-- Admins can revoke any session
CREATE POLICY "Admins can revoke any session"
ON sessions FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Function to clean up expired sessions (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE sessions
  SET is_active = false, revoked_at = NOW(), revoked_reason = 'expired'
  WHERE expires_at < NOW() AND is_active = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Optionally delete old revoked sessions (older than 30 days)
  DELETE FROM sessions
  WHERE revoked_at IS NOT NULL 
    AND revoked_at < NOW() - INTERVAL '30 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active session count for a user
CREATE OR REPLACE FUNCTION get_user_active_session_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  session_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM sessions
  WHERE user_id = p_user_id
    AND is_active = true
    AND expires_at > NOW();
  
  RETURN COALESCE(session_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke all sessions for a user (useful for password change, security breach)
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'security_action'
)
RETURNS INTEGER AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE sessions
  SET is_active = false,
      revoked_at = NOW(),
      revoked_reason = p_reason
  WHERE user_id = p_user_id
    AND is_active = true
    AND expires_at > NOW();
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_activity on session access (if needed)
-- Note: This would require application-level updates, but we can add a helper function
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE sessions
  SET last_activity = NOW()
  WHERE id = p_session_id
    AND is_active = true
    AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
