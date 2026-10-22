import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { authenticateUser, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const { user, profile, adminClient } = await authenticateUser(req)
    const body = await req.json()
    const { documentId, grantedToEmail, permission, expiresAt } = body

    if (!documentId || !grantedToEmail || !permission) {
      return errorResponse('Missing required fields: documentId, grantedToEmail, permission', 400)
    }

    if (!['read', 'edit'].includes(permission)) {
      return errorResponse("Permission must be either 'read' or 'edit'", 400)
    }

    // 1. Fetch document to verify ownership
    const { data: doc, error: docError } = await adminClient
      .from('documents')
      .select('id, title, owner_id')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return errorResponse('Document not found', 404)
    }

    const isOwner = doc.owner_id === user.id
    const isAdmin = profile.role === 'administrator'

    if (!isOwner && !isAdmin) {
      return errorResponse('Access denied: only document owner or administrator can grant access', 403)
    }

    // 2. Find recipient profile by email (case-insensitive)
    const { data: recipient, error: recipientError } = await adminClient
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', grantedToEmail.trim())
      .single()

    if (recipientError || !recipient) {
      return errorResponse(`No user found with email: ${grantedToEmail}`, 404)
    }

    if (recipient.id === user.id) {
      return errorResponse('Cannot grant access to yourself', 400)
    }

    // 3. Upsert document grant
    const { data: grant, error: grantError } = await adminClient
      .from('document_grants')
      .upsert(
        {
          document_id: documentId,
          granted_to: recipient.id,
          granted_by: user.id,
          permission,
          expires_at: expiresAt ?? null,
        },
        { onConflict: 'document_id,granted_to' }
      )
      .select()
      .single()

    if (grantError) {
      return errorResponse(`Failed to grant access: ${grantError.message}`, 500)
    }

    // 4. Log audit event
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'grant',
      resource_type: 'grant',
      resource_id: grant.id,
      metadata: {
        document_id: documentId,
        document_title: doc.title,
        granted_to: recipient.id,
        granted_to_email: recipient.email,
        permission,
        expires_at: expiresAt ?? null,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })

    return jsonResponse({
      success: true,
      grant,
      recipient: {
        id: recipient.id,
        email: recipient.email,
        full_name: recipient.full_name,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Grant access failed'
    return errorResponse(message, 401)
  }
})
