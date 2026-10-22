import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { authenticateUser, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405)
  }

  const url = new URL(req.url)
  const documentId = url.searchParams.get('id')

  if (!documentId) {
    return errorResponse('Missing required query parameter: id', 400)
  }

  try {
    const { user, profile, adminClient } = await authenticateUser(req)

    // 1. Fetch document metadata
    const { data: doc, error: docError } = await adminClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return errorResponse('Document not found', 404)
    }

    // 2. Enforce permission: owner, admin, or active grant
    const isOwner = doc.owner_id === user.id
    const isAdmin = profile.role === 'administrator'

    let hasGrant = false
    if (!isOwner && !isAdmin) {
      const { data: grant } = await adminClient
        .from('document_grants')
        .select('id, expires_at')
        .eq('document_id', documentId)
        .eq('granted_to', user.id)
        .maybeSingle()

      if (grant) {
        const notExpired = !grant.expires_at || new Date(grant.expires_at) > new Date()
        hasGrant = notExpired
      }
    }

    if (!isOwner && !isAdmin && !hasGrant) {
      // Log unauthorized attempt in append-only audit trail
      await adminClient.from('audit_logs').insert({
        actor_id: user.id,
        action: 'denied',
        resource_type: 'document',
        resource_id: documentId,
        metadata: {
          reason: 'Insufficient permissions for download',
          attempted_action: 'download',
        },
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })

      return errorResponse('Access denied: you do not have permission to download this document', 403)
    }

    // 3. Generate short-lived signed URL (60 seconds)
    const { data: signedData, error: signError } = await adminClient.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60)

    if (signError || !signedData?.signedUrl) {
      return errorResponse('Failed to generate secure download URL', 500)
    }

    // 4. Log successful download in audit trail
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'download',
      resource_type: 'document',
      resource_id: documentId,
      metadata: {
        file_name: doc.file_name,
        file_size: doc.file_size,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })

    return jsonResponse({
      downloadUrl: signedData.signedUrl,
      fileName: doc.file_name,
      expiresIn: 60,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed'
    return errorResponse(message, 401)
  }
})
