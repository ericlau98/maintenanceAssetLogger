import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get Microsoft Graph access token
async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get('MICROSOFT_TENANT_ID') ?? ''
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? ''

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  })

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

// Send email using Microsoft Graph
async function sendConfirmationEmail(
  accessToken: string,
  to: string,
  fullName: string,
  confirmationUrl: string
): Promise<boolean> {
  const fromEmail = 'maintenance@greatlakesg.com'
  const sendEndpoint = `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { 
          background: linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%); 
          color: white; 
          padding: 40px 30px; 
          border-radius: 10px 10px 0 0; 
          text-align: center;
        }
        .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
        .content { 
          background: white; 
          padding: 40px 30px; 
          border: 1px solid #e0e0e0; 
          border-radius: 0 0 10px 10px; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .button { 
          display: inline-block; 
          padding: 14px 35px; 
          background: linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%); 
          color: white !important; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 25px 0; 
          font-weight: bold;
          font-size: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .button:hover { 
          background: linear-gradient(135deg, #1B5E20 0%, #4CAF50 100%); 
        }
        .footer { 
          margin-top: 30px; 
          padding-top: 30px; 
          border-top: 1px solid #e0e0e0; 
          color: #666; 
          font-size: 14px; 
        }
        .security-notice {
          background: #FFF3E0;
          border-left: 4px solid #FF9800;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .link-text {
          word-break: break-all;
          color: #2E7D32;
          font-size: 12px;
          background: #f5f5f5;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🌿 Great Lakes Greenhouses</div>
          <p style="margin: 0; opacity: 0.95;">Asset Management System</p>
        </div>
        <div class="content">
          <h2 style="color: #2E7D32; margin-top: 0;">Welcome to Great Lakes Greenhouses!</h2>
          
          <p>Hi ${fullName || 'there'},</p>
          
          <p>Thank you for creating an account with our Asset Management System. You're just one step away from accessing all the tools you need to manage your greenhouse operations efficiently.</p>
          
          <p><strong>Please confirm your email address to activate your account:</strong></p>
          
          <div style="text-align: center;">
            <a href="${confirmationUrl}" class="button">Confirm Email Address</a>
          </div>
          
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <div class="link-text">${confirmationUrl}</div>
          
          <div class="security-notice">
            <strong>🔒 Security Notice:</strong> This confirmation link will expire in 24 hours. If you didn't create an account with us, you can safely ignore this email.
          </div>
          
          <h3 style="color: #2E7D32; margin-top: 30px;">What's Next?</h3>
          <ul style="color: #555;">
            <li>Confirm your email address using the button above</li>
            <li>Sign in with your email and password</li>
            <li>Start managing your assets, inventory, and maintenance logs</li>
            <li>Collaborate with your team through our ticketing system</li>
          </ul>
          
          <div class="footer">
            <p><strong>Need Help?</strong></p>
            <p>If you're having trouble confirming your email or have any questions, please contact our support team at support@greatlakesg.com</p>
            <p style="margin-top: 20px; color: #999;">
              Best regards,<br>
              The Great Lakes Greenhouses Team
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
              This email was sent from maintenance@greatlakesg.com<br>
              Great Lakes Greenhouses • Asset Management System<br>
              © ${new Date().getFullYear()} All rights reserved
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  const emailMessage = {
    message: {
      subject: '🌿 Confirm Your Great Lakes Greenhouses Account',
      body: {
        contentType: 'HTML',
        content: htmlBody
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ],
      from: {
        emailAddress: {
          address: fromEmail,
          name: 'Great Lakes Greenhouses'
        }
      }
    },
    saveToSentItems: false
  }

  try {
    const response = await fetch(sendEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailMessage)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Failed to send email:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get Microsoft Graph access token
    const accessToken = await getAccessToken()

    // Fetch pending emails from queue (now using public schema)
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('signup_email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(10)

    if (fetchError) {
      throw new Error(`Failed to fetch email queue: ${fetchError.message}`)
    }

    const results = []
    
    for (const emailRecord of pendingEmails || []) {
      console.log(`Processing email for ${emailRecord.email}`)
      
      // Construct confirmation URL
      // Since we're not storing the token, we'll need to get it from auth.users
      const { data: userData } = await supabase
        .from('auth.users')
        .select('confirmation_token')
        .eq('id', emailRecord.user_id)
        .single()
      
      const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://www.glgassets.app'
      const confirmationUrl = userData?.confirmation_token 
        ? `${supabaseUrl}/auth/v1/verify?token=${userData.confirmation_token}&type=signup&redirect_to=${baseUrl}/login`
        : `${baseUrl}/login`
      
      const success = await sendConfirmationEmail(
        accessToken,
        emailRecord.email,
        emailRecord.full_name || '',
        confirmationUrl
      )

      if (success) {
        // Mark as sent
        await supabase
          .from('signup_email_queue')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', emailRecord.id)

        results.push({ 
          email: emailRecord.email, 
          status: 'sent' 
        })
      } else {
        // Increment attempts
        await supabase
          .from('signup_email_queue')
          .update({ 
            attempts: emailRecord.attempts + 1,
            status: emailRecord.attempts >= 2 ? 'failed' : 'pending'
          })
          .eq('id', emailRecord.id)

        results.push({ 
          email: emailRecord.email, 
          status: 'failed',
          attempts: emailRecord.attempts + 1
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error processing auth emails:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})