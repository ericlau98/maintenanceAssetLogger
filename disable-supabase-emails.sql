-- =====================================================
-- DISABLE SUPABASE AUTH EMAILS
-- Run this in Supabase SQL Editor to disable built-in auth emails
-- =====================================================

-- Note: This requires access to auth.config table which may need service role access
-- Alternatively, you can disable emails in Supabase Dashboard:
-- Authentication > Email Templates > Toggle off "Enable email confirmations"

-- For programmatic control, you would typically do this in the Supabase Dashboard:
-- 1. Go to Authentication > Settings
-- 2. Under Email Auth, disable:
--    - "Enable email confirmations" 
--    - "Enable email change confirmations"
-- 3. Save changes

-- If you have access to update auth config via SQL (requires special permissions):
-- UPDATE auth.config 
-- SET 
--   enable_signup = true,
--   enable_email_confirmation = false,
--   enable_email_change_confirmation = false
-- WHERE id = 1;

-- Note: The recommended approach is to use the Supabase Dashboard 
-- as auth.config modifications require elevated privileges

SELECT 'Please disable email confirmations in Supabase Dashboard: Authentication > Settings' as instruction;