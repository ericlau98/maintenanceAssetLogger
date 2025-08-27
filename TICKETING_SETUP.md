# Ticketing System Setup Guide

## Overview
This ticketing system includes:
- Two departments: Maintenance (maintenance@greatlakesg.com) and Electrical (electrical@greatlakesg.com)
- Kanban board interface with drag-and-drop functionality
- Email notifications for ticket updates
- Email-to-ticket creation support
- Comment system with internal notes
- Status tracking (To Do, In Progress, Review, Completed, On Hold)

## Database Setup

1. Run the ticket schema SQL file to create the necessary tables:
```bash
# Run this in your Supabase SQL editor
-- Copy contents from supabase-tickets-schema.sql
```

2. Set up Microsoft Graph email processing:
```bash
# Run this in your Supabase SQL editor
-- Copy contents from supabase-microsoft-setup.sql
```

## Email Configuration - Microsoft Graph API (Recommended)

This setup uses Microsoft Graph API with your existing Microsoft 365 email accounts. **No DNS changes required!**

### Prerequisites
- Microsoft 365 Business/Enterprise account
- Admin access to Azure Active Directory
- Existing email accounts for maintenance@ and electrical@

### Quick Setup Steps

1. **Register App in Azure AD:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to Azure Active Directory → App registrations → New registration
   - Name: "Great Lakes Ticketing System"
   - Register and save the Client ID and Tenant ID
   Client ID: a20eddc1-1d66-4f2a-af79-31ea2e77531e
   Tenant ID: fc8391d4-9bbf-424c-8437-50b1929bcb0c
   Object ID: c1707ceb-bafc-4548-820a-21aeaa1531f2

2. **Configure API Permissions:**
   - Add Microsoft Graph permissions:
     - Mail.Read (Application)
     - Mail.Send (Application)
     - Mail.ReadWrite (Application)
   - Grant admin consent

3. **Create Client Secret:**
   - Go to Certificates & secrets → New client secret
   - Save the secret value immediately

4. **Deploy Edge Function:**
   ```bash
   supabase functions deploy microsoft-graph-email
   ```

5. **Set Environment Variables:**
   ```bash
   supabase secrets set MICROSOFT_TENANT_ID="your-tenant-id"
   supabase secrets set MICROSOFT_CLIENT_ID="your-client-id"
   supabase secrets set MICROSOFT_CLIENT_SECRET="your-client-secret"
   supabase secrets set MICROSOFT_FROM_EMAIL="your-email@domain.com"
   ```

## How Email Processing Works

### Automatic Email Checking (Every 5 minutes)
The system automatically:
1. **Checks** maintenance@ and electrical@ inboxes for new emails
2. **Creates tickets** from new emails or adds comments to existing tickets
3. **Sends notifications** from the email queue
4. **Maintains threading** using ticket numbers in subject lines

### Manual Email Trigger
You can manually check emails:
```sql
-- Run in Supabase SQL editor
SELECT trigger_email_check();
```

Or via HTTP:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/microsoft-graph-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "check"}'
```

## Testing the System

1. **Create a test ticket:**
   - Navigate to the Tickets page
   - Click "New Ticket"
   - Fill in the form and submit

2. **Test drag and drop:**
   - Drag tickets between columns to change their status
   - The system automatically sends email notifications

3. **Test comments:**
   - Click on a ticket to open details
   - Add a comment (mark as internal for internal notes)
   - Non-internal comments trigger email notifications

4. **Test email integration:**
   - Send an email to maintenance@greatlakesg.com or electrical@greatlakesg.com
   - Wait 5 minutes (or trigger manually)
   - Check that a ticket is created
   - Reply to the confirmation email
   - Verify the reply appears as a comment

## Email Templates

The system uses the following email templates:
- `ticket_created` - Sent when a new ticket is created
- `ticket_updated` - Sent when ticket details are updated
- `comment_added` - Sent when a new comment is added
- `status_changed` - Sent when ticket status changes
- `info_requested` - Sent when additional information is requested

## Security Considerations

1. **Row Level Security (RLS):**
   - All tables have RLS enabled
   - Users can only see tickets they have access to
   - Only admins can delete tickets

2. **Email Authentication:**
   - Uses OAuth2 with Microsoft Graph API
   - Application-level permissions (not user delegated)
   - Credentials stored securely in Supabase secrets
   - Email replies verified against original requester

3. **Rate Limiting:**
   - Microsoft Graph: 10,000 requests per 10 minutes
   - Email queue includes retry logic with maximum attempts
   - Failed emails are marked and can be reviewed by admins

## Troubleshooting

### Emails not processing:
1. Check the email_queue table for pending/failed emails
2. Verify Microsoft Graph credentials are correct
3. Check edge function logs: `supabase functions logs microsoft-graph-email`
4. Ensure Graph API permissions are granted with admin consent
5. Check system_settings table for last_email_check timestamp

### Emails not creating tickets:
1. Verify the email accounts exist and are accessible
2. Check that emails are arriving in the inbox
3. Run manual check: `SELECT trigger_email_check();`
4. Review function logs for authentication errors

### Drag and drop not working:
1. Ensure @hello-pangea/dnd is installed: `npm install --legacy-peer-deps`
2. Check browser console for errors
3. Verify user has permission to update ticket status

### Tickets not appearing:
1. Check that departments exist in the database
2. Verify RLS policies are correctly set up
3. Ensure user is authenticated

## Customization

### Adding new departments:
```sql
INSERT INTO departments (name, email, description) VALUES
  ('IT Support', 'it@greatlakesg.com', 'IT and technical support');
```

### Modifying ticket statuses:
Edit the `statusColumns` array in `src/pages/Tickets.jsx`

### Changing email templates:
Modify the email formatting in `microsoft-graph-email/index.ts`

### Adjusting email check frequency:
```sql
-- Change to check every 2 minutes
UPDATE cron.job 
SET schedule = '*/2 * * * *'
WHERE jobname = 'process-microsoft-emails';
```

## Support

For issues or questions about the ticketing system:
1. Check the Supabase logs for errors
2. Review the email_queue table for failed emails
3. Ensure all database migrations have been applied
4. Check Microsoft Graph API status: https://portal.office.com/servicestatus
5. Review Azure AD sign-in logs for authentication issues

## Benefits of Microsoft Graph Approach

✅ **No DNS changes required** - Works with existing email infrastructure  
✅ **No webhooks needed** - Uses secure polling instead  
✅ **Better security** - OAuth2 authentication vs webhook signatures  
✅ **Full control** - Can filter, search, and manage emails programmatically  
✅ **Reliable** - Polling ensures no missed emails  
✅ **Cost-effective** - Free with existing Microsoft 365 licenses