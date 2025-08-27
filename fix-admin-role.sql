-- Check current user roles
SELECT email, role, department_id 
FROM profiles 
ORDER BY created_at;

-- Update your account to global_admin
UPDATE profiles 
SET role = 'global_admin' 
WHERE email = 'elau@greatlakesg.com';

-- Verify the update
SELECT email, role, department_id 
FROM profiles 
WHERE email = 'elau@greatlakesg.com';

-- Check if the role constraint exists and what values are allowed
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
AND contype = 'c';

-- If you see any other admin emails that need updating, use this format:
-- UPDATE profiles SET role = 'global_admin' WHERE email = 'another-admin@greatlakesg.com';

-- To assign department admins:
-- UPDATE profiles 
-- SET role = 'maintenance_admin', 
--     department_id = (SELECT id FROM departments WHERE name = 'Maintenance')
-- WHERE email = 'maintenance-admin@greatlakesg.com';

-- UPDATE profiles 
-- SET role = 'electrical_admin',
--     department_id = (SELECT id FROM departments WHERE name = 'Electrical')
-- WHERE email = 'electrical-admin@greatlakesg.com';