-- First, get your auth user ID
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'elau@greatlakesg.com';

-- Check if a profile exists for this user
SELECT * 
FROM profiles 
WHERE email = 'elau@greatlakesg.com';

-- If the above returns nothing, we need to create the profile
-- First get the auth.users ID (replace with the actual ID from the first query)
DO $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = 'elau@greatlakesg.com';
    
    -- Check if profile exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
        -- Create the profile
        INSERT INTO profiles (id, email, full_name, role)
        VALUES (user_id, 'elau@greatlakesg.com', 'Eric Lau', 'global_admin');
        
        RAISE NOTICE 'Profile created successfully';
    ELSE
        -- Update existing profile to ensure it has global_admin role
        UPDATE profiles 
        SET role = 'global_admin',
            updated_at = NOW()
        WHERE id = user_id;
        
        RAISE NOTICE 'Profile updated successfully';
    END IF;
END $$;

-- Verify the profile now exists with correct role
SELECT p.*, d.name as department_name
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.id
WHERE p.email = 'elau@greatlakesg.com';

-- Check RLS policies aren't blocking the read
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles' 
AND cmd = 'SELECT';