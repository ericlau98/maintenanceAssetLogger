-- Quick fix for departments not showing
-- Run this entire script in Supabase SQL Editor

-- 1. First, make sure departments exist
INSERT INTO departments (name, email, description) 
VALUES 
  ('Maintenance', 'maintenance@greatlakesg.com', 'Handles all maintenance-related requests'),
  ('Electrical', 'electrical@greatlakesg.com', 'Handles all electrical-related requests')
ON CONFLICT (name) DO UPDATE SET
  email = EXCLUDED.email,
  description = EXCLUDED.description;

-- 2. Check what we have
SELECT 'Departments in database:' as info;
SELECT id, name, email FROM departments;

-- 3. Completely disable RLS on departments (it's public data anyway)
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;

-- 4. Grant full read access to everyone
GRANT SELECT ON departments TO anon;
GRANT SELECT ON departments TO authenticated;
GRANT SELECT ON departments TO public;

-- 5. Test that anon can now read
SET ROLE anon;
SELECT 'Testing as anon role - departments visible:' as test;
SELECT id, name, email FROM departments;
RESET ROLE;

-- 6. Final confirmation
SELECT 'Final check - Department count:' as status, COUNT(*) as count FROM departments;