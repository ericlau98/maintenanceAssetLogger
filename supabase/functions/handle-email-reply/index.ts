import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResendWebhookPayload {
  type: string
  data: {
    from: string
    to: string[]
    subject: string
    text?: string
    html?: string
    headers?: {
      'message-id'?: string
      'in-reply-to'?: string
      references?: string
    }
    envelope?: {
      from: string
      to: string[]
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

    // Parse incoming Resend webhook
    const webhook: ResendWebhookPayload = await req.json()
    
    // Verify webhook is for email.received event
    if (webhook.type !== 'email.received') {
      return new Response(
        JSON.stringify({ message: 'Webhook type not supported' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const emailData = webhook.data
    const fromEmail = emailData.from
    const toEmail = emailData.to[0] // Primary recipient
    const subject = emailData.subject
    const textContent = emailData.text || ''

    // Extract ticket number from subject or headers
    let ticketNumber: number | null = null
    let ticketId: string | null = null

    // Try to extract ticket number from subject line
    const ticketMatch = subject.match(/#(\d+)/)
    if (ticketMatch) {
      ticketNumber = parseInt(ticketMatch[1])
    }

    // If we have a ticket number, find the ticket
    if (ticketNumber && !ticketId) {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('id, requester_email')
        .eq('ticket_number', ticketNumber)
        .single()

      if (!error && ticket) {
        ticketId = ticket.id

        // Verify sender is the requester
        if (ticket.requester_email.toLowerCase() !== fromEmail.toLowerCase()) {
          return new Response(
            JSON.stringify({ 
              error: 'Sender email does not match ticket requester' 
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403,
            }
          )
        }
      }
    }

    if (!ticketId) {
      // Check if this is a new ticket creation via department email
      const recipientEmail = toEmail.toLowerCase()
      let departmentId: string | null = null

      if (recipientEmail === 'maintenance@greatlakesg.com') {
        const { data: dept } = await supabase
          .from('departments')
          .select('id')
          .eq('email', 'maintenance@greatlakesg.com')
          .single()
        departmentId = dept?.id || null
      } else if (recipientEmail === 'electrical@greatlakesg.com') {
        const { data: dept } = await supabase
          .from('departments')
          .select('id')
          .eq('email', 'electrical@greatlakesg.com')
          .single()
        departmentId = dept?.id || null
      }

      if (departmentId) {
        // Create new ticket
        const { data: newTicket, error: createError } = await supabase
          .from('tickets')
          .insert({
            title: subject.replace(/^(Re:|Fwd:)\s*/gi, '').trim(),
            description: textContent || 'No description provided',
            department_id: departmentId,
            requester_email: fromEmail,
            requester_name: fromEmail.split('@')[0], // Extract name from email
            status: 'todo',
            priority: 'medium'
          })
          .select()
          .single()

        if (createError) throw createError

        // Send confirmation email
        await supabase
          .from('email_queue')
          .insert({
            ticket_id: newTicket.id,
            to_email: fromEmail,
            subject: `Ticket #${newTicket.ticket_number} Created - ${newTicket.title}`,
            body: `Your ticket has been successfully created and assigned to the ${recipientEmail.includes('maintenance') ? 'Maintenance' : 'Electrical'} department. We will review your request and update you on its progress.`,
            template_type: 'ticket_created'
          })

        return new Response(
          JSON.stringify({ 
            message: 'New ticket created',
            ticketId: newTicket.id,
            ticketNumber: newTicket.ticket_number
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      return new Response(
        JSON.stringify({ 
          error: 'Could not identify ticket or department from email' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Add reply as a comment to the existing ticket
    const { data: comment, error: commentError } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        comment: `[Email Reply from ${fromEmail}]\n\n${textContent || 'No content'}`,
        is_internal: false
      })
      .select()
      .single()

    if (commentError) throw commentError

    // Update ticket status if it was waiting for info
    const { data: ticket } = await supabase
      .from('tickets')
      .select('status')
      .eq('id', ticketId)
      .single()

    if (ticket?.status === 'on_hold') {
      await supabase
        .from('tickets')
        .update({ status: 'todo' })
        .eq('id', ticketId)
    }

    // Notify assigned user about the reply
    const { data: ticketDetails } = await supabase
      .from('tickets')
      .select('ticket_number, title, assigned_to, assignee:profiles!tickets_assigned_to_fkey(email)')
      .eq('id', ticketId)
      .single()

    if (ticketDetails?.assigned_to && ticketDetails.assignee?.email) {
      await supabase
        .from('email_queue')
        .insert({
          ticket_id: ticketId,
          to_email: ticketDetails.assignee.email,
          subject: `Reply to Ticket #${ticketDetails.ticket_number} - ${ticketDetails.title}`,
          body: `The requester has replied to the ticket:\n\n${textContent || 'No content'}`,
          template_type: 'comment_added'
        })
    }

    return new Response(
      JSON.stringify({ 
        message: 'Email reply processed successfully',
        commentId: comment.id
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