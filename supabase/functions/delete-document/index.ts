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

    // 2. Enforce permission: owner or admin only
    const isOwner = doc.owner_id === user.id
    const isAdmin = profile.role === 'administrator'

    if (!isOwner && !isAdmin) {
      await adminClient.from('audit_logs').insert({
        actor_id: user.id,
        action: 'denied',
        resource_type: 'document',
        resource_id: documentId,
        metadata: {
          reason: 'Unauthorized deletion attempt (non-owner, non-admin)',
          attempted_action: 'delete',
        },
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })

      return errorResponse('Access denied: only the document owner or an administrator can delete this document', 403)
    }

    // 3. Remove from private storage
    const { error: storageError } = await adminClient.storage
      .from('documents')
      .remove([doc.file_path])

    if (storageError) {
      console.warn('Storage deletion warning:', storageError)
    }

    // 4. Delete document record (foreign keys cascade to document_grants)
    const { error: dbError } = await adminClient
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (dbError) {
      return errorResponse(`Database deletion failed: ${dbError.message}`, 500)
    }

    // 5. Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'delete',
      resource_type: 'document',
      resource_id: documentId,
      metadata: {
        title: doc.title,
        file_name: doc.file_name,
        file_path: doc.file_path,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })

    return jsonResponse({ success: true, message: 'Document deleted successfully' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return errorResponse(message, 401)
  }
})
