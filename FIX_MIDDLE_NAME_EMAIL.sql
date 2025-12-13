-- Quick Fix: Update email addresses to include middle initial
-- Run this in Supabase SQL Editor to immediately fix emails missing middle initials

-- STEP 1: View users who need their email updated
-- (Check before running updates)
SELECT 
  u.id,
  u.first_name,
  u.middle_name as users_middle_name,
  u.last_name,
  ud.middle_name as details_middle_name,
  ea.email_address as current_email,
  -- Show what the new email would be
  LOWER(SUBSTRING(u.first_name FROM 1 FOR 1)) || 
  LOWER(SUBSTRING(COALESCE(ud.middle_name, u.middle_name, '') FROM 1 FOR 1)) || 
  LOWER(REGEXP_REPLACE(u.last_name, '[^a-zA-Z]', '', 'g')) || 
  '@gritsync.com' as should_be_email
FROM users u
LEFT JOIN user_details ud ON ud.user_id = u.id
LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client' AND ea.is_primary = TRUE
WHERE u.role = 'client'
  AND u.first_name IS NOT NULL
  AND u.last_name IS NOT NULL
  AND ea.email_address IS NOT NULL
  -- Has middle name somewhere
  AND (ud.middle_name IS NOT NULL AND TRIM(ud.middle_name) != '')
  -- Current email doesn't have middle initial
  AND ea.email_address NOT LIKE '%' || LOWER(SUBSTRING(ud.middle_name FROM 1 FOR 1)) || '%'
ORDER BY u.last_name, u.first_name;

-- STEP 2: For a specific user (e.g., Kristine Linda Cantila)
-- Update their email from kcantila@gritsync.com to klcantila@gritsync.com
/*
UPDATE email_addresses
SET email_address = 'klcantila@gritsync.com',
    updated_at = NOW()
WHERE email_address = 'kcantila@gritsync.com'
  AND address_type = 'client';

-- Also update in processing_accounts if it exists
UPDATE processing_accounts
SET email = 'klcantila@gritsync.com',
    updated_at = NOW()
WHERE email = 'kcantila@gritsync.com'
  AND account_type = 'gritsync';
*/

-- STEP 3: Bulk update all users with missing middle initials
-- (Uncomment to run)
/*
DO $$
DECLARE
  user_rec RECORD;
  new_email TEXT;
  first_init TEXT;
  middle_init TEXT;
  last_clean TEXT;
BEGIN
  FOR user_rec IN
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      COALESCE(ud.middle_name, u.middle_name) as middle_name,
      ea.email_address as current_email,
      ea.id as email_id
    FROM users u
    LEFT JOIN user_details ud ON ud.user_id = u.id
    INNER JOIN email_addresses ea ON ea.user_id = u.id 
      AND ea.address_type = 'client' 
      AND ea.is_primary = TRUE
    WHERE u.role = 'client'
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND (ud.middle_name IS NOT NULL AND TRIM(ud.middle_name) != '')
  LOOP
    -- Generate new email with middle initial
    first_init := LOWER(SUBSTRING(user_rec.first_name FROM 1 FOR 1));
    middle_init := LOWER(SUBSTRING(user_rec.middle_name FROM 1 FOR 1));
    last_clean := LOWER(REGEXP_REPLACE(user_rec.last_name, '[^a-zA-Z]', '', 'g'));
    new_email := first_init || middle_init || last_clean || '@gritsync.com';
    
    -- Only update if email changed and new email doesn't exist
    IF new_email != user_rec.current_email THEN
      IF NOT EXISTS (SELECT 1 FROM email_addresses WHERE email_address = new_email) THEN
        -- Update email_addresses
        UPDATE email_addresses
        SET email_address = new_email,
            updated_at = NOW()
        WHERE id = user_rec.email_id;
        
        -- Update processing_accounts
        UPDATE processing_accounts
        SET email = new_email,
            updated_at = NOW()
        WHERE email = user_rec.current_email
          AND account_type = 'gritsync';
        
        RAISE NOTICE 'Updated: % -> %', user_rec.current_email, new_email;
      ELSE
        RAISE NOTICE 'Skipped % (new email % already exists)', user_rec.current_email, new_email;
      END IF;
    END IF;
  END LOOP;
END $$;
*/

-- STEP 4: Verify the updates
SELECT 
  u.first_name,
  COALESCE(ud.middle_name, u.middle_name) as middle_name,
  u.last_name,
  ea.email_address,
  'Looks good!' as status
FROM users u
LEFT JOIN user_details ud ON ud.user_id = u.id
INNER JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
WHERE u.role = 'client'
  AND u.first_name IS NOT NULL
  AND u.last_name IS NOT NULL
ORDER BY u.last_name, u.first_name;

