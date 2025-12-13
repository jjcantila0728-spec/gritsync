-- Update email generation to handle compound first names
-- Logic:
-- 1. If first_name has 2 words (e.g., "Joy Jeric", "Krizza Mae")
--    → Use first letter of each word + lastname (jjcantila@gritsync.com, kmcantila@gritsync.com)
-- 2. If first_name has 1 word and has middle_name
--    → Use first letter of first_name + first letter of middle_name + lastname (jmcantila@gritsync.com)
-- 3. If only first_name (no middle, single word)
--    → Use first letter of first_name + lastname (jcantila@gritsync.com)

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
  -- Clean and split first_name by spaces
  v_first_name_words := STRING_TO_ARRAY(TRIM(p_first_name), ' ');
  v_first_name_word_count := ARRAY_LENGTH(v_first_name_words, 1);
  
  -- Generate first part of email based on name structure
  IF v_first_name_word_count >= 2 THEN
    -- Compound first name (e.g., "Joy Jeric" → "jj", "Krizza Mae" → "km")
    -- Use first letter of first word + first letter of second word
    v_first_part := LOWER(
      SUBSTRING(v_first_name_words[1] FROM 1 FOR 1) ||
      SUBSTRING(v_first_name_words[2] FROM 1 FOR 1)
    );
    
    RAISE LOG 'Compound first name detected: % → first part: %', p_first_name, v_first_part;
    
  ELSIF p_middle_name IS NOT NULL AND LENGTH(TRIM(p_middle_name)) > 0 THEN
    -- Single first name with middle name (e.g., "Karl" + "Louie" → "kl")
    -- Use first letter of first_name + first letter of middle_name
    v_first_part := LOWER(
      SUBSTRING(p_first_name FROM 1 FOR 1) ||
      SUBSTRING(p_middle_name FROM 1 FOR 1)
    );
    
    RAISE LOG 'Single first name with middle: % % → first part: %', p_first_name, p_middle_name, v_first_part;
    
  ELSE
    -- Only first name, no middle (e.g., "Karl" → "k")
    -- Use just first letter of first_name
    v_first_part := LOWER(SUBSTRING(p_first_name FROM 1 FOR 1));
    
    RAISE LOG 'Single first name only: % → first part: %', p_first_name, v_first_part;
  END IF;
  
  -- Clean lastname (remove spaces and special characters)
  v_lastname := LOWER(REGEXP_REPLACE(p_last_name, '[^a-zA-Z]', '', 'g'));
  
  -- Generate base email
  v_email := v_first_part || v_lastname || '@gritsync.com';
  
  RAISE LOG 'Generated base email: %', v_email;
  
  -- Check if email already exists and add number suffix if needed
  WHILE EXISTS (SELECT 1 FROM email_addresses WHERE email_address = v_email) LOOP
    v_counter := v_counter + 1;
    v_suffix := v_counter::TEXT;
    v_email := v_first_part || v_lastname || v_suffix || '@gritsync.com';
    RAISE LOG 'Email exists, trying with suffix: %', v_email;
  END LOOP;
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Test the function with examples
DO $$
DECLARE
  test_email TEXT;
BEGIN
  RAISE NOTICE '=== Testing Email Generation ===';
  RAISE NOTICE '';
  
  -- Test 1: Compound first name (Joy Jeric)
  test_email := generate_client_email('Joy Jeric', NULL, 'Cantila');
  RAISE NOTICE 'Test 1: Joy Jeric Cantila → %', test_email;
  RAISE NOTICE 'Expected: jjcantila@gritsync.com';
  RAISE NOTICE '';
  
  -- Test 2: Compound first name (Krizza Mae)
  test_email := generate_client_email('Krizza Mae', NULL, 'Cantila');
  RAISE NOTICE 'Test 2: Krizza Mae Cantila → %', test_email;
  RAISE NOTICE 'Expected: kmcantila@gritsync.com';
  RAISE NOTICE '';
  
  -- Test 3: Single first name with middle name (Karl Louie)
  test_email := generate_client_email('Karl', 'Louie', 'Cantila');
  RAISE NOTICE 'Test 3: Karl Louie Cantila → %', test_email;
  RAISE NOTICE 'Expected: klcantila@gritsync.com';
  RAISE NOTICE '';
  
  -- Test 4: Single first name, no middle (John)
  test_email := generate_client_email('John', NULL, 'Doe');
  RAISE NOTICE 'Test 4: John Doe → %', test_email;
  RAISE NOTICE 'Expected: jdoe@gritsync.com';
  RAISE NOTICE '';
  
  -- Test 5: Three-word first name (Mary Jane Rose) - uses first 2 words
  test_email := generate_client_email('Mary Jane Rose', NULL, 'Smith');
  RAISE NOTICE 'Test 5: Mary Jane Rose Smith → %', test_email;
  RAISE NOTICE 'Expected: mjsmith@gritsync.com (first 2 words)';
  RAISE NOTICE '';
  
  RAISE NOTICE '=== Tests Complete ===';
END $$;

-- Show examples of how existing users would be affected
DO $$
DECLARE
  user_record RECORD;
  new_email TEXT;
  old_email TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Preview: How Existing Users Would Be Affected ===';
  RAISE NOTICE '(This is just a preview - not actually changing anything)';
  RAISE NOTICE '';
  
  FOR user_record IN 
    SELECT 
      u.id,
      u.first_name,
      u.middle_name,
      u.last_name,
      ea.email_address as current_email
    FROM users u
    LEFT JOIN email_addresses ea ON ea.user_id = u.id 
      AND ea.address_type = 'client' 
      AND ea.is_active = TRUE
    WHERE u.role = 'client'
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
    ORDER BY u.created_at DESC
    LIMIT 10
  LOOP
    -- Generate what the new email would be
    new_email := generate_client_email(
      user_record.first_name,
      user_record.middle_name,
      user_record.last_name
    );
    
    old_email := COALESCE(user_record.current_email, '(none)');
    
    IF new_email = old_email THEN
      RAISE NOTICE '✓ % % % → % (no change)', 
        user_record.first_name,
        COALESCE(user_record.middle_name, ''),
        user_record.last_name,
        old_email;
    ELSE
      RAISE NOTICE '  % % % → OLD: % | NEW: %', 
        user_record.first_name,
        COALESCE(user_record.middle_name, ''),
        user_record.last_name,
        old_email,
        new_email;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Preview Complete ===';
  RAISE NOTICE 'NOTE: Existing emails will NOT be changed automatically.';
  RAISE NOTICE 'This new logic only applies to NEW users or manual regeneration.';
END $$;

COMMENT ON FUNCTION generate_client_email IS 'Generates client email with logic: compound first names use both initials, single names use first+middle initial';

