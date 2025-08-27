-- Check if your auth.users ID matches your profiles ID
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    p.id as profile_id,
    p.email as profile_email,
    p.role,
    p.department_id
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = 'elau@greatlakesg.com';

-- Check all profiles to see their roles
SELECT email, role, created_at, updated_at 
FROM profiles 
ORDER BY created_at DESC;

-- Make absolutely sure the role is set correctly
UPDATE profiles 
SET role = 'global_admin',
    updated_at = NOW()
WHERE email = 'elau@greatlakesg.com'
RETURNING *;