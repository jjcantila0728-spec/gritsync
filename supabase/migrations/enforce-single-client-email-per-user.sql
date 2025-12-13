-- Migration: Enforce One Active Client Email Per User
-- Ensures each user can only have ONE active business/client email address

-- Step 1: Clean up existing duplicates (keep oldest, deactivate rest)
DO $$
DECLARE
  user_record RECORD;
  keep_email_id UUID;
  duplicate_count INT;
BEGIN
  RAISE NOTICE '=== Cleaning up duplicate client emails ===';
  
  -- Find users with multiple active client emails
  FOR user_record IN 
    SELECT 
      user_id,
      COUNT(*) as active_count
    FROM email_addresses
    WHERE address_type = 'client'
      AND is_active = TRUE
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'User % has % active client emails', user_record.user_id, user_record.active_count;
    
    -- Get the OLDEST (first created) email address to keep
    SELECT id INTO keep_email_id
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND is_active = TRUE
      AND id != keep_email_id;
    
    -- Deactivate all other emails
    UPDATE email_addresses
    SET 
      is_active = FALSE,
      is_primary = FALSE,
      updated_at = NOW()
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND is_active = TRUE
      AND id != keep_email_id;
    
    RAISE NOTICE '  Kept: % (oldest)', keep_email_id;
    RAISE NOTICE '  Deactivated: % duplicate(s)', duplicate_count;
  END LOOP;
  
  RAISE NOTICE '=== Cleanup complete ===';
END $$;

-- Step 2: Add unique partial index to enforce one active email per user
-- This prevents multiple active client emails for the same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_client_email_per_user
ON email_addresses (user_id)
WHERE address_type = 'client' AND is_active = TRUE;

COMMENT ON INDEX idx_one_active_client_email_per_user IS 
'Ensures each user can only have one active client email address';

