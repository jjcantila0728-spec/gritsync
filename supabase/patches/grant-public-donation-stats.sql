-- Grant anonymous users access to donation statistics function
-- This allows the public donation page to display total raised and donation count

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION get_donation_statistics() TO anon;

-- Verify the grant
-- You can test with:
-- SELECT * FROM get_donation_statistics();

