-- Regenerate email for Karl Louie Cantila
-- This will update klcantila1@gritsync.com to klcantila@gritsync.com

-- Step 1: First, let's see the current situation
SELECT 
  u.id,
  u.first_name,
  u.middle_name,
  u.last_name,
  ea.email_address as current_email,
  generate_client_email(u.first_name, u.middle_name, u.last_name) as new_email
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id 
  AND ea.address_type = 'client' 
  AND ea.is_active = TRUE
WHERE u.first_name = 'Karl' 
  AND u.last_name = 'Cantila';

-- Step 2: Regenerate the email (uncomment to execute)
-- This will:
-- 1. Deactivate the old email (klcantila1@gritsync.com)
-- 2. Create new email with updated logic (klcantila@gritsync.com)

/*
DO $$
DECLARE
  v_user_id UUID;
  v_old_email TEXT;
  v_new_email TEXT;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM users
  WHERE first_name = 'Karl' 
    AND last_name = 'Cantila'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get current email
  SELECT email_address INTO v_old_email
  FROM email_addresses
  WHERE user_id = v_user_id
    AND address_type = 'client'
    AND is_active = TRUE;
  
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Old email: %', v_old_email;
  
  -- Deactivate old email
  UPDATE email_addresses
  SET is_active = FALSE,
      is_primary = FALSE,
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND address_type = 'client';
  
  RAISE NOTICE 'Deactivated old email';
  
  -- Generate new email
  v_new_email := create_client_email_address(v_user_id);
  
  RAISE NOTICE 'New email generated: %', v_new_email;
  RAISE NOTICE 'Email regeneration complete!';
  
END $$;
*/

-- Step 3: Verify the change
SELECT 
  u.first_name || ' ' || COALESCE(u.middle_name || ' ', '') || u.last_name as full_name,
  STRING_AGG(
    CASE 
      WHEN ea.is_active THEN '✓ ' || ea.email_address || ' (ACTIVE)'
      ELSE '✗ ' || ea.email_address || ' (inactive)'
    END,
    E'\n'
    ORDER BY ea.created_at DESC
  ) as all_emails
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
WHERE u.first_name = 'Karl' AND u.last_name = 'Cantila'
GROUP BY u.id, u.first_name, u.middle_name, u.last_name;

