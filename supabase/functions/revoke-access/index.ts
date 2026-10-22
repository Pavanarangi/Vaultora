import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { authenticateUser, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'DELETE') {
    return errorResponse('Method not allowed', 405)
  }

  const url = new URL(req.url)
  const grantId = url.searchParams.get('id')

  if (!grantId) {
    return errorResponse('Missing required query parameter: id', 400)
  }

  try {
    const { user, profile, adminClient } = await authenticateUser(req)

    // 1. Fetch grant and associated document
    const { data: grant, error: grantError } = await adminClient
      .from('document_grants')
      .select('*, document:documents(id, title, owner_id)')
      .eq('id', grantId)
      .single()

    if (grantError || !grant) {
      return errorResponse('Grant not found', 404)
    }

    const docOwnerId = grant.document?.owner_id
    const isOwner = docOwnerId === user.id
    const isAdmin = profile.role === 'administrator'

    if (!isOwner && !isAdmin) {
      return errorResponse('Access denied: only document owner or administrator can revoke access', 403)
    }

    // 2. Delete the grant
    const { error: deleteError } = await adminClient
      .from('document_grants')
      .delete()
      .eq('id', grantId)

    if (deleteError) {
      return errorResponse(`Failed to revoke grant: ${deleteError.message}`, 500)
    }

    // 3. Log audit event
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'revoke',
      resource_type: 'grant',
      resource_id: grantId,
      metadata: {
        document_id: grant.document_id,
        document_title: grant.document?.title,
        revoked_from: grant.granted_to,
        previous_permission: grant.permission,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })

    return jsonResponse({ success: true, message: 'Access revoked successfully' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Revoke access failed'
    return errorResponse(message, 401)
  }
})
