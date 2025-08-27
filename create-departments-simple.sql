-- Simple script to ensure departments exist and are accessible

-- Step 1: Delete existing departments to start fresh (optional)
-- DELETE FROM departments;

-- Step 2: Insert departments
INSERT INTO departments (id, name, email, description, created_at, updated_at) 
VALUES 
  (gen_random_uuid(), 'Maintenance', 'maintenance@greatlakesg.com', 'Handles all maintenance-related requests', NOW(), NOW()),
  (gen_random_uuid(), 'Electrical', 'electrical@greatlakesg.com', 'Handles all electrical-related requests', NOW(), NOW());

-- Step 3: Verify they exist
SELECT * FROM departments;

-- Step 4: Turn off RLS completely
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;

-- Step 5: Make sure everyone can read
GRANT SELECT ON departments TO anon;
GRANT SELECT ON departments TO authenticated;