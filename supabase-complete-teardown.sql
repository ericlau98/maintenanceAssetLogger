-- =====================================================
-- COMPLETE DATABASE TEARDOWN SCRIPT
-- WARNING: This will DELETE ALL DATA - Make backups first!
-- =====================================================

-- Drop all views first
DROP VIEW IF EXISTS user_permissions CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS is_any_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS can_manage_department(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_departments(UUID) CASCADE;
DROP FUNCTION IF EXISTS log_ticket_change() CASCADE;
DROP FUNCTION IF EXISTS handle_new_comment() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS process_email_queue() CASCADE;
DROP FUNCTION IF EXISTS trigger_email_send() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_emails() CASCADE;
DROP FUNCTION IF EXISTS process_microsoft_emails() CASCADE;
DROP FUNCTION IF EXISTS trigger_email_check() CASCADE;

-- Drop all triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
DROP TRIGGER IF EXISTS update_maintenance_logs_updated_at ON maintenance_logs;
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON ticket_comments;
DROP TRIGGER IF EXISTS ticket_changes_trigger ON tickets;
DROP TRIGGER IF EXISTS new_comment_trigger ON ticket_comments;
DROP TRIGGER IF EXISTS send_email_on_insert ON email_queue;

-- Drop all policies (need to disable RLS first)
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maintenance_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ticket_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_settings DISABLE ROW LEVEL SECURITY;

-- Drop all tables in correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS email_queue CASCADE;
DROP TABLE IF EXISTS ticket_history CASCADE;
DROP TABLE IF EXISTS ticket_attachments CASCADE;
DROP TABLE IF EXISTS ticket_comments CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS maintenance_logs CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Note: We don't drop auth.users as that's managed by Supabase Auth

-- Drop any scheduled jobs if using pg_cron
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname IN (
  'process-email-queue',
  'cleanup-email-queue',
  'process-microsoft-emails',
  'process-emails-business-hours'
);

-- Final confirmation
DO $$
BEGIN
  RAISE NOTICE 'Database teardown complete!';
  RAISE NOTICE 'All tables, functions, triggers, and policies have been removed.';
  RAISE NOTICE 'Auth users remain intact - only profile data was removed.';
END $$;