-- =====================================================
-- COMPLETE DATABASE SETUP FOR ASSET TRACKER
-- Run this file in Supabase SQL Editor to set up the entire database
-- =====================================================

-- For a complete teardown first, use: supabase-complete-teardown.sql
-- For the full setup with all features, use: supabase-complete-setup.sql

-- =====================================================
-- QUICK FIXES FOR COMMON ISSUES
-- =====================================================

-- Fix 1: Departments not showing in public ticket form
-- -----------------------------------------------------
-- Ensure departments exist
INSERT INTO departments (name, email, description) 
VALUES 
  ('Maintenance', 'maintenance@greatlakesg.com', 'Handles all maintenance-related requests'),
  ('Electrical', 'electrical@greatlakesg.com', 'Handles all electrical-related requests')
ON CONFLICT (name) DO UPDATE SET
  email = EXCLUDED.email,
  description = EXCLUDED.description;

-- Disable RLS on departments (it's public data)
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;

-- Grant read access to everyone
GRANT SELECT ON departments TO anon;
GRANT SELECT ON departments TO authenticated;

-- Fix 2: Public ticket submission permissions
-- -----------------------------------------------------
-- Allow anon users to create tickets and queue emails
GRANT INSERT ON tickets TO anon;
GRANT SELECT ON tickets TO anon;
GRANT INSERT ON email_queue TO anon;

-- Add public ticket tracking fields if missing
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_via TEXT DEFAULT 'app';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_phone TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_thread_id TEXT;

-- Fix 3: Email system setup
-- -----------------------------------------------------
-- Create system_settings table for email tracking
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions for system_settings
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON system_settings TO service_role;

-- Add email queue status tracking
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS template_type TEXT;

-- Fix 4: Profile permissions for user management
-- -----------------------------------------------------
-- Allow authenticated users to view profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
CREATE POLICY "Authenticated users can view profiles" ON profiles
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Allow users to create their own profile during signup
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check departments
SELECT 'Departments:' as check, COUNT(*) as count FROM departments;
SELECT id, name, email FROM departments;

-- Check if anon can access departments
SET ROLE anon;
SELECT 'Anon can see departments:' as check, COUNT(*) as count FROM departments;
RESET ROLE;

-- Check profiles and roles
SELECT 'User roles:' as check;
SELECT email, role, department_id FROM profiles ORDER BY created_at DESC LIMIT 10;

-- Check system tables
SELECT 'System tables exist:' as check;
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tickets', 'ticket_comments', 'email_queue', 'system_settings', 'departments', 'profiles')
ORDER BY tablename;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Run supabase-complete-setup.sql for initial setup
-- 2. Run this file for quick fixes to common issues
-- 3. Email functions require Edge Function deployment
-- 4. Microsoft Graph API credentials must be set in environment variables
-- =====================================================