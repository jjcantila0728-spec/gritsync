-- Fix: Update Krizza Mae Cantila's email to kmcantila@gritsync.com
-- This uses compound first name logic: Krizza + Mae → km

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
    -- Compound first name: use first letter of each word
    v_first_part := LOWER(
      SUBSTRING(v_first_name_words[1] FROM 1 FOR 1) ||
      SUBSTRING(v_first_name_words[2] FROM 1 FOR 1)
    );
  ELSIF p_middle_name IS NOT NULL AND LENGTH(TRIM(p_middle_name)) > 0 THEN
    -- Single first name with middle: use first + middle initial
    v_first_part := LOWER(
      SUBSTRING(p_first_name FROM 1 FOR 1) ||
      SUBSTRING(p_middle_name FROM 1 FOR 1)
    );
  ELSE
    -- Single first name only: use first initial
    v_first_part := LOWER(SUBSTRING(p_first_name FROM 1 FOR 1));
  END IF;
  
  v_lastname := LOWER(REGEXP_REPLACE(p_last_name, '[^a-zA-Z]', '', 'g'));
  v_email := v_first_part || v_lastname || '@gritsync.com';
  
  -- Check if email exists (only check active emails for collision)
  WHILE EXISTS (
    SELECT 1 FROM email_addresses 
    WHERE email_address = v_email 
      AND is_active = TRUE
      AND (address_type = 'client' OR address_type IS NULL)
  ) LOOP
    v_counter := v_counter + 1;
    v_suffix := v_counter::TEXT;
    v_email := v_first_part || v_lastname || v_suffix || '@gritsync.com';
  END LOOP;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Check current situation
SELECT 
  u.id,
  u.first_name,
  u.middle_name,
  u.last_name,
  ea.email_address as current_email,
  generate_client_email('Krizza Mae', NULL, 'Cantila') as expected_email
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id 
  AND ea.address_type = 'client' 
  AND ea.is_active = TRUE
WHERE (u.first_name ILIKE '%krizza%' OR u.first_name ILIKE '%mae%')
  AND u.last_name ILIKE '%cantila%';

-- Step 3: Update Krizza's email
DO $$
DECLARE
  v_user_id UUID;
  v_old_email TEXT;
  v_new_email TEXT;
  v_first_name TEXT;
  v_middle_name TEXT;
  v_last_name TEXT;
  v_current_first_name TEXT;
BEGIN
  -- Find Krizza Mae Cantila (search flexibly)
  SELECT id, first_name, middle_name, last_name
  INTO v_user_id, v_current_first_name, v_middle_name, v_last_name
  FROM users
  WHERE (
    first_name ILIKE '%krizza%' 
    OR first_name ILIKE '%krizza mae%'
    OR (first_name ILIKE '%krizza%' AND middle_name ILIKE '%mae%')
  )
    AND last_name ILIKE '%cantila%'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User Krizza Mae Cantila not found. Please check the name.';
  END IF;
  
  -- Normalize first name - ensure it's "Krizza Mae" (compound first name)
  -- If it's split into first_name="Krizza" and middle_name="Mae", combine them
  IF v_current_first_name ILIKE '%krizza%' AND v_middle_name ILIKE '%mae%' THEN
    -- Name is split: combine into compound first name
    v_first_name := v_current_first_name || ' ' || v_middle_name;
    v_middle_name := NULL;  -- No separate middle name
    
    -- Update the user's name in database to reflect compound first name
    UPDATE users
    SET first_name = v_first_name,
        middle_name = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Detected split name - combining: % + % = %', v_current_first_name, v_middle_name, v_first_name;
    RAISE NOTICE 'Updated user record: first_name = %, middle_name = NULL', v_first_name;
  ELSIF v_current_first_name ILIKE '%krizza mae%' OR v_current_first_name ILIKE '%krizza%mae%' THEN
    -- Already compound
    v_first_name := v_current_first_name;
    RAISE NOTICE 'Already compound first name: %', v_first_name;
  ELSE
    v_first_name := v_current_first_name;
  END IF;
  
  -- Get current email
  SELECT email_address INTO v_old_email
  FROM email_addresses
  WHERE user_id = v_user_id
    AND address_type = 'client'
    AND is_active = TRUE;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Found user: % % %', v_first_name, COALESCE(v_middle_name, ''), v_last_name;
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Current email: %', v_old_email;
  RAISE NOTICE '========================================';
  
  -- Generate new email (using compound first name: Krizza Mae → km)
  v_new_email := generate_client_email(v_first_name, v_middle_name, v_last_name);
  
  RAISE NOTICE 'Expected email (Krizza Mae Cantila): kmcantila@gritsync.com';
  RAISE NOTICE 'Generated email: %', v_new_email;
  
  IF v_new_email = v_old_email THEN
    RAISE NOTICE '✅ Email is already correct! No changes needed.';
    RETURN;
  END IF;
  
  -- Deactivate old email
  UPDATE email_addresses
  SET is_active = FALSE,
      is_primary = FALSE,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND address_type = 'client'
    AND is_active = TRUE;
  
  RAISE NOTICE 'Deactivated old email: %', v_old_email;
  
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
  )
  ON CONFLICT (email_address) DO UPDATE
  SET is_active = TRUE,
      is_primary = TRUE,
      updated_at = NOW();
  
  RAISE NOTICE 'Created/Updated email: %', v_new_email;
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Email updated successfully!';
  RAISE NOTICE 'Old: %', v_old_email;
  RAISE NOTICE 'New: %', v_new_email;
  RAISE NOTICE '========================================';
END $$;

-- Step 4: Verify the result
SELECT 
  u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name as full_name,
  ea.email_address,
  ea.is_active,
  ea.is_primary,
  ea.created_at
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE ea.address_type = 'client'
  AND (u.first_name ILIKE '%krizza%' OR u.last_name ILIKE '%cantila%')
ORDER BY ea.created_at DESC;

-- Step 5: Test the generation logic
SELECT 
  'Krizza Mae Cantila' as test_name,
  generate_client_email('Krizza Mae', NULL, 'Cantila') as generated_email,
  'kmcantila@gritsync.com' as expected_email,
  CASE 
    WHEN generate_client_email('Krizza Mae', NULL, 'Cantila') = 'kmcantila@gritsync.com' 
    THEN '✅ CORRECT' 
    ELSE '❌ WRONG' 
  END as status;

