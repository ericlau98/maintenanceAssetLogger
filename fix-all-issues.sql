-- =====================================================
-- COMPREHENSIVE FIX SCRIPT
-- This will fix profile issues and RLS policies
-- =====================================================

-- Step 1: Check if auth user exists
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'elau@greatlakesg.com';

-- Step 2: Ensure departments exist
INSERT INTO departments (name, email, description) 
VALUES 
  ('Maintenance', 'maintenance@greatlakesg.com', 'Handles all maintenance-related requests'),
  ('Electrical', 'electrical@greatlakesg.com', 'Handles all electrical-related requests')
ON CONFLICT (name) DO NOTHING;

-- Step 3: Create or fix the profile
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'elau@greatlakesg.com'
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found in auth.users!';
    ELSE
        -- Delete any existing profile (to start fresh)
        DELETE FROM profiles WHERE id = v_user_id OR email = 'elau@greatlakesg.com';
        
        -- Create new profile with global_admin role
        INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
        VALUES (
            v_user_id, 
            'elau@greatlakesg.com', 
            'Eric Lau', 
            'global_admin',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Profile created/updated successfully with ID: %', v_user_id;
    END IF;
END $$;

-- Step 4: Verify the profile exists
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.department_id,
    d.name as department_name
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.id
WHERE p.email = 'elau@greatlakesg.com';

-- Step 5: Check and fix RLS policies for profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy and recreate
DROP POLICY IF EXISTS "Users can view profiles based on department" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Create a simple policy that allows authenticated users to see profiles
CREATE POLICY "Authenticated users can view profiles" ON profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Step 6: Fix maintenance_logs table and policies
-- Check if the table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'maintenance_logs'
);

-- If it exists, fix its RLS policies
ALTER TABLE maintenance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can view logs" ON maintenance_logs;
CREATE POLICY "All authenticated users can view logs" ON maintenance_logs
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "All authenticated users can insert logs" ON maintenance_logs;
CREATE POLICY "All authenticated users can insert logs" ON maintenance_logs
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Step 7: Fix other table policies that might be causing issues
-- Assets
ALTER TABLE assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can view assets" ON assets;
CREATE POLICY "All authenticated users can view assets" ON assets
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Inventory
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated users can view inventory" ON inventory;
CREATE POLICY "All authenticated users can view inventory" ON inventory
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Step 8: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Step 9: Final verification
SELECT 
    'Your profile:' as info,
    p.email,
    p.role,
    CASE 
        WHEN p.role = 'global_admin' THEN 'You should see the Users menu'
        ELSE 'You will NOT see the Users menu'
    END as status
FROM profiles p
WHERE p.email = 'elau@greatlakesg.com';

-- Check what tables exist
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity::text = 'true' THEN 'RLS Enabled'
        ELSE 'RLS Disabled'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;