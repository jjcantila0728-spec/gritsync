-- Fix: Ensure email addresses are permanent once generated
-- Prevents duplicate email generation when migrations are re-run

-- 1. Update create_client_email_address to check if user already has an email
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_middle_name TEXT;
  v_email TEXT;
  v_existing_email TEXT;
BEGIN
  -- Check if user already has a client email address
  SELECT email_address INTO v_existing_email
  FROM email_addresses
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND is_active = TRUE
  LIMIT 1;
  
  -- If email already exists, return it (don't create new one)
  IF v_existing_email IS NOT NULL THEN
    RAISE LOG 'User % already has email address: %', p_user_id, v_existing_email;
    RETURN v_existing_email;
  END IF;
  
  -- Get user details from users table
  SELECT first_name, middle_name, last_name 
  INTO v_user
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- If middle_name is null in users table, try to get it from user_details
  v_middle_name := v_user.middle_name;
  IF v_middle_name IS NULL OR TRIM(v_middle_name) = '' THEN
    SELECT middle_name INTO v_middle_name
    FROM user_details
    WHERE user_id = p_user_id
    AND middle_name IS NOT NULL
    AND TRIM(middle_name) != '';
  END IF;
  
  -- Generate email address with middle name from either source
  v_email := generate_client_email(
    v_user.first_name,
    v_middle_name,
    v_user.last_name
  );
  
  -- Insert email address (or return existing if conflict)
  INSERT INTO email_addresses (
    email_address,
    display_name,
    user_id,
    is_system_address,
    address_type,
    is_active,
    is_verified,
    is_primary,
    can_send,
    can_receive
  ) VALUES (
    v_email,
    v_user.first_name || ' ' || v_user.last_name,
    p_user_id,
    FALSE,
    'client',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (email_address) DO UPDATE
  SET updated_at = NOW()
  RETURNING email_address INTO v_email;
  
  RAISE LOG 'Created new email address % for user %', v_email, p_user_id;
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- 2. Clean up duplicate email addresses for the same user
-- Keep the oldest one (first created) as primary
DO $$
DECLARE
  user_record RECORD;
  email_record RECORD;
  keep_email_id UUID;
BEGIN
  -- Find users with multiple client email addresses
  FOR user_record IN 
    SELECT user_id, COUNT(*) as email_count
    FROM email_addresses
    WHERE address_type = 'client'
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'User % has % email addresses, cleaning up...', user_record.user_id, user_record.email_count;
    
    -- Get the oldest (first created) email address to keep
    SELECT id INTO keep_email_id
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Mark it as primary and active
    UPDATE email_addresses
    SET is_primary = TRUE,
        is_active = TRUE
    WHERE id = keep_email_id;
    
    -- Deactivate all other email addresses for this user
    UPDATE email_addresses
    SET is_active = FALSE,
        is_primary = FALSE
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND id != keep_email_id;
    
    RAISE NOTICE 'Kept email % and deactivated others for user %', keep_email_id, user_record.user_id;
  END LOOP;
END $$;

-- 3. Update the handle_new_user trigger to only create email if none exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_middle_name TEXT;
  user_last_name TEXT;
  user_role TEXT;
  v_user_id UUID;
  v_existing_email_count INT;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := generate_grit_id();
  
  -- Extract first_name, middle_name, and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_middle_name := COALESCE(
    NEW.raw_user_meta_data->>'middle_name',
    ''
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Get role from metadata
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'client'
  );
  
  -- Insert user profile with all required fields
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    user_role,
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', user_role)
  WHERE id = NEW.id;
  
  -- Auto-generate client email address ONLY if:
  -- 1. User is a client
  -- 2. User has name
  -- 3. User doesn't already have an email address
  IF user_role = 'client' 
     AND NULLIF(TRIM(user_first_name), '') IS NOT NULL 
     AND NULLIF(TRIM(user_last_name), '') IS NOT NULL 
  THEN
    -- Check if user already has a client email
    SELECT COUNT(*) INTO v_existing_email_count
    FROM email_addresses
    WHERE user_id = v_user_id
      AND address_type = 'client'
      AND is_active = TRUE;
    
    -- Only create if no email exists
    IF v_existing_email_count = 0 THEN
      BEGIN
        PERFORM create_client_email_address(v_user_id);
        RAISE LOG 'Successfully created client email address for user %', v_user_id;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the entire registration
        RAISE WARNING 'Failed to create client email address for user %: %', v_user_id, SQLERRM;
      END;
    ELSE
      RAISE LOG 'User % already has % email address(es), skipping creation', v_user_id, v_existing_email_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Show current status for verification
DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE '=== Email Addresses Status ===';
  FOR user_record IN 
    SELECT 
      u.id,
      u.email as auth_email,
      u.first_name,
      u.last_name,
      ea.email_address as client_email,
      ea.is_active,
      ea.is_primary,
      ea.created_at
    FROM users u
    LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client'
    ORDER BY u.created_at DESC
  LOOP
    IF user_record.client_email IS NOT NULL THEN
      RAISE NOTICE 'User: % % | Client Email: % | Active: % | Primary: %',
        user_record.first_name,
        user_record.last_name,
        user_record.client_email,
        user_record.is_active,
        user_record.is_primary;
    ELSE
      RAISE NOTICE 'User: % % | No client email address',
        user_record.first_name,
        user_record.last_name;
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION create_client_email_address IS 'Creates client email address only if user does not already have one (permanent once created)';

