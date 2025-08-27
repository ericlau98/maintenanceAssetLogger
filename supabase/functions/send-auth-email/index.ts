import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  type: 'signup' | 'reset' | 'magic_link'
  email: string
  token?: string
  data?: {
    full_name?: string
    confirmation_url?: string
  }
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
async function sendEmail(
  accessToken: string, 
  to: string, 
  subject: string, 
  htmlBody: string,
  textBody: string
) {
  const fromEmail = 'maintenance@greatlakesg.com' // Always send from maintenance
  const sendEndpoint = `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`
  
  const emailMessage = {
    message: {
      subject: subject,
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
      },
      replyTo: [
        {
          emailAddress: {
            address: 'noreply@greatlakesg.com',
            name: 'Great Lakes Greenhouses (No Reply)'
          }
        }
      ]
    }
  }

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
    throw new Error(`Failed to send email: ${error}`)
  }

  return true
}

// Generate email templates
function getEmailTemplate(type: string, data: any): { subject: string; html: string; text: string } {
  const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://www.glgassets.app'
  
  switch (type) {
    case 'signup':
      return {
        subject: 'Confirm your Great Lakes Greenhouses account',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Great Lakes Greenhouses!</h1>
              </div>
              <div class="content">
                <p>Hi ${data.full_name || 'there'},</p>
                <p>Thank you for creating an account with Great Lakes Greenhouses Asset Management System.</p>
                <p>Please confirm your email address by clicking the button below:</p>
                <a href="${data.confirmation_url}" class="button">Confirm Email Address</a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #667eea;">${data.confirmation_url}</p>
                <p>This link will expire in 24 hours.</p>
                <div class="footer">
                  <p>If you didn't create an account, you can safely ignore this email.</p>
                  <p>Best regards,<br>Great Lakes Greenhouses Team</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Welcome to Great Lakes Greenhouses!
          
          Hi ${data.full_name || 'there'},
          
          Thank you for creating an account with Great Lakes Greenhouses Asset Management System.
          
          Please confirm your email address by visiting this link:
          ${data.confirmation_url}
          
          This link will expire in 24 hours.
          
          If you didn't create an account, you can safely ignore this email.
          
          Best regards,
          Great Lakes Greenhouses Team
        `
      }

    case 'reset':
      return {
        subject: 'Reset your Great Lakes Greenhouses password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hi,</p>
                <p>We received a request to reset your password for your Great Lakes Greenhouses account.</p>
                <p>Click the button below to reset your password:</p>
                <a href="${data.confirmation_url}" class="button">Reset Password</a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #667eea;">${data.confirmation_url}</p>
                <p>This link will expire in 1 hour.</p>
                <div class="footer">
                  <p>If you didn't request a password reset, you can safely ignore this email.</p>
                  <p>Best regards,<br>Great Lakes Greenhouses Team</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Password Reset Request
          
          Hi,
          
          We received a request to reset your password for your Great Lakes Greenhouses account.
          
          Reset your password by visiting this link:
          ${data.confirmation_url}
          
          This link will expire in 1 hour.
          
          If you didn't request a password reset, you can safely ignore this email.
          
          Best regards,
          Great Lakes Greenhouses Team
        `
      }

    default:
      return {
        subject: 'Great Lakes Greenhouses Account Notification',
        html: `<p>Account notification from Great Lakes Greenhouses</p>`,
        text: 'Account notification from Great Lakes Greenhouses'
      }
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { type, email, token, data } = await req.json() as EmailRequest

    // Get Microsoft Graph access token
    const accessToken = await getAccessToken()

    // Generate email content
    const emailContent = getEmailTemplate(type, data || {})

    // Send email
    await sendEmail(
      accessToken,
      email,
      emailContent.subject,
      emailContent.html,
      emailContent.text
    )

    // Log email send for tracking
    await supabase
      .from('email_queue')
      .insert({
        to_email: email,
        subject: emailContent.subject,
        body: emailContent.text,
        status: 'sent',
        sent_at: new Date().toISOString(),
        template_type: `auth_${type}`
      })

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error sending auth email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})