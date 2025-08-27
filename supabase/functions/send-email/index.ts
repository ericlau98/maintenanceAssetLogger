import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailPayload {
  to: string
  cc?: string[]
  subject: string
  body: string
  ticketNumber?: number
  templateType: 'ticket_created' | 'ticket_updated' | 'comment_added' | 'status_changed' | 'info_requested'
}

const formatEmailBody = (payload: EmailPayload): string => {
  const header = `Ticket #${payload.ticketNumber || 'N/A'}`
  const footer = `\n\n---\nThis is an automated message from Great Lakes Greenhouses Maintenance System.\nTo respond to this ticket, simply reply to this email.`

  switch (payload.templateType) {
    case 'ticket_created':
      return `${header} - Created\n\n${payload.body}${footer}`
    case 'ticket_updated':
      return `${header} - Updated\n\n${payload.body}${footer}`
    case 'comment_added':
      return `${header} - New Comment\n\n${payload.body}${footer}`
    case 'status_changed':
      return `${header} - Status Changed\n\n${payload.body}${footer}`
    case 'info_requested':
      return `${header} - Information Requested\n\n${payload.body}\n\nPlease reply to this email with the requested information.${footer}`
    default:
      return `${header}\n\n${payload.body}${footer}`
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

    // Get pending emails from queue
    const { data: emails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*, tickets(ticket_number)')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .limit(10)

    if (fetchError) throw fetchError

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending emails' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const results = []

    for (const email of emails) {
      try {
        // Here you would integrate with your actual email service
        // For example: SendGrid, Resend, AWS SES, etc.
        
        // For now, we'll use Resend API as an example
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        
        if (RESEND_API_KEY) {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: 'Great Lakes Greenhouses <noreply@greatlakesg.com>',
              to: email.to_email,
              cc: email.cc_emails,
              subject: email.subject,
              text: formatEmailBody({
                ...email,
                ticketNumber: email.tickets?.ticket_number,
              }),
              reply_to: email.template_type === 'info_requested' 
                ? 'tickets@greatlakesg.com' 
                : undefined,
              headers: {
                'X-Ticket-ID': email.ticket_id,
                'X-Email-Thread-ID': email.ticket_id, // For email threading
              }
            }),
          })

          if (emailResponse.ok) {
            // Mark email as sent
            await supabase
              .from('email_queue')
              .update({ 
                status: 'sent', 
                sent_at: new Date().toISOString() 
              })
              .eq('id', email.id)

            results.push({ id: email.id, status: 'sent' })
          } else {
            throw new Error(`Email service error: ${emailResponse.status}`)
          }
        } else {
          // If no email service is configured, just mark as sent for development
          console.log('Email would be sent to:', email.to_email)
          console.log('Subject:', email.subject)
          console.log('Body:', formatEmailBody({
            ...email,
            ticketNumber: email.tickets?.ticket_number,
          }))

          await supabase
            .from('email_queue')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', email.id)

          results.push({ id: email.id, status: 'sent (dev mode)' })
        }
      } catch (error) {
        // Increment attempts counter
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
      JSON.stringify({ 
        message: 'Email processing complete', 
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})