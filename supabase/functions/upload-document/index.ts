import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { authenticateUser, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const { user, adminClient } = await authenticateUser(req)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const title = (formData.get('title') as string | null)?.trim()
    const description = (formData.get('description') as string | null)?.trim() || null
    const tagsRaw = formData.get('tags') as string | null

    if (!file) {
      return errorResponse('File is required', 400)
    }

    if (!title || title.length < 1 || title.length > 200) {
      return errorResponse('Title must be between 1 and 200 characters', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('File size exceeds the 50MB limit', 413)
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return errorResponse(`File type '${file.type}' is not supported`, 415)
    }

    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : null

    const docId = crypto.randomUUID()
    const filePath = `${user.id}/${docId}/${file.name}`

    // 1. Upload to private storage bucket
    const fileBytes = await file.arrayBuffer()
    const { error: storageError } = await adminClient.storage
      .from('documents')
      .upload(filePath, fileBytes, {
        contentType: file.type,
        upsert: false,
      })

    if (storageError) {
      return errorResponse(`Storage upload failed: ${storageError.message}`, 500)
    }

    // 2. Insert document record
    const { data: document, error: dbError } = await adminClient
      .from('documents')
      .insert({
        id: docId,
        owner_id: user.id,
        title,
        description,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        version: 1,
        tags,
      })
      .select()
      .single()

    if (dbError) {
      // Clean up orphaned storage object
      await adminClient.storage.from('documents').remove([filePath])
      return errorResponse(`Database insert failed: ${dbError.message}`, 500)
    }

    // 3. Append-only audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'upload',
      resource_type: 'document',
      resource_id: docId,
      metadata: {
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })

    return jsonResponse({ success: true, document }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return errorResponse(message, 401)
  }
})
