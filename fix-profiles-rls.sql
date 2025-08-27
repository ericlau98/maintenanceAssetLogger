-- Fix RLS policies for profiles table to allow user creation
-- This will enable admins to create new user profiles

-- First, check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

-- Create new INSERT policy that allows:
-- 1. Users to create their own profile (during signup)
-- 2. Admins to create profiles for other users
CREATE POLICY "Users and admins can create profiles" ON profiles
    FOR INSERT
    WITH CHECK (
        -- Allow users to create their own profile
        auth.uid() = id
        OR
        -- Allow global admins to create any profile
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'global_admin'
        )
        OR
        -- Allow department admins to create profiles in their department
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'maintenance_admin' OR p.role = 'electrical_admin')
            AND (
                -- Creating profile without department (will be assigned later)
                department_id IS NULL
                OR
                -- Creating profile in their own department
                department_id = p.department_id
            )
        )
    );

-- Update the UPDATE policy to allow admins to update profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

CREATE POLICY "Users and admins can update profiles" ON profiles
    FOR UPDATE
    USING (
        -- Users can see the profile they want to update
        auth.uid() = id
        OR
        -- Global admins can update any profile
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'global_admin'
        )
        OR
        -- Department admins can update profiles in their department
        EXISTS (
            SELECT 1 FROM profiles admin
            WHERE admin.id = auth.uid()
            AND (admin.role = 'maintenance_admin' OR admin.role = 'electrical_admin')
            AND department_id = admin.department_id
        )
    )
    WITH CHECK (
        -- Same rules for what they can update to
        auth.uid() = id
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'global_admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles admin
            WHERE admin.id = auth.uid()
            AND (admin.role = 'maintenance_admin' OR admin.role = 'electrical_admin')
            AND department_id = admin.department_id
        )
    );

-- Update DELETE policy
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Admins can delete profiles" ON profiles
    FOR DELETE
    USING (
        -- Global admins can delete any profile
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'global_admin'
        )
        OR
        -- Department admins can delete user profiles in their department
        EXISTS (
            SELECT 1 FROM profiles admin
            WHERE admin.id = auth.uid()
            AND (admin.role = 'maintenance_admin' OR admin.role = 'electrical_admin')
            AND department_id = admin.department_id
            AND role = 'user' -- Can only delete regular users, not other admins
        )
    );

-- Ensure SELECT policy allows everyone to see profiles (needed for the INSERT check)
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

CREATE POLICY "Authenticated users can view profiles" ON profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO anon; -- Needed for signup process

-- List all policies after changes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;