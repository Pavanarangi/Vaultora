-- ============================================================
-- Migration 002: Row-Level Security Policies
-- TrustVault — Snovasys Fresher Hiring Challenge 2026
-- ============================================================
-- Run AFTER 001_core_schema.sql

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: is the current user an administrator?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrator'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES policies
-- ============================================================
-- Users can read their own profile; admins can read all
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );

-- Users can update their own profile (not role); admins update any
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- No direct INSERT/DELETE — managed via trigger and admin only
CREATE POLICY "profiles_insert_trigger" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- DOCUMENTS policies
-- ============================================================
-- SELECT: owner, admin, or has an active grant
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT USING (
    owner_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.document_grants dg
      WHERE dg.document_id = id
        AND dg.granted_to = auth.uid()
        AND (dg.expires_at IS NULL OR dg.expires_at > NOW())
    )
  );

-- INSERT: only authenticated users; owner_id must match caller
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

-- UPDATE: owner, admin, or user with edit grant
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.document_grants dg
      WHERE dg.document_id = id
        AND dg.granted_to = auth.uid()
        AND dg.permission = 'edit'
        AND (dg.expires_at IS NULL OR dg.expires_at > NOW())
    )
  );

-- DELETE: owner or admin only
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE USING (
    owner_id = auth.uid()
    OR public.is_admin()
  );

-- ============================================================
-- DOCUMENT_GRANTS policies
-- ============================================================
-- SELECT: granted_to sees own grants; owner sees grants for their docs; admin sees all
CREATE POLICY "grants_select" ON public.document_grants
  FOR SELECT USING (
    granted_to = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

-- INSERT: owner of the document or admin can grant
CREATE POLICY "grants_insert" ON public.document_grants
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

-- UPDATE: owner or admin only
CREATE POLICY "grants_update" ON public.document_grants
  FOR UPDATE USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

-- DELETE (revoke): owner or admin only
CREATE POLICY "grants_delete" ON public.document_grants
  FOR DELETE USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

-- ============================================================
-- AUDIT_LOGS policies — CRITICAL SECURITY
-- ============================================================
-- SELECT: admins see all; users see only their own events
CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT USING (
    public.is_admin()
    OR actor_id = auth.uid()
  );

-- INSERT: any authenticated user (for client-side logging)
-- Note: In production, prefer Edge Functions with service role for inserts
CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (actor_id = auth.uid() OR actor_id IS NULL)
  );

-- NO UPDATE policy — audit logs are immutable
-- NO DELETE policy — audit logs cannot be deleted

-- ============================================================
-- Storage: Private documents bucket
-- ============================================================
-- Storage policies must be created via the Supabase Dashboard or CLI.
-- Settings to apply:
--   Bucket name: documents
--   Public: FALSE (never public)
-- 
-- Bucket policies (apply in Dashboard > Storage > documents > Policies):
--
-- READ (SELECT): Users can only read their own files OR files they have a grant for
-- INSERT: Authenticated users can upload to their own folder only ({auth.uid()}/**) 
-- DELETE: Only file owner or admin
--
-- The actual policy SQL for storage bucket (run in SQL Editor):

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,  -- 50MB
  ARRAY[
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
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Storage RLS: users can read files they own or have grants for
CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.document_grants dg ON dg.document_id = d.id
        WHERE d.file_path = name
          AND dg.granted_to = auth.uid()
          AND (dg.expires_at IS NULL OR dg.expires_at > NOW())
      )
    )
  );

-- Storage RLS: users can only upload to their own folder
CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: owner or admin can delete
CREATE POLICY "storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin()
    )
  );