-- Step 3: Create function to safely set email as primary (deactivates others)
CREATE OR REPLACE FUNCTION set_primary_client_email(
  p_user_id UUID,
  p_email_address TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_email_id UUID;
BEGIN
  -- Find the email address
  SELECT id INTO v_email_id
  FROM email_addresses
  WHERE user_id = p_user_id
    AND email_address = p_email_address
    AND address_type = 'client';
  
  IF v_email_id IS NULL THEN
    RAISE EXCEPTION 'Email address % not found for user %', p_email_address, p_user_id;
  END IF;
  
  -- Deactivate all other client emails for this user
  UPDATE email_addresses
  SET 
    is_active = FALSE,
    is_primary = FALSE,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND id != v_email_id;
  
  -- Activate and set as primary
  UPDATE email_addresses
  SET 
    is_active = TRUE,
    is_primary = TRUE,
    updated_at = NOW()
  WHERE id = v_email_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_primary_client_email IS 
'Safely sets an email as primary client email, deactivating all others for that user';

-- Step 4: Update create_client_email_address to enforce single email
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_middle_name TEXT;
  v_email TEXT;
  v_existing_email_id UUID;
  v_existing_email TEXT;
BEGIN
  -- Check if user already has an active client email
  SELECT id, email_address INTO v_existing_email_id, v_existing_email
  FROM email_addresses
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND is_active = TRUE
  LIMIT 1;
  
  -- If email already exists and is active, return it (don't create new one)
  IF v_existing_email_id IS NOT NULL THEN
    RAISE LOG 'User % already has active client email: %', p_user_id, v_existing_email;
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
  
  -- Generate email address
  v_email := generate_client_email(
    v_user.first_name,
    v_middle_name,
    v_user.last_name
  );
  
  -- Before inserting, deactivate any existing inactive emails for this user
  -- (to prevent accumulation of inactive emails)
  UPDATE email_addresses
  SET updated_at = NOW()
  WHERE user_id = p_user_id
    AND address_type = 'client'
    AND is_active = FALSE;
  
  -- Insert email address
  -- The unique index will prevent multiple active emails
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
  SET 
    user_id = p_user_id,
    is_active = TRUE,
    is_primary = TRUE,
    updated_at = NOW()
  RETURNING email_address INTO v_email;
  
  RAISE LOG 'Created new client email address % for user %', v_email, p_user_id;
  RETURN v_email;
EXCEPTION
  WHEN unique_violation THEN
    -- If unique constraint violation (multiple active emails), deactivate others and retry
    RAISE WARNING 'Multiple active emails detected for user %, cleaning up...', p_user_id;
    
    -- Deactivate all except the one we're trying to create
    UPDATE email_addresses
    SET is_active = FALSE, is_primary = FALSE
    WHERE user_id = p_user_id
      AND address_type = 'client'
      AND email_address != v_email;
    
    -- Retry insert
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
    SET 
      user_id = p_user_id,
      is_active = TRUE,
      is_primary = TRUE,
      updated_at = NOW()
    RETURNING email_address INTO v_email;
    
    RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add trigger to prevent multiple active emails
CREATE OR REPLACE FUNCTION enforce_single_active_client_email()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INT;
BEGIN
  -- Only check when setting email as active
  IF NEW.is_active = TRUE AND NEW.address_type = 'client' THEN
    -- Count active client emails for this user
    SELECT COUNT(*) INTO v_active_count
    FROM email_addresses
    WHERE user_id = NEW.user_id
      AND address_type = 'client'
      AND is_active = TRUE
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    -- If there's already an active email, deactivate it
    IF v_active_count > 0 THEN
      UPDATE email_addresses
      SET 
        is_active = FALSE,
        is_primary = FALSE,
        updated_at = NOW()
      WHERE user_id = NEW.user_id
        AND address_type = 'client'
        AND is_active = TRUE
        AND id != NEW.id;
      
      RAISE NOTICE 'Deactivated % other active client email(s) for user %', v_active_count, NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_enforce_single_active_client_email ON email_addresses;
CREATE TRIGGER trigger_enforce_single_active_client_email
  BEFORE INSERT OR UPDATE ON email_addresses
  FOR EACH ROW
  WHEN (NEW.address_type = 'client')
  EXECUTE FUNCTION enforce_single_active_client_email();

COMMENT ON TRIGGER trigger_enforce_single_active_client_email ON email_addresses IS 
'Ensures only one active client email per user by deactivating others when a new one is activated';

-- Step 6: Update handle_new_user trigger to check for existing email
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
  
  -- Insert user profile
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
  
  -- Update auth metadata with role
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', user_role)
  WHERE id = NEW.id;
  
  -- Auto-generate client email address ONLY if:
  -- 1. User is a client
  -- 2. User has name
  -- 3. User doesn't already have an active email address
  IF user_role = 'client' 
     AND NULLIF(TRIM(user_first_name), '') IS NOT NULL 
     AND NULLIF(TRIM(user_last_name), '') IS NOT NULL 
  THEN
    -- Check if user already has an active client email
    SELECT COUNT(*) INTO v_existing_email_count
    FROM email_addresses
    WHERE user_id = v_user_id
      AND address_type = 'client'
      AND is_active = TRUE;
    
    -- Only create if no active email exists
    IF v_existing_email_count = 0 THEN
      BEGIN
        PERFORM create_client_email_address(v_user_id);
        RAISE LOG 'Successfully created client email address for user %', v_user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create client email address for user %: %', v_user_id, SQLERRM;
      END;
    ELSE
      RAISE LOG 'User % already has % active client email address(es), skipping creation', v_user_id, v_existing_email_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Verify the constraint
DO $$
DECLARE
  violation_count INT;
BEGIN
  -- Check for any remaining violations
  SELECT COUNT(*) INTO violation_count
  FROM (
    SELECT user_id, COUNT(*) as cnt
    FROM email_addresses
    WHERE address_type = 'client' AND is_active = TRUE
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) violations;
  
  IF violation_count > 0 THEN
    RAISE WARNING 'Found % user(s) with multiple active client emails - these should be cleaned up', violation_count;
  ELSE
    RAISE NOTICE '✅ All users have at most one active client email';
  END IF;
END $$;

-- Step 8: Show summary
SELECT 
  'Summary' as info,
  COUNT(DISTINCT user_id) as users_with_client_emails,
  COUNT(*) FILTER (WHERE is_active = TRUE) as active_client_emails,
  COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_client_emails,
  COUNT(*) as total_client_emails
FROM email_addresses
WHERE address_type = 'client';

COMMENT ON FUNCTION create_client_email_address IS 
'Creates client email address only if user does not already have an active one (enforces one email per user)';

