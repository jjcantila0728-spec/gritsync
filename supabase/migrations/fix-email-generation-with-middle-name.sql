-- Fix: Email generation to pull middle_name from user_details if not in users table
-- This ensures emails like klcantila@gritsync.com include the middle initial

-- Update create_client_email_address function to check user_details for middle_name
CREATE OR REPLACE FUNCTION create_client_email_address(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_user RECORD;
  v_middle_name TEXT;
  v_email TEXT;
BEGIN
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
  
  -- Insert email address (or update if exists)
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
  ON CONFLICT (email_address) DO NOTHING;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Update existing email addresses that are missing middle initial
-- This will regenerate emails for users who have middle_name in user_details
DO $$
DECLARE
  user_record RECORD;
  old_email TEXT;
  new_email TEXT;
  has_middle TEXT;
BEGIN
  FOR user_record IN 
    SELECT 
      u.id,
      u.first_name,
      u.middle_name as users_middle_name,
      u.last_name,
      ud.middle_name as details_middle_name,
      ea.email_address as current_email,
      ea.id as email_id
    FROM users u
    LEFT JOIN user_details ud ON ud.user_id = u.id
    INNER JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client'
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      -- User has middle name in user_details but not in users table
      AND (u.middle_name IS NULL OR TRIM(u.middle_name) = '')
      AND ud.middle_name IS NOT NULL
      AND TRIM(ud.middle_name) != ''
  LOOP
    BEGIN
      -- Get the middle name from user_details
      has_middle := user_record.details_middle_name;
      
      -- Generate new email with middle initial
      new_email := generate_client_email(
        user_record.first_name,
        has_middle,
        user_record.last_name
      );
      
      old_email := user_record.current_email;
      
      -- Only update if the email actually changed
      IF new_email != old_email THEN
        -- Check if new email already exists
        IF NOT EXISTS (SELECT 1 FROM email_addresses WHERE email_address = new_email) THEN
          -- Update the email address
          UPDATE email_addresses
          SET email_address = new_email,
              updated_at = NOW()
          WHERE id = user_record.email_id;
          
          RAISE NOTICE 'Updated email for user %: % -> %', user_record.id, old_email, new_email;
        ELSE
          RAISE WARNING 'Cannot update user % email to % - already exists', user_record.id, new_email;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update email for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Also update processing_accounts to use the new email
DO $$
DECLARE
  account_record RECORD;
  new_email TEXT;
BEGIN
  FOR account_record IN
    SELECT 
      pa.id as account_id,
      pa.application_id,
      pa.email as old_email,
      ea.email_address as new_email,
      u.id as user_id
    FROM processing_accounts pa
    INNER JOIN applications a ON a.id = pa.application_id
    INNER JOIN users u ON u.id = a.user_id
    INNER JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client' AND ea.is_primary = TRUE
    WHERE pa.account_type = 'gritsync'
      AND pa.email != ea.email_address  -- Email is different
  LOOP
    BEGIN
      -- Update processing account email
      UPDATE processing_accounts
      SET email = account_record.new_email,
          updated_at = NOW()
      WHERE id = account_record.account_id;
      
      RAISE NOTICE 'Updated processing account email: % -> %', account_record.old_email, account_record.new_email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update processing account %: %', account_record.account_id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION create_client_email_address IS 'Creates client email address, pulling middle_name from user_details if not in users table';

