import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { authenticateUser, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'PATCH') {
    return errorResponse('Method not allowed', 405)
  }

  const url = new URL(req.url)
  const documentId = url.searchParams.get('id')

  if (!documentId) {
    return errorResponse('Missing required query parameter: id', 400)
  }

  try {
    const { user, profile, adminClient } = await authenticateUser(req)
    const body = await req.json()
    const { title, description, tags } = body

    // 1. Fetch document
    const { data: doc, error: docError } = await adminClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return errorResponse('Document not found', 404)
    }

    // 2. Check permission: owner, admin, or active edit grant
    const isOwner = doc.owner_id === user.id
    const isAdmin = profile.role === 'administrator'

    let hasEditGrant = false
    if (!isOwner && !isAdmin) {
      const { data: grant } = await adminClient
        .from('document_grants')
        .select('id, permission, expires_at')
        .eq('document_id', documentId)
        .eq('granted_to', user.id)
        .eq('permission', 'edit')
        .maybeSingle()

      if (grant) {
        hasEditGrant = !grant.expires_at || new Date(grant.expires_at) > new Date()
      }
    }

    if (!isOwner && !isAdmin && !hasEditGrant) {
      return errorResponse('Access denied: you do not have edit permission for this document', 403)
    }

    // 3. Prepare updates
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) {
      const trimmed = title.trim()
      if (trimmed.length < 1 || trimmed.length > 200) {
        return errorResponse('Title must be between 1 and 200 characters', 400)
      }
      updates.title = trimmed
    }

    if (description !== undefined) {
      updates.description = description ? description.trim() : null
    }

    if (tags !== undefined) {
      updates.tags = Array.isArray(tags) ? tags : null
    }

    // 4. Update in database
    const { data: updated, error: updateError } = await adminClient
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single()

    if (updateError) {
      return errorResponse(`Update failed: ${updateError.message}`, 500)
    }

    // 5. Log audit event
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'update',
      resource_type: 'document',
      resource_id: documentId,
      metadata: {
        fields_updated: Object.keys(updates).filter((k) => k !== 'updated_at'),
      },
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })

    return jsonResponse({ success: true, document: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return errorResponse(message, 401)
  }
})
