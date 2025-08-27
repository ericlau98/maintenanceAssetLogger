# Email-to-Ticket Setup Guide

## Overview
The email-to-ticket system uses Microsoft Graph API to check department email inboxes and automatically create tickets from incoming emails.

## Prerequisites

### 1. Azure AD App Registration
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory → App registrations
3. Click "New registration"
   - Name: "Asset Tracker Email Integration"
   - Supported account types: "Single tenant"
4. After creation, note the:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. Go to "Certificates & secrets"
   - Create new client secret
   - Note the **Secret Value** (you can't see it again!)
6. Go to "API permissions"
   - Add permission → Microsoft Graph → Application permissions
   - Add these permissions:
     - `Mail.Read` (Read mail in all mailboxes)
     - `Mail.Send` (Send mail as any user)
     - `Mail.ReadWrite` (Read and write mail in all mailboxes)
   - Click "Grant admin consent"

### 2. Supabase Configuration

#### Environment Variables
Add these to your Supabase project settings (Settings → Edge Functions → Secrets):

```bash
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id  
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_FROM_EMAIL=noreply@greatlakesg.com
```

#### Deploy Edge Functions

1. Install Supabase CLI if you haven't:
```bash
brew install supabase/tap/supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
cd /Users/eric/LocalDocuments/Projects/maintenanceAssetLogger/asset-tracker
supabase link --project-ref your-project-ref
```

4. Deploy the email function:
```bash
supabase functions deploy microsoft-graph-email
```

### 3. Create System Settings Table

Run this SQL in Supabase SQL Editor:

```sql
-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read
CREATE POLICY "Authenticated users can view settings" ON system_settings
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Create policy for service role to update
CREATE POLICY "Service role can update settings" ON system_settings
    FOR ALL
    USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON system_settings TO service_role;
```

### 4. Set Up Email Checking

You have three options for checking emails:

#### Option A: Scheduled Function (Recommended)
Create a scheduled job in Supabase Dashboard → SQL Editor:

```sql
-- Create a scheduled job to check emails every 5 minutes
SELECT cron.schedule(
    'check-emails',
    '*/5 * * * *', -- Every 5 minutes
    $$
    SELECT net.http_post(
        'https://your-project.supabase.co/functions/v1/microsoft-graph-email',
        '{"action": "check", "data": {}}'::jsonb,
        headers => jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
        )
    );
    $$
);
```

#### Option B: Manual Trigger
Create a button in your admin panel to manually check emails:

```javascript
const checkEmails = async () => {
  const { data, error } = await supabase.functions.invoke('microsoft-graph-email', {
    body: { action: 'check', data: {} }
  });
  
  if (error) {
    console.error('Error checking emails:', error);
  } else {
    console.log('Emails checked:', data);
  }
};
```

#### Option C: External Cron Service
Use a service like cron-job.org or GitHub Actions to periodically call:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/microsoft-graph-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "check", "data": {}}'
```

### 5. Process Email Queue

Similarly, set up a job to send queued emails:

```sql
-- Create a scheduled job to send emails every 2 minutes
SELECT cron.schedule(
    'send-emails',
    '*/2 * * * *', -- Every 2 minutes
    $$
    SELECT net.http_post(
        'https://your-project.supabase.co/functions/v1/microsoft-graph-email',
        '{"action": "send", "data": {}}'::jsonb,
        headers => jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
        )
    );
    $$
);
```

## Testing

1. **Test Email Checking:**
```bash
# Replace with your project URL and anon key
curl -X POST https://your-project.supabase.co/functions/v1/microsoft-graph-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "check", "data": {}}'
```

2. **Send test email to:**
   - maintenance@greatlakesg.com
   - electrical@greatlakesg.com

3. **Check if ticket was created:**
   - Look in the tickets table in Supabase
   - Check the Tickets page in your app

## Troubleshooting

### Common Issues:

1. **"Failed to get access token"**
   - Check your Azure AD credentials
   - Ensure admin consent is granted for API permissions

2. **"Failed to fetch emails"**
   - Verify the email addresses exist in your Microsoft 365 tenant
   - Check that the app has Mail.Read permission

3. **No tickets created**
   - Check if departments exist in the database with correct email addresses
   - Look for errors in Function Logs (Supabase Dashboard → Functions)

4. **Emails not being marked as read**
   - Ensure Mail.ReadWrite permission is granted
   - Check the user has access to the mailbox

### Debugging:

1. Check Function Logs:
   - Supabase Dashboard → Functions → microsoft-graph-email → Logs

2. Test Microsoft Graph API directly:
```bash
# Get access token
curl -X POST https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=https://graph.microsoft.com/.default" \
  -d "grant_type=client_credentials"

# Use token to check emails
curl -X GET "https://graph.microsoft.com/v1.0/users/maintenance@greatlakesg.com/messages?\$filter=isRead eq false" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Security Notes

- Never commit Azure AD credentials to git
- Use environment variables for all secrets
- Regularly rotate your client secret
- Monitor failed login attempts in Azure AD
- Set up alerts for unusual email activity

## Email Flow

1. **Incoming Email** → maintenance@greatlakesg.com or electrical@greatlakesg.com
2. **Edge Function** checks inbox every 5 minutes
3. **New Email Found:**
   - If subject contains `#[ticket-number]` → Add as comment to existing ticket
   - Otherwise → Create new ticket
4. **Confirmation Email** queued and sent to requester
5. **Email marked as read** in inbox

## Next Steps

After setup:
1. Test with a few emails
2. Monitor for 24 hours
3. Adjust check frequency if needed
4. Set up monitoring/alerts
5. Document any custom business rules