-- Cleanup Script: Remove duplicate client email addresses
-- Keeps the FIRST (oldest) email address created for each user
-- Deactivates any newer duplicates

-- Step 1: Show current duplicates
SELECT 
  u.id as user_id,
  u.first_name,
  u.last_name,
  u.email as auth_email,
  ea.email_address as client_email,
  ea.is_active,
  ea.is_primary,
  ea.created_at,
  ROW_NUMBER() OVER (PARTITION BY ea.user_id ORDER BY ea.created_at ASC) as email_rank
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE ea.address_type = 'client'
  AND u.role = 'client'
ORDER BY u.id, ea.created_at;

-- Step 2: Clean up duplicates (keeps oldest, deactivates rest)
DO $$
DECLARE
  user_record RECORD;
  keep_email_id UUID;
  keep_email_address TEXT;
  duplicate_count INT;
BEGIN
  RAISE NOTICE '=== Cleaning Up Duplicate Email Addresses ===';
  
  -- Find users with multiple client email addresses
  FOR user_record IN 
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      COUNT(ea.id) as email_count
    FROM users u
    JOIN email_addresses ea ON ea.user_id = u.id
    WHERE ea.address_type = 'client'
      AND u.role = 'client'
    GROUP BY u.id, u.first_name, u.last_name
    HAVING COUNT(ea.id) > 1
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE 'User: % % (ID: %) has % email addresses',
      user_record.first_name,
      user_record.last_name,
      user_record.user_id,
      user_record.email_count;
    
    -- Get the OLDEST (first created) email address to keep
    SELECT id, email_address 
    INTO keep_email_id, keep_email_address
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
    ORDER BY created_at ASC
    LIMIT 1;
    
    RAISE NOTICE '  ✓ Keeping: % (ID: %)', keep_email_address, keep_email_id;
    
    -- Mark it as primary and active
    UPDATE email_addresses
    SET 
      is_primary = TRUE,
      is_active = TRUE,
      updated_at = NOW()
    WHERE id = keep_email_id;
    
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM email_addresses
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND id != keep_email_id;
    
    -- Deactivate all other email addresses for this user
    UPDATE email_addresses
    SET 
      is_active = FALSE,
      is_primary = FALSE,
      updated_at = NOW()
    WHERE user_id = user_record.user_id
      AND address_type = 'client'
      AND id != keep_email_id;
    
    RAISE NOTICE '  ✗ Deactivated % duplicate(s)', duplicate_count;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Cleanup Complete ===';
END $$;

-- Step 3: Verify the cleanup
SELECT 
  u.id as user_id,
  u.first_name,
  u.last_name,
  COUNT(ea.id) as total_emails,
  COUNT(ea.id) FILTER (WHERE ea.is_active = TRUE) as active_emails,
  COUNT(ea.id) FILTER (WHERE ea.is_primary = TRUE) as primary_emails,
  STRING_AGG(
    CASE 
      WHEN ea.is_active THEN '✓ ' || ea.email_address 
      ELSE '✗ ' || ea.email_address 
    END, 
    ', ' 
    ORDER BY ea.created_at
  ) as all_emails
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
WHERE u.role = 'client'
GROUP BY u.id, u.first_name, u.last_name
ORDER BY total_emails DESC, u.created_at DESC;

-- Step 4: Show final active email addresses
SELECT 
  u.first_name || ' ' || u.last_name as full_name,
  u.email as auth_email,
  ea.email_address as client_email,
  ea.is_primary,
  ea.created_at
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE ea.address_type = 'client'
  AND ea.is_active = TRUE
  AND u.role = 'client'
ORDER BY u.created_at DESC;

-- Optional: Permanently delete inactive duplicate emails (use with caution!)
-- Uncomment the following if you want to permanently remove duplicates instead of just deactivating

/*
DELETE FROM email_addresses
WHERE id IN (
  SELECT ea.id
  FROM email_addresses ea
  WHERE ea.address_type = 'client'
    AND ea.is_active = FALSE
    AND EXISTS (
      SELECT 1 
      FROM email_addresses ea2
      WHERE ea2.user_id = ea.user_id
        AND ea2.address_type = 'client'
        AND ea2.is_active = TRUE
        AND ea2.created_at < ea.created_at
    )
);
*/

