-- =====================================================
-- SETUP AUTH HOOKS FOR CUSTOM EMAIL SENDING
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Create a table to track email sending (if not exists)
CREATE TABLE IF NOT EXISTS auth_email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    email_type TEXT NOT NULL, -- 'confirmation', 'reset', 'magic_link'
    confirmation_token TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    attempts INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_auth_email_queue_status ON auth_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_auth_email_queue_user_id ON auth_email_queue(user_id);

-- Step 2: Create a function that runs when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_confirmation_token TEXT;
BEGIN
    -- Extract full name from user metadata
    v_full_name := NEW.raw_user_meta_data->>'full_name';
    
    -- Get the confirmation token (this is stored in the auth.users table)
    v_confirmation_token := NEW.confirmation_token;
    
    -- Insert into our email queue for processing
    INSERT INTO auth_email_queue (
        user_id,
        email,
        full_name,
        email_type,
        confirmation_token,
        status
    ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        'confirmation',
        v_confirmation_token,
        'pending'
    );
    
    -- Log the event for debugging
    RAISE NOTICE 'New user signup: % (%)', NEW.email, NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    WHEN (NEW.email_confirmed_at IS NULL) -- Only for unconfirmed emails
    EXECUTE FUNCTION handle_new_user_signup();

-- Step 4: Create a function to process the email queue (called by webhook)
CREATE OR REPLACE FUNCTION process_auth_email_queue()
RETURNS jsonb AS $$
DECLARE
    v_email_record RECORD;
    v_processed_count INT := 0;
BEGIN
    -- Get all pending emails
    FOR v_email_record IN 
        SELECT * FROM auth_email_queue 
        WHERE status = 'pending' 
        AND attempts < 3
        ORDER BY created_at ASC
        LIMIT 10
    LOOP
        -- Mark as processing (to prevent duplicate sends)
        UPDATE auth_email_queue 
        SET attempts = attempts + 1
        WHERE id = v_email_record.id;
        
        v_processed_count := v_processed_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'processed', v_processed_count,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Grant necessary permissions
GRANT ALL ON auth_email_queue TO authenticated;
GRANT ALL ON auth_email_queue TO service_role;
GRANT EXECUTE ON FUNCTION process_auth_email_queue() TO anon;
GRANT EXECUTE ON FUNCTION process_auth_email_queue() TO authenticated;

-- Step 6: Create RLS policies for the email queue
ALTER TABLE auth_email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything" ON auth_email_queue
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view their own emails" ON auth_email_queue
    FOR SELECT
    USING (auth.uid() = user_id);

-- Verification
SELECT 'Auth hooks setup complete!' as status;

-- Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- View the email queue table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'auth_email_queue'
ORDER BY ordinal_position;