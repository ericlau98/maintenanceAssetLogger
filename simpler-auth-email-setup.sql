-- =====================================================
-- SIMPLER APPROACH: Hook into auth.users table directly
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Create a simpler email queue in public schema
CREATE TABLE IF NOT EXISTS public.signup_email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    status TEXT DEFAULT 'pending',
    attempts INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_signup_email_status ON public.signup_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_signup_email_user ON public.signup_email_queue(user_id);

-- Step 2: Create a function that captures new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into email queue when a new user signs up
    INSERT INTO public.signup_email_queue (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Grant permissions
GRANT ALL ON public.signup_email_queue TO service_role;
GRANT SELECT, INSERT ON public.signup_email_queue TO authenticated;
GRANT SELECT ON public.signup_email_queue TO anon;

-- Step 5: Enable RLS
ALTER TABLE public.signup_email_queue ENABLE ROW LEVEL SECURITY;

-- Create policy for service role
CREATE POLICY "Service role has full access" ON public.signup_email_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policy for users to see their own emails
CREATE POLICY "Users can see their own emails" ON public.signup_email_queue
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Step 6: Test the setup
SELECT 'Setup complete!' as status;

-- Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'signup_email_queue'
) as table_exists;

-- Check if trigger exists
SELECT EXISTS (
    SELECT FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created'
) as trigger_exists;