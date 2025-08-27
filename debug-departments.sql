-- Debug why departments aren't showing in public form

-- 1. Check if departments exist
SELECT 'Checking if departments exist...' as step;
SELECT id, name, email FROM departments;

-- 2. Check current RLS policies on departments
SELECT 'Current RLS policies on departments:' as step;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'departments';

-- 3. Check if RLS is enabled
SELECT 'Is RLS enabled on departments?' as step;
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'departments';

-- 4. Test if anon can select departments
SELECT 'Testing anon role access:' as step;
SET ROLE anon;
SELECT COUNT(*) as department_count FROM departments;
RESET ROLE;

-- 5. Fix the issue - disable RLS or create proper policy
-- Option A: Disable RLS entirely (simplest for public data like departments)
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;

-- Option B: If RLS must be enabled, ensure proper policy exists
-- ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Public access to departments" ON departments;
-- CREATE POLICY "Public access to departments" ON departments
--     FOR SELECT
--     USING (true);

-- 6. Grant permissions again to be sure
GRANT SELECT ON departments TO anon;
GRANT SELECT ON departments TO authenticated;

-- 7. Verify the fix
SELECT 'After fix - Testing anon access again:' as step;
SET ROLE anon;
SELECT id, name, email FROM departments;
RESET ROLE;

-- 8. Final check
SELECT 'Final status:' as step;
SELECT 
    'Departments exist: ' || CASE WHEN COUNT(*) > 0 THEN 'YES (' || COUNT(*) || ' departments)' ELSE 'NO' END as status
FROM departments;

SELECT 'RLS Status: ' || CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_class
WHERE relname = 'departments';