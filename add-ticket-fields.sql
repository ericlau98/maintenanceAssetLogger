-- Add new fields to tickets table for public submission tracking
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_via TEXT DEFAULT 'app';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_phone TEXT;

-- Add comment to explain created_via values
COMMENT ON COLUMN tickets.created_via IS 'Source of ticket creation: app (internal), email (email integration), public_form (public submission page)';
COMMENT ON COLUMN tickets.requester_phone IS 'Optional phone number for contact, mainly used for public submissions';

-- Update RLS policies to allow public ticket creation
-- We need to allow unauthenticated users to create tickets (through the edge function)
DROP POLICY IF EXISTS "Public can create tickets" ON tickets;

-- Since public users aren't authenticated, we'll handle this via service role in the app
-- The public form will use Supabase client with anon key which has limited permissions

-- Grant INSERT permission to anon role for tickets (controlled by application logic)
GRANT INSERT ON tickets TO anon;
GRANT SELECT ON tickets TO anon; -- Allow reading their own ticket after creation
GRANT SELECT ON departments TO anon; -- Allow seeing department list

-- Also ensure email_queue can be inserted by anon (for confirmation emails)
GRANT INSERT ON email_queue TO anon;

SELECT 'Public ticket fields added successfully!' as status;