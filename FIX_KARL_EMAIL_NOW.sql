-- Quick Fix: Update Karl Cantila's email from klcantila1@gritsync.com to klcantila@gritsync.com
-- Run this entire script in Supabase SQL Editor

-- Step 1: Apply the new email generation logic (if not already done)
CREATE OR REPLACE FUNCTION generate_client_email(
  p_first_name TEXT,
  p_middle_name TEXT,
  p_last_name TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
  v_first_part TEXT;
  v_lastname TEXT;
  v_counter INTEGER := 0;
  v_suffix TEXT := '';
  v_first_name_words TEXT[];
  v_first_name_word_count INTEGER;
BEGIN
  v_first_name_words := STRING_TO_ARRAY(TRIM(p_first_name), ' ');
  v_first_name_word_count := ARRAY_LENGTH(v_first_name_words, 1);
  
  IF v_first_name_word_count >= 2 THEN
    v_first_part := LOWER(
      SUBSTRING(v_first_name_words[1] FROM 1 FOR 1) ||
      SUBSTRING(v_first_name_words[2] FROM 1 FOR 1)
    );
  ELSIF p_middle_name IS NOT NULL AND LENGTH(TRIM(p_middle_name)) > 0 THEN
    v_first_part := LOWER(
      SUBSTRING(p_first_name FROM 1 FOR 1) ||
      SUBSTRING(p_middle_name FROM 1 FOR 1)
    );
  ELSE
    v_first_part := LOWER(SUBSTRING(p_first_name FROM 1 FOR 1));
  END IF;
  
  v_lastname := LOWER(REGEXP_REPLACE(p_last_name, '[^a-zA-Z]', '', 'g'));
  v_email := v_first_part || v_lastname || '@gritsync.com';
  
  WHILE EXISTS (SELECT 1 FROM email_addresses WHERE email_address = v_email AND is_active = TRUE) LOOP
    v_counter := v_counter + 1;
    v_suffix := v_counter::TEXT;
    v_email := v_first_part || v_lastname || v_suffix || '@gritsync.com';
  END LOOP;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Regenerate Karl's email
DO $$
DECLARE
  v_user_id UUID;
  v_old_email TEXT;
  v_new_email TEXT;
  v_first_name TEXT;
  v_middle_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Find Karl Cantila
  SELECT id, first_name, middle_name, last_name
  INTO v_user_id, v_first_name, v_middle_name, v_last_name
  FROM users
  WHERE (first_name ILIKE '%karl%' OR first_name ILIKE '%cantila%')
    AND last_name ILIKE '%cantila%'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Please check the name.';
  END IF;
  
  -- Get current email
  SELECT email_address INTO v_old_email
  FROM email_addresses
  WHERE user_id = v_user_id
    AND address_type = 'client'
    AND is_active = TRUE;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Found user: % % %', v_first_name, v_middle_name, v_last_name;
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Current email: %', v_old_email;
  RAISE NOTICE '========================================';
  
  -- Deactivate old email
  UPDATE email_addresses
  SET is_active = FALSE,
      is_primary = FALSE,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND address_type = 'client'
    AND is_active = TRUE;
  
  RAISE NOTICE 'Deactivated: %', v_old_email;
  
  -- Generate new email
  v_new_email := generate_client_email(v_first_name, v_middle_name, v_last_name);
  
  -- Create new email address
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
    v_new_email,
    v_first_name || ' ' || v_last_name,
    v_user_id,
    FALSE,
    'client',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE
  );
  
  RAISE NOTICE 'Created new email: %', v_new_email;
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Email updated successfully!';
  RAISE NOTICE 'Old: % → New: %', v_old_email, v_new_email;
  RAISE NOTICE '========================================';
END $$;

-- Step 3: Verify the result
SELECT 
  u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name as full_name,
  ea.email_address,
  ea.is_active,
  ea.is_primary,
  ea.created_at
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE ea.address_type = 'client'
  AND (u.first_name ILIKE '%karl%' OR u.last_name ILIKE '%cantila%')
ORDER BY ea.created_at DESC;

