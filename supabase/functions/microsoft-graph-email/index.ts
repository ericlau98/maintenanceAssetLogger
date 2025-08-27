import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MicrosoftTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface MicrosoftEmail {
  id: string
  subject: string
  from: {
    emailAddress: {
      address: string
      name?: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      address: string
      name?: string
    }
  }>
  body: {
    content: string
    contentType: 'text' | 'html'
  }
  receivedDateTime: string
  conversationId?: string
  isRead: boolean
}

// Get Microsoft Graph access token using client credentials flow
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

  const data: MicrosoftTokenResponse = await response.json()
  return data.access_token
}

// Send email using Microsoft Graph
async function sendEmail(accessToken: string, from: string, to: string, subject: string, body: string, replyTo?: string) {
  const sendEndpoint = `https://graph.microsoft.com/v1.0/users/${from}/sendMail`
  
  const emailMessage = {
    message: {
      subject: subject,
      body: {
        contentType: 'Text',
        content: body
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ],
      replyTo: replyTo ? [{ emailAddress: { address: replyTo } }] : undefined
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

// Check inbox for new emails
async function checkInbox(accessToken: string, emailAddress: string, since?: string): Promise<MicrosoftEmail[]> {
  // Build filter query
  let filter = `isRead eq false`
  if (since) {
    filter += ` and receivedDateTime ge ${since}`
  }
  
  const messagesEndpoint = `https://graph.microsoft.com/v1.0/users/${emailAddress}/messages?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=receivedDateTime desc`
  
  const response = await fetch(messagesEndpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch emails: ${error}`)
  }

  const data = await response.json()
  return data.value || []
}

// Mark email as read
async function markAsRead(accessToken: string, emailAddress: string, messageId: string) {
  const updateEndpoint = `https://graph.microsoft.com/v1.0/users/${emailAddress}/messages/${messageId}`
  
  const response = await fetch(updateEndpoint, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isRead: true })
  })

  if (!response.ok) {
    console.error(`Failed to mark email as read: ${await response.text()}`)
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, data } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Microsoft Graph access token
    const accessToken = await getAccessToken()

    switch (action) {
      case 'send': {
        // Send emails from the queue
        const { data: emails, error: fetchError } = await supabase
          .from('email_queue')
          .select('*, tickets(ticket_number)')
          .eq('status', 'pending')
          .lt('attempts', 3)
          .limit(10)

        if (fetchError) throw fetchError

        const results = []
        const fromEmail = Deno.env.get('MICROSOFT_FROM_EMAIL') ?? 'noreply@greatlakesg.com'

        for (const email of emails || []) {
          try {
            await sendEmail(
              accessToken,
              fromEmail,
              email.to_email,
              email.subject,
              email.body,
              email.template_type === 'info_requested' ? fromEmail : undefined
            )

            await supabase
              .from('email_queue')
              .update({ 
                status: 'sent', 
                sent_at: new Date().toISOString() 
              })
              .eq('id', email.id)

            results.push({ id: email.id, status: 'sent' })
          } catch (error) {
            await supabase
              .from('email_queue')
              .update({ 
                attempts: (email.attempts || 0) + 1,
                status: email.attempts >= 2 ? 'failed' : 'pending'
              })
              .eq('id', email.id)

            results.push({ id: email.id, status: 'error', error: error.message })
          }
        }

        return new Response(
          JSON.stringify({ message: 'Emails processed', results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'check': {
        // Check for new emails in maintenance and electrical inboxes
        const maintenanceEmail = 'maintenance@greatlakesg.com'
        const electricalEmail = 'electrical@greatlakesg.com'
        
        // Get last check timestamp
        const { data: lastCheck } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'last_email_check')
          .single()
        
        const since = lastCheck?.value || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        
        // Check both inboxes
        const [maintenanceEmails, electricalEmails] = await Promise.all([
          checkInbox(accessToken, maintenanceEmail, since),
          checkInbox(accessToken, electricalEmail, since)
        ])

        const allEmails = [
          ...maintenanceEmails.map(e => ({ ...e, department: 'maintenance' })),
          ...electricalEmails.map(e => ({ ...e, department: 'electrical' }))
        ]

        // Process each email
        for (const email of allEmails) {
          const fromAddress = email.from.emailAddress.address
          const subject = email.subject
          const body = email.body.content
          
          // Check if this is a reply to an existing ticket
          const ticketMatch = subject.match(/#(\d+)/)
          
          if (ticketMatch) {
            // This is a reply to an existing ticket
            const ticketNumber = parseInt(ticketMatch[1])
            
            const { data: ticket } = await supabase
              .from('tickets')
              .select('id, requester_email')
              .eq('ticket_number', ticketNumber)
              .single()

            if (ticket && ticket.requester_email.toLowerCase() === fromAddress.toLowerCase()) {
              // Add comment to ticket
              await supabase
                .from('ticket_comments')
                .insert({
                  ticket_id: ticket.id,
                  comment: `[Email Reply]\n\n${body}`,
                  is_internal: false
                })
              
              // Update ticket status if it was on hold
              await supabase
                .from('tickets')
                .update({ status: 'todo' })
                .eq('id', ticket.id)
                .eq('status', 'on_hold')
            }
          } else {
            // Create new ticket
            const { data: department } = await supabase
              .from('departments')
              .select('id')
              .eq('email', email.department === 'maintenance' ? maintenanceEmail : electricalEmail)
              .single()

            if (department) {
              const { data: newTicket } = await supabase
                .from('tickets')
                .insert({
                  title: subject,
                  description: body,
                  department_id: department.id,
                  requester_email: fromAddress,
                  requester_name: email.from.emailAddress.name || fromAddress.split('@')[0],
                  status: 'todo',
                  priority: 'medium',
                  email_thread_id: email.conversationId
                })
                .select()
                .single()

              if (newTicket) {
                // Queue confirmation email
                await supabase
                  .from('email_queue')
                  .insert({
                    ticket_id: newTicket.id,
                    to_email: fromAddress,
                    subject: `Ticket #${newTicket.ticket_number} Created - ${subject}`,
                    body: `Your ticket has been successfully created and assigned to the ${email.department === 'maintenance' ? 'Maintenance' : 'Electrical'} department. We will review your request and update you on its progress.\n\nYou can reply to this email to add additional information.`,
                    template_type: 'ticket_created'
                  })
              }
            }
          }

          // Mark email as read
          await markAsRead(
            accessToken, 
            email.department === 'maintenance' ? maintenanceEmail : electricalEmail,
            email.id
          )
        }

        // Update last check timestamp
        await supabase
          .from('system_settings')
          .upsert({
            key: 'last_email_check',
            value: new Date().toISOString()
          })

        return new Response(
          JSON.stringify({ 
            message: 'Inbox checked', 
            processed: allEmails.length 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})