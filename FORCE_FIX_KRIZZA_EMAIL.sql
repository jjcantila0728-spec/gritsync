-- Force Fix: Ensure kmcantila@gritsync.com is the active email for Krizza Mae Cantila
-- This script handles all edge cases and forces the correct email

-- Step 1: Diagnostic (shows current state)
SELECT 
  '=== CURRENT STATE ===' as step,
  u.id as user_id,
  u.first_name,
  u.middle_name,
  u.last_name,
  ea.email_address,
  ea.is_active,
  ea.is_primary
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client' AND ea.is_active = TRUE
WHERE (u.first_name ILIKE '%krizza%' OR u.first_name ILIKE '%mae%')
  AND u.last_name ILIKE '%cantila%';

-- Step 2: Fix the user's name if split
UPDATE users
SET 
  first_name = 'Krizza Mae',
  middle_name = NULL,
  updated_at = NOW()
WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
  AND last_name ILIKE '%cantila%'
  AND (first_name != 'Krizza Mae' OR middle_name IS NOT NULL);

-- Step 3: Deactivate ALL existing client emails for this user
UPDATE email_addresses
SET 
  is_active = FALSE,
  is_primary = FALSE,
  updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM users
  WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
    AND last_name ILIKE '%cantila%'
)
AND address_type = 'client';

-- Step 4: Delete or deactivate kmcantila@gritsync.com if it exists for another user
UPDATE email_addresses
SET 
  is_active = FALSE,
  is_primary = FALSE,
  updated_at = NOW()
WHERE email_address = 'kmcantila@gritsync.com'
  AND user_id NOT IN (
    SELECT id FROM users
    WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
      AND last_name ILIKE '%cantila%'
  );

-- Step 5: Insert or activate kmcantila@gritsync.com
DO $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM users
  WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
    AND last_name ILIKE '%cantila%'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User Krizza Mae Cantila not found!';
  END IF;
  
  -- Check if email already exists for this user
  SELECT EXISTS(
    SELECT 1 FROM email_addresses
    WHERE email_address = 'kmcantila@gritsync.com'
      AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing email to active
    UPDATE email_addresses
    SET 
      is_active = TRUE,
      is_primary = TRUE,
      is_verified = TRUE,
      can_send = TRUE,
      can_receive = TRUE,
      updated_at = NOW()
    WHERE email_address = 'kmcantila@gritsync.com'
      AND user_id = v_user_id;
    
    RAISE NOTICE '✅ Activated existing email: kmcantila@gritsync.com';
  ELSE
    -- Insert new email
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
      'kmcantila@gritsync.com',
      'Krizza Mae Cantila',
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
    SET 
      user_id = v_user_id,
      is_active = TRUE,
      is_primary = TRUE,
      is_verified = TRUE,
      can_send = TRUE,
      can_receive = TRUE,
      updated_at = NOW();
    
    RAISE NOTICE '✅ Created new email: kmcantila@gritsync.com';
  END IF;
  
  RAISE NOTICE '✅ Email fix complete for user: %', v_user_id;
END $$;

-- Step 6: Verify the result
SELECT 
  '=== FINAL RESULT ===' as step,
  u.id as user_id,
  u.first_name,
  u.middle_name,
  u.last_name,
  ea.email_address,
  ea.is_active,
  ea.is_primary,
  ea.is_verified,
  ea.can_send,
  ea.can_receive
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE (u.first_name ILIKE '%krizza%' OR u.first_name ILIKE '%mae%')
  AND u.last_name ILIKE '%cantila%'
  AND ea.address_type = 'client'
ORDER BY 
  ea.is_active DESC,
  ea.is_primary DESC,
  ea.created_at DESC;

-- Step 7: Show summary
SELECT 
  '=== SUMMARY ===' as step,
  COUNT(*) FILTER (WHERE ea.email_address = 'kmcantila@gritsync.com' AND ea.is_active = TRUE) as active_kmcantila,
  COUNT(*) FILTER (WHERE ea.address_type = 'client' AND ea.is_active = TRUE) as total_active_client_emails,
  STRING_AGG(
    CASE WHEN ea.is_active THEN '✓ ' || ea.email_address ELSE '✗ ' || ea.email_address END,
    ', '
    ORDER BY ea.created_at DESC
  ) as all_emails
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE (u.first_name ILIKE '%krizza%' OR u.first_name ILIKE '%mae%')
  AND u.last_name ILIKE '%cantila%'
  AND ea.address_type = 'client';

