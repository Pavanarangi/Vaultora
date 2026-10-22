import { supabase } from '../lib/supabase'
import type { Document, DocumentGrant, AuditLog, Profile, Json } from '../types/database'

// ─── Document Operations ─────────────────────────────────────────────────────

export async function fetchMyDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchDocument(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updateDocumentMetadata(
  id: string,
  updates: { title?: string; description?: string; tags?: string[] }
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function deleteDocument(id: string): Promise<void> {
  // First get the document to find the file path
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('file_path')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  // Delete file from storage
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([doc.file_path])

  if (storageError) {
    console.warn('Storage deletion failed:', storageError)
    // Continue to delete DB record even if storage fails
  }

  // Delete document record (cascades to grants)
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (dbError) throw dbError
}

// ─── Grant Operations ─────────────────────────────────────────────────────────

export type DocumentGrantWithProfile = DocumentGrant & {
  recipient_email?: string
  recipient_name?: string | null
}

export async function fetchDocumentGrants(documentId: string): Promise<DocumentGrantWithProfile[]> {
  const { data, error } = await supabase
    .from('document_grants')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return []

  // Resolve recipient profiles (email and name) if accessible
  const userIds = [...new Set(data.map(g => g.granted_to))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return data.map(grant => {
    const prof = profileMap.get(grant.granted_to)
    return {
      ...grant,
      recipient_email: prof?.email,
      recipient_name: prof?.full_name,
    }
  })
}

export async function grantAccess(
  documentId: string,
  grantedToEmail: string,
  permission: 'read' | 'edit',
  expiresAt?: string
): Promise<void> {
  const trimmedEmail = grantedToEmail.trim()
  let recipientId: string | null = null

  // 1. Try finding user via lookup_user_by_email RPC
  const { data: rpcUsers } = await supabase.rpc('lookup_user_by_email', {
    target_email: trimmedEmail,
  })

  if (rpcUsers && rpcUsers.length > 0) {
    recipientId = rpcUsers[0].id
  } else {
    // Fallback: direct profiles query
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', trimmedEmail)
      .maybeSingle()

    if (profileError || !profiles) {
      throw new Error(`No user found with email: ${grantedToEmail}`)
    }
    recipientId = profiles.id
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (recipientId === user.id) {
    throw new Error('Cannot grant access to yourself')
  }

  const { error } = await supabase
    .from('document_grants')
    .upsert({
      document_id: documentId,
      granted_to: recipientId,
      granted_by: user.id,
      permission,
      expires_at: expiresAt ?? null,
    }, { onConflict: 'document_id,granted_to' })

  if (error) throw error

  // Append-only audit record
  await insertAuditLog({
    action: 'grant',
    resource_type: 'grant',
    metadata: {
      document_id: documentId,
      granted_to_email: trimmedEmail,
      permission,
    },
  })
}

export async function revokeAccess(grantId: string): Promise<void> {
  const { error } = await supabase
    .from('document_grants')
    .delete()
    .eq('id', grantId)

  if (error) throw error

  await insertAuditLog({
    action: 'revoke',
    resource_type: 'grant',
    resource_id: grantId,
  })
}

export async function fetchSharedWithMe(): Promise<Document[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: grants, error: grantsError } = await supabase
    .from('document_grants')
    .select('document_id')
    .eq('granted_to', user.id)

  if (grantsError) throw grantsError
  if (!grants || grants.length === 0) return []

  const documentIds = grants.map(g => g.document_id)

  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .in('id', documentIds)
    .order('updated_at', { ascending: false })

  if (docsError) throw docsError
  return docs ?? []
}

// ─── Audit Log Operations ─────────────────────────────────────────────────────

export async function fetchAuditLogs(options?: {
  limit?: number
  resourceId?: string
}): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.limit) query = query.limit(options.limit)
  if (options?.resourceId) query = query.eq('resource_id', options.resourceId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function insertAuditLog(entry: {
  action: string
  resource_type?: string
  resource_id?: string
  metadata?: Json
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { error } = await supabase
    .from('audit_logs')
    .insert({
      actor_id: user?.id ?? null,
      action: entry.action,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      metadata: entry.metadata ?? null,
    })

  if (error) console.error('Audit log insert failed:', error)
}

// ─── User/Profile Operations ──────────────────────────────────────────────────

export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('email')

  if (error) throw error
  return data ?? []
}

export async function updateUserRole(
  userId: string,
  role: 'administrator' | 'owner' | 'viewer'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw error
}

// ─── Upload Operations ────────────────────────────────────────────────────────

export async function uploadDocument(
  file: File,
  metadata: { title: string; description?: string; tags?: string[] }
): Promise<Document> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Generate unique document ID
  const docId = crypto.randomUUID()
  const filePath = `${user.id}/${docId}/${file.name}`

  // Upload file to private storage bucket
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '0',
      upsert: false,
    })

  if (uploadError) throw uploadError

  // Insert document metadata
  const { data, error: dbError } = await supabase
    .from('documents')
    .insert({
      id: docId,
      owner_id: user.id,
      title: metadata.title,
      description: metadata.description ?? null,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      version: 1,
      tags: metadata.tags ?? null,
    })
    .select()
    .single()

  if (dbError) {
    // Rollback storage upload
    await supabase.storage.from('documents').remove([filePath])
    throw dbError
  }

  // Log audit event
  await insertAuditLog({
    action: 'upload',
    resource_type: 'document',
    resource_id: docId,
    metadata: { file_name: file.name, file_size: file.size },
  })

  return data
}

// ─── Download Operations ──────────────────────────────────────────────────────

export async function getDownloadUrl(documentId: string): Promise<string> {
  // Fetch document — RLS ensures user has access
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('file_path, file_name')
    .eq('id', documentId)
    .single()

  if (fetchError) throw new Error('Document not found or access denied')

  // Create a short-lived signed URL (60 seconds)
  const { data, error: signError } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.file_path, 60)

  if (signError || !data?.signedUrl) {
    throw new Error('Failed to generate download URL')
  }

  // Log audit event
  await insertAuditLog({
    action: 'download',
    resource_type: 'document',
    resource_id: documentId,
    metadata: { file_name: doc.file_name },
  })

  return data.signedUrl
}
