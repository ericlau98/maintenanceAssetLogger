# Simple Webhook Setup for Custom Authentication Emails

This guide walks you through the simplified approach to sending custom confirmation emails from maintenance@greatlakesg.com.

## Prerequisites Checklist

✅ Microsoft Graph API credentials already configured in Supabase secrets
✅ Edge function `process-auth-emails` already deployed
✅ Email templates work with maintenance@greatlakesg.com

## Step 1: Run the Simpler Database Setup

Run this SQL in your Supabase SQL Editor:

```bash
# Run the simpler-auth-email-setup.sql file
```

This creates:
- `public.signup_email_queue` table (visible in webhooks dropdown)
- Trigger on `auth.users` that fires on new signups
- Proper RLS policies and permissions

## Step 2: Verify Table Creation

After running the SQL, verify the setup:

```sql
-- Check if the table exists
SELECT * FROM public.signup_email_queue;

-- Check if trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

## Step 3: Deploy Updated Edge Function

The edge function has been updated to use the new public table:

```bash
supabase functions deploy process-auth-emails
```

## Step 4: Create the Webhook in Supabase Dashboard

1. Go to **Database** → **Webhooks** in your Supabase Dashboard
2. Click **"Create a new hook"**
3. Configure with these exact settings:

### General Settings:
- **Name:** `process-signup-emails`
- **Table:** `signup_email_queue` (should now appear in dropdown!)
- **Events:** ✅ INSERT only

### HTTP Request:
- **Method:** `POST`
- **URL:** 
  ```
  https://[YOUR-PROJECT-REF].supabase.co/functions/v1/process-auth-emails
  ```
  Replace `[YOUR-PROJECT-REF]` with your actual project reference

### Headers:
Click **"Add header"** for each:

| Header | Value |
|--------|-------|
| Authorization | Bearer [YOUR-ANON-KEY] |
| Content-Type | application/json |

Replace `[YOUR-ANON-KEY]` with your Supabase anon key from:
Settings → API → Project API keys → anon public

### Conditions (Optional but Recommended):
- Click **"Add condition"**
- Field: `status`
- Operator: `equals`
- Value: `pending`

4. Click **"Create webhook"**

## Step 5: Test the Setup

### Test 1: Manual Database Insert

Insert a test record directly:

```sql
INSERT INTO public.signup_email_queue (
  user_id, 
  email, 
  full_name, 
  status
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  'Test User',
  'pending'
);
```

Then check:
1. Webhook logs: Database → Webhooks → Click on your webhook → View logs
2. Edge function logs: `supabase functions logs process-auth-emails`

### Test 2: Real Signup

1. Sign up a new user through your app
2. Check the email queue:
   ```sql
   SELECT * FROM public.signup_email_queue 
   ORDER BY created_at DESC;
   ```
3. Check if the email was sent (status should change to 'sent')

## Step 6: Configure Confirmation URL (Important!)

The edge function needs to know where to find confirmation tokens. Since the simplified approach doesn't store tokens directly, we need an alternative approach:

### Option A: Direct Supabase URL (Recommended)
Use Supabase's built-in confirmation URL. The email will contain a link like:
```
https://[YOUR-PROJECT-REF].supabase.co/auth/v1/verify?token=...&type=signup
```

### Option B: Custom Domain Redirect
If you want links to go through your domain first:
1. Set environment variable in Supabase Dashboard → Edge Functions → process-auth-emails:
   ```
   PUBLIC_SITE_URL=https://www.glgassets.app
   ```
2. Create a redirect handler at `/auth/confirm` in your app

## Step 7: Monitor and Troubleshoot

### View Email Queue Status:
```sql
-- Pending emails
SELECT * FROM public.signup_email_queue 
WHERE status = 'pending';

-- Successfully sent emails
SELECT * FROM public.signup_email_queue 
WHERE status = 'sent' 
ORDER BY sent_at DESC;

-- Failed emails
SELECT * FROM public.signup_email_queue 
WHERE status = 'failed' OR attempts >= 3;
```

### Common Issues and Fixes:

**Webhook not firing:**
- Check webhook is enabled in Dashboard
- Verify table name is exactly `signup_email_queue`
- Check webhook logs for errors

**Emails not sending:**
- Check Microsoft Graph credentials are set correctly
- Verify edge function has access to secrets
- Check edge function logs: `supabase functions logs process-auth-emails --tail`

**Wrong confirmation URL:**
- Users can't directly access auth.users table for security
- Consider storing token temporarily or using Supabase's URL directly

### Reset Failed Emails:
```sql
UPDATE public.signup_email_queue 
SET status = 'pending', attempts = 0 
WHERE status = 'failed';
```

## Step 8: Production Checklist

Before going live:

- [ ] Test with real email addresses
- [ ] Verify confirmation links work
- [ ] Check email arrives from maintenance@greatlakesg.com
- [ ] Monitor first few real signups
- [ ] Set up alerting for failed emails

## Alternative: Direct Function Call

If webhooks aren't working, you can call the function directly after signup in your app:

```javascript
// In your signup handler after successful signup
const { data, error } = await supabase.functions.invoke('process-auth-emails', {
  body: {}
});
```

## Support

- Check webhook logs: Database → Webhooks → Your webhook → Logs
- Check function logs: `supabase functions logs process-auth-emails`
- Check email queue: `SELECT * FROM public.signup_email_queue`