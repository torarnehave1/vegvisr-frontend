-- Delete test user post@universi.no from config table
-- This will allow re-registration testing

-- First, let's see what we're about to delete
SELECT 
  user_id,
  email,
  role,
  emailVerificationToken,
  json_extract(data, '$.subscriptions') as subscriptions
FROM config 
WHERE email = 'post@universi.no';

-- Now delete the user
DELETE FROM config WHERE email = 'post@universi.no';

-- Verify deletion
SELECT COUNT(*) as remaining_records 
FROM config 
WHERE email = 'post@universi.no';

-- Show message
SELECT 'User post@universi.no has been deleted. You can now test re-registration.' as status;
