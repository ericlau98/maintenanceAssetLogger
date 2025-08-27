# Public Ticket Submission Setup Guide

## Overview
The public ticket submission page allows external users to create support tickets without needing an account in your asset tracker system. Users authenticate with their Microsoft account to verify their identity before submitting tickets.

## Features
- Microsoft authentication required (prevents spam)
- No asset tracker account needed
- Auto-fills user information from Microsoft account
- Sends confirmation emails
- Creates tickets in the same system as internal users
- Accessible at `/submit-ticket`

## Setup Instructions

### 1. Azure AD App Registration

#### Create App Registration
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure the application:
   - **Name:** Great Lakes Public Ticket Portal
   - **Supported account types:** Choose one:
     - "Accounts in this organizational directory only" (restricts to your organization)
     - "Accounts in any organizational directory" (any work/school account)
     - "Personal Microsoft accounts only" (consumer accounts)
     - "Accounts in any organizational directory and personal accounts" (recommended)
   - **Redirect URI:** 
     - Platform: Single-page application (SPA)
     - URL: `https://yourdomain.com/submit-ticket` (update with your actual domain)
     - For local testing: `http://localhost:5173/submit-ticket`

#### Configure Authentication
1. After creation, go to **Authentication** section
2. Under "Single-page application", ensure your redirect URI is listed
3. Add additional redirect URIs if needed:
   - Production: `https://yourdomain.com/submit-ticket`
   - Staging: `https://staging.yourdomain.com/submit-ticket`
   - Local: `http://localhost:5173/submit-ticket`
4. Under "Implicit grant and hybrid flows":
   - Check ✅ "ID tokens"
   - Check ✅ "Access tokens"
5. Under "Advanced settings":
   - Allow public client flows: **Yes**
6. Click **Save**

#### Get Application Details
1. Go to **Overview** section
2. Copy these values:
   - **Application (client) ID** → `VITE_MICROSOFT_CLIENT_ID`
   - **Directory (tenant) ID** → `VITE_MICROSOFT_TENANT_ID`

### 2. Configure Environment Variables

#### Local Development
Create a `.env` file in your project root:
```env
# Existing Supabase config
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Microsoft Azure AD
VITE_MICROSOFT_CLIENT_ID=your-client-id-from-azure
VITE_MICROSOFT_TENANT_ID=your-tenant-id-from-azure
```

#### Production (Vercel)
Add environment variables in Vercel Dashboard:
1. Go to your project settings
2. Navigate to Environment Variables
3. Add:
   - `VITE_MICROSOFT_CLIENT_ID`
   - `VITE_MICROSOFT_TENANT_ID`
4. Redeploy for changes to take effect

### 3. Database Setup

Run this SQL in Supabase SQL Editor:

```sql
-- Add fields for public ticket tracking
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_via TEXT DEFAULT 'app';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_phone TEXT;

-- Grant necessary permissions for public ticket creation
GRANT INSERT ON tickets TO anon;
GRANT SELECT ON tickets TO anon;
GRANT SELECT ON departments TO anon;
GRANT INSERT ON email_queue TO anon;
```

### 4. Test the Setup

#### Local Testing
1. Start your development server:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:5173/submit-ticket`
3. Click "Sign in with Microsoft"
4. Authenticate with a Microsoft account
5. Submit a test ticket

#### Production Testing
1. Deploy your application
2. Navigate to `https://yourdomain.com/submit-ticket`
3. Test the full flow

## Customization Options

### 1. Restrict to Organization Only
To only allow users from your organization:
```javascript
// In PublicTicket.jsx, modify msalConfig:
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID}`,
    // Remove '/common' to restrict to your tenant
  }
}
```

### 2. Add Additional Fields
To collect more information:
```javascript
// Add to formData state
const [formData, setFormData] = useState({
  // ... existing fields
  location: '',
  equipment_id: '',
  urgency_reason: ''
});
```

### 3. Custom Validation
Add business rules:
```javascript
const validateTicket = () => {
  // Only allow tickets during business hours
  const hour = new Date().getHours();
  if (hour < 8 || hour > 17) {
    setError('Tickets can only be submitted during business hours (8 AM - 5 PM)');
    return false;
  }
  return true;
};
```

### 4. Department-Specific Forms
Show different fields based on department:
```javascript
{formData.department_id === 'maintenance-dept-id' && (
  <div>
    <label>Equipment Serial Number</label>
    <input type="text" />
  </div>
)}
```

## Security Considerations

### Authentication
- Microsoft authentication prevents anonymous submissions
- User identity is verified through Microsoft
- Email addresses are validated by Microsoft

### Rate Limiting
Consider implementing rate limiting to prevent abuse:
```sql
-- Create a function to check submission rate
CREATE OR REPLACE FUNCTION check_ticket_rate_limit(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Allow max 5 tickets per hour per email
  RETURN (
    SELECT COUNT(*) < 5
    FROM tickets
    WHERE requester_email = email
    AND created_at > NOW() - INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql;
```

### Data Privacy
- Only collect necessary information
- Inform users about data collection
- Add privacy policy link to the form

## Monitoring & Analytics

### Track Submission Sources
```sql
-- View tickets by source
SELECT 
  created_via,
  COUNT(*) as ticket_count,
  DATE_TRUNC('day', created_at) as day
FROM tickets
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY created_via, day
ORDER BY day DESC;
```

### Monitor Failed Submissions
Add error logging:
```javascript
} catch (error) {
  console.error('Ticket submission error:', error);
  // Send to error tracking service
  // logError(error, { user: microsoftUser, formData });
}
```

## Troubleshooting

### Common Issues

#### "Invalid redirect URI"
- Ensure the redirect URI in Azure exactly matches your app URL
- Include the full path: `/submit-ticket`
- Check for trailing slashes

#### "Unauthorized client"
- Verify client ID is correct
- Check tenant ID configuration
- Ensure app registration is not disabled

#### "User cannot submit ticket"
- Check Supabase RLS policies
- Verify anon key has INSERT permission on tickets table
- Check browser console for errors

#### "Microsoft sign-in not working"
- Clear browser cache/cookies
- Check browser console for CORS errors
- Verify redirect URIs are configured

### Debug Mode
Enable verbose logging:
```javascript
// Add to PublicTicket.jsx
const DEBUG = import.meta.env.DEV;

if (DEBUG) {
  console.log('MSAL Config:', msalConfig);
  console.log('User:', microsoftUser);
  console.log('Form Data:', formData);
}
```

## Support Link
Add a direct link to the public submission page:
- Internal app: Add button in login page
- Company website: Link to `/submit-ticket`
- Email signatures: Include submission URL

## Next Steps
1. Set up Azure AD app registration
2. Configure environment variables
3. Deploy and test
4. Share link with external users
5. Monitor ticket submissions