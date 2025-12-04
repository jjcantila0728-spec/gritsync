-- Supabase Auth Login Attempt Tracking Trigger
-- This trigger automatically tracks login attempts when using Supabase Auth
-- It integrates with the login_attempts table we created earlier

-- Function to track login attempts from Supabase Auth events
CREATE OR REPLACE FUNCTION track_auth_login_attempt()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_success BOOLEAN;
  v_failure_reason TEXT;
BEGIN
  -- Extract email from the auth event
  v_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');
  v_user_id := NEW.id;
  
  -- Determine if login was successful
  -- In Supabase, if we reach this trigger, the login was successful
  -- Failed logins don't trigger this (they're handled by Supabase Auth)
  v_success := true;
  v_failure_reason := NULL;
  
  -- Insert login attempt record
  INSERT INTO login_attempts (
    user_id,
    email,
    ip_address,
    success,
    user_agent,
    failure_reason
  ) VALUES (
    v_user_id,
    v_email,
    NEW.raw_app_meta_data->>'ip_address', -- If stored in metadata
    v_success,
    NEW.raw_app_meta_data->>'user_agent', -- If stored in metadata
    v_failure_reason
  )
  ON CONFLICT DO NOTHING; -- Prevent duplicates if trigger fires multiple times
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Supabase Auth doesn't provide direct triggers on login events
-- Instead, we'll use a different approach: track via auth.users table changes
-- or create an Edge Function to intercept auth events

-- Alternative: Create a function that can be called from Supabase Edge Functions
-- This is the recommended approach for tracking Supabase Auth events

-- Function to record login attempt (called from Edge Function or API)
CREATE OR REPLACE FUNCTION record_auth_login_attempt(
  p_user_id UUID,
  p_email TEXT,
  p_success BOOLEAN,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  INSERT INTO login_attempts (
    user_id,
    email,
    ip_address,
    success,
    user_agent,
    failure_reason
  ) VALUES (
    p_user_id,
    p_email,
    p_ip_address,
    p_success,
    p_user_agent,
    p_failure_reason
  )
  RETURNING id INTO v_attempt_id;
  
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION record_auth_login_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION record_auth_login_attempt TO service_role;

-- Note: For full integration, you would need to:
-- 1. Create a Supabase Edge Function that intercepts auth.signInWithPassword
-- 2. Call record_auth_login_attempt() from the Edge Function
-- 3. Check account lock status before allowing login
-- 4. Lock account if max attempts exceeded

-- For now, the backend API route (/api/auth/login) has full tracking
-- The frontend can optionally be updated to use the backend API instead of direct Supabase Auth


