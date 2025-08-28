# Setting Up Supabase Webhooks for Custom Auth Emails

This guide walks you through setting up database webhooks to send custom confirmation emails from maintenance@greatlakesg.com when users sign up.

## Architecture Overview

```
User Signs Up → Supabase Auth → Database Trigger → Email Queue → Webhook → Edge Function → Microsoft Graph → User Receives Email
```

## Prerequisites

1. ✅ Microsoft Graph API credentials configured
2. ✅ Edge functions deployed
3. ✅ Database trigger created (via SQL script)

## Step 1: Run Database Setup

First, run the setup script in Supabase SQL Editor:

```sql
-- Run the contents of setup-auth-hooks.sql
```

This creates:
- `auth_email_queue` table to track emails
- Database trigger that fires on new signups
- Functions to process the queue

## Step 2: Deploy Edge Function

Deploy the email processing function:

```bash
supabase functions deploy process-auth-emails
```

## Step 3: Create Database Webhook

### Option A: Using Supabase Dashboard (Recommended)

1. Go to **Database** → **Webhooks** in your Supabase Dashboard
2. Click **"Create a new hook"**
3. Configure the webhook:

   **General Settings:**
   - **Name:** `process-signup-emails`
   - **Table:** `auth_email_queue`
   - **Events:** Check only `INSERT`
   
   **HTTP Request:**
   - **Method:** `POST`
   - **URL:** `https://YOUR-PROJECT-REF.supabase.co/functions/v1/process-auth-emails`
   - **Headers:**
     ```
     Authorization: Bearer YOUR-ANON-KEY
     Content-Type: application/json
     ```
   
   **Conditions (optional):**
   - Add condition: `status = 'pending'`
   - This ensures webhook only fires for new pending emails

4. Click **"Create webhook"**

### Option B: Using SQL (Alternative)

```sql
-- Create webhook via SQL (requires pg_net extension)
SELECT
  net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/process-auth-emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR-ANON-KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'auth_email_queue',
      'record', NEW
    )
  )
FROM auth_email_queue
WHERE status = 'pending';
```

## Step 4: Set Up Scheduled Processing (Backup)

As a backup to webhooks, set up scheduled processing:

### Using Supabase Cron Jobs:

```sql
-- Create a cron job to process emails every 5 minutes
SELECT cron.schedule(
  'process-auth-emails',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    'https://YOUR-PROJECT-REF.supabase.co/functions/v1/process-auth-emails',
    '{}',
    headers => jsonb_build_object(
      'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

## Step 5: Configure Email Template Override

In Supabase Dashboard → **Authentication** → **Email Templates**:

1. Click on **"Confirm signup"** template
2. Change the template to a simple message:
   ```
   Please check your email for confirmation.
   ```
3. Keep "Enable email confirmations" **ON**
4. Save changes

This ensures:
- Users still need to confirm emails
- Supabase handles the verification logic
- Users receive YOUR custom branded email

## Testing the Setup

### Test New Signup:

1. **Register a new account** on your app
2. **Check the email queue**:
   ```sql
   SELECT * FROM auth_email_queue 
   ORDER BY created_at DESC;
   ```
3. **Check webhook logs** in Supabase Dashboard → Logs → Webhooks
4. **Check edge function logs**:
   ```bash
   supabase functions logs process-auth-emails
   ```
5. **Verify email received** from maintenance@greatlakesg.com

### Manual Testing:

Test the edge function directly:

```bash
curl -X POST https://YOUR-PROJECT-REF.supabase.co/functions/v1/process-auth-emails \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Monitoring

### Check Email Queue Status:

```sql
-- View pending emails
SELECT * FROM auth_email_queue WHERE status = 'pending';

-- View sent emails today
SELECT * FROM auth_email_queue 
WHERE status = 'sent' 
AND sent_at > NOW() - INTERVAL '1 day';

-- View failed emails
SELECT * FROM auth_email_queue 
WHERE status = 'failed' OR attempts >= 3;
```

### Retry Failed Emails:

```sql
-- Reset failed emails to retry
UPDATE auth_email_queue 
SET status = 'pending', attempts = 0 
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 day';
```

## Troubleshooting

### Emails Not Being Queued

1. Check if trigger exists:
   ```sql
   SELECT trigger_name FROM information_schema.triggers 
   WHERE trigger_name = 'on_auth_user_created';
   ```

2. Check auth.users table for new signups:
   ```sql
   SELECT id, email, created_at, email_confirmed_at 
   FROM auth.users 
   ORDER BY created_at DESC LIMIT 5;
   ```

### Webhook Not Firing

1. Check webhook configuration in Dashboard
2. Verify webhook URL is correct
3. Check webhook logs in Dashboard → Logs → Webhooks
4. Test webhook manually with curl

### Emails Not Sending

1. Check Microsoft Graph credentials:
   ```bash
   supabase secrets list
   ```

2. Check edge function logs for errors:
   ```bash
   supabase functions logs process-auth-emails --tail
   ```

3. Verify Microsoft Graph permissions (Mail.Send)

### Wrong Confirmation URL

If confirmation links don't work:
1. Check `SUPABASE_URL` environment variable
2. Verify redirect URL in email template
3. Test confirmation token format

## Security Considerations

- ✅ Webhook uses authentication (anon key)
- ✅ Email queue has RLS policies
- ✅ Confirmation tokens remain secure (handled by Supabase)
- ✅ No sensitive data in webhooks
- ✅ Rate limiting via attempts counter

## Benefits of This Approach

1. **Branded Emails** - All emails from maintenance@greatlakesg.com
2. **Reliability** - Webhook fires immediately on signup
3. **Fallback** - Cron job ensures emails are sent even if webhook fails
4. **Monitoring** - Full visibility into email status
5. **Security** - Supabase still handles email verification
6. **Flexibility** - Easy to customize email templates

## Next Steps

1. ✅ Run setup-auth-hooks.sql
2. ✅ Deploy process-auth-emails function
3. ✅ Create webhook in Dashboard
4. ✅ Test with new signup
5. ✅ Monitor email queue