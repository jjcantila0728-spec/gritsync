-- Optional: Regenerate email addresses for existing users with new logic
-- WARNING: This will change existing email addresses!
-- Only run this if you want to update emails to match the new format

-- Step 1: Preview what would change
SELECT 
  u.id,
  u.first_name,
  u.middle_name,
  u.last_name,
  ea.email_address as current_email,
  generate_client_email(u.first_name, u.middle_name, u.last_name) as new_email,
  CASE 
    WHEN ea.email_address = generate_client_email(u.first_name, u.middle_name, u.last_name) 
    THEN '✓ No change'
    ELSE '⚠️ Would change'
  END as status
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id 
  AND ea.address_type = 'client' 
  AND ea.is_active = TRUE
WHERE u.role = 'client'
  AND u.first_name IS NOT NULL
  AND u.last_name IS NOT NULL
ORDER BY u.created_at DESC;

-- Step 2: Regenerate emails for specific users (CAREFUL!)
-- Uncomment and modify to regenerate specific users

/*
-- Example: Regenerate for users with compound first names
DO $$
DECLARE
  user_record RECORD;
  new_email TEXT;
  old_email_id UUID;
BEGIN
  FOR user_record IN 
    SELECT 
      u.id,
      u.first_name,
      u.middle_name,
      u.last_name,
      ea.id as email_id,
      ea.email_address as current_email
    FROM users u
    JOIN email_addresses ea ON ea.user_id = u.id 
      AND ea.address_type = 'client' 
      AND ea.is_active = TRUE
    WHERE u.role = 'client'
      AND u.first_name LIKE '% %'  -- Has space in first name (compound)
  LOOP
    -- Generate new email
    new_email := generate_client_email(
      user_record.first_name,
      user_record.middle_name,
      user_record.last_name
    );
    
    -- If different from current, update it
    IF new_email != user_record.current_email THEN
      RAISE NOTICE 'Updating % % %: % → %',
        user_record.first_name,
        COALESCE(user_record.middle_name, ''),
        user_record.last_name,
        user_record.current_email,
        new_email;
      
      -- Deactivate old email
      UPDATE email_addresses
      SET is_active = FALSE,
          is_primary = FALSE,
          updated_at = NOW()
      WHERE id = user_record.email_id;
      
      -- Create new email
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
        new_email,
        user_record.first_name || ' ' || user_record.last_name,
        user_record.id,
        FALSE,
        'client',
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE
      );
    END IF;
  END LOOP;
END $$;
*/

-- Step 3: Manual regeneration for specific user
-- Replace [user_id] with actual user ID

/*
DO $$
DECLARE
  v_user_id UUID := '[user_id]';  -- Replace with actual UUID
  v_new_email TEXT;
BEGIN
  -- Deactivate old email
  UPDATE email_addresses
  SET is_active = FALSE,
      is_primary = FALSE
  WHERE user_id = v_user_id
    AND address_type = 'client';
  
  -- Create new email with updated logic
  v_new_email := create_client_email_address(v_user_id);
  
  RAISE NOTICE 'New email for user %: %', v_user_id, v_new_email;
END $$;
*/

-- Step 4: Verify the results
SELECT 
  u.first_name || 
  CASE WHEN u.middle_name IS NOT NULL THEN ' ' || u.middle_name ELSE '' END || 
  ' ' || u.last_name as full_name,
  STRING_AGG(
    CASE 
      WHEN ea.is_active THEN '✓ ' || ea.email_address 
      ELSE '✗ ' || ea.email_address 
    END,
    ', '
    ORDER BY ea.created_at DESC
  ) as all_emails,
  COUNT(ea.id) FILTER (WHERE ea.is_active) as active_count
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
WHERE u.role = 'client'
GROUP BY u.id, u.first_name, u.middle_name, u.last_name
ORDER BY u.created_at DESC;

