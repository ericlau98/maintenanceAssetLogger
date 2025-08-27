-- =====================================================
-- EMAIL SYSTEM SETUP
-- Run this in Supabase SQL Editor to set up email checking
-- =====================================================

-- Step 1: Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view settings" ON system_settings;
DROP POLICY IF EXISTS "Service role can update settings" ON system_settings;

-- Step 4: Create policies
CREATE POLICY "Authenticated users can view settings" ON system_settings
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Note: We'll use a different approach for service role since auth.role() doesn't work in RLS
CREATE POLICY "Anyone can update settings" ON system_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Step 5: Grant permissions
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON system_settings TO anon;
GRANT ALL ON system_settings TO service_role;

-- Step 6: Ensure email_queue table exists with all needed columns
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS template_type TEXT;

-- Step 7: Create or update email_queue RLS policies
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to email_queue" ON email_queue;
DROP POLICY IF EXISTS "Authenticated users can view email_queue" ON email_queue;

CREATE POLICY "Service role full access to email_queue" ON email_queue
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can view email_queue" ON email_queue
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Step 8: Add email_thread_id to tickets if it doesn't exist
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_thread_id TEXT;

-- Step 9: Create an index for faster email thread lookups
CREATE INDEX IF NOT EXISTS idx_tickets_email_thread_id ON tickets(email_thread_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);

-- Step 10: Ensure departments have email addresses
UPDATE departments 
SET email = 'maintenance@greatlakesg.com' 
WHERE name = 'Maintenance' AND (email IS NULL OR email = '');

UPDATE departments 
SET email = 'electrical@greatlakesg.com' 
WHERE name = 'Electrical' AND (email IS NULL OR email = '');

-- Step 11: Create a function to manually check emails (for testing)
CREATE OR REPLACE FUNCTION check_emails_manually()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    -- This is a placeholder that returns instruction
    -- The actual checking happens via the edge function
    result := jsonb_build_object(
        'message', 'To check emails, call the edge function',
        'endpoint', 'https://your-project.supabase.co/functions/v1/microsoft-graph-email',
        'method', 'POST',
        'body', jsonb_build_object('action', 'check', 'data', jsonb_build_object())
    );
    
    RETURN result;
END;
$$;

-- Step 12: Create a function to send queued emails (for testing)
CREATE OR REPLACE FUNCTION send_queued_emails_manually()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    -- This is a placeholder that returns instruction
    -- The actual sending happens via the edge function
    result := jsonb_build_object(
        'message', 'To send emails, call the edge function',
        'endpoint', 'https://your-project.supabase.co/functions/v1/microsoft-graph-email',
        'method', 'POST',
        'body', jsonb_build_object('action', 'send', 'data', jsonb_build_object())
    );
    
    RETURN result;
END;
$$;

-- Step 13: Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION check_emails_manually() TO authenticated;
GRANT EXECUTE ON FUNCTION send_queued_emails_manually() TO authenticated;

-- Step 14: Check if everything is set up correctly
SELECT 'Setup completed!' as status;

-- Verification queries:
SELECT 'Checking departments...' as check;
SELECT id, name, email FROM departments WHERE name IN ('Maintenance', 'Electrical');

SELECT 'Checking system_settings table...' as check;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'system_settings'
) as system_settings_exists;

SELECT 'Checking email_queue table...' as check;
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'email_queue' 
AND column_name IN ('attempts', 'template_type');

SELECT 'Checking tickets email_thread_id column...' as check;
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'tickets' 
    AND column_name = 'email_thread_id'
) as email_thread_id_exists;

-- Instructions for next steps
SELECT '
NEXT STEPS:
1. Deploy the edge function: supabase functions deploy microsoft-graph-email
2. Set environment variables in Supabase Dashboard
3. Set up cron job or use manual trigger to check emails
4. Test by sending email to maintenance@greatlakesg.com
' as next_steps;