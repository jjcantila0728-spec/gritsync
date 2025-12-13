-- Run this query to check if the user has a GritSync email in the database
-- Replace 'USER_EMAIL_HERE' with the actual user's email (e.g., kmcantila@gmail.com)

-- Step 1: Find the user's ID
SELECT id, email, 
       raw_user_meta_data->>'first_name' as first_name,
       raw_user_meta_data->>'last_name' as last_name
FROM auth.users 
WHERE email = 'kmcantila@gmail.com'; -- Replace with actual user email

-- Step 2: Check if user has a GritSync email
SELECT ea.*, u.first_name, u.middle_name, u.last_name
FROM email_addresses ea
LEFT JOIN users u ON ea.user_id = u.id
WHERE ea.user_id = (
  SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com' -- Replace with actual user email
);

-- Step 3: Check users table for middle_name
SELECT id, first_name, middle_name, last_name, email
FROM users
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com' -- Replace with actual user email
);

-- Step 4: Check user_details table for middle_name
SELECT user_id, first_name, middle_name, last_name, email
FROM user_details
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com' -- Replace with actual user email
);

-- Step 5: If no GritSync email exists, generate it manually
-- DO $$
-- DECLARE
--   v_user_id UUID;
-- BEGIN
--   -- Get user ID
--   SELECT id INTO v_user_id FROM auth.users WHERE email = 'kmcantila@gmail.com';
--   
--   -- Generate email for this user
--   PERFORM create_client_email_address(v_user_id);
--   
--   RAISE NOTICE 'Email generated for user: %', v_user_id;
-- END $$;

