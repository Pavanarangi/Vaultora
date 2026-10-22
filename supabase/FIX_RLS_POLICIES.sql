-- ============================================================
-- TrustVault — Quick RLS & Storage Hotfix
-- Run this in Supabase SQL Editor to resolve policy recursion
-- ============================================================

-- 1. Helper function with row_security disabled to eliminate recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'administrator';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off;

-- 2. Profiles policy: all authenticated users can view collaborator profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. Document grants: check granted_to & granted_by directly to avoid circular joins
DROP POLICY IF EXISTS "grants_select" ON public.document_grants;
CREATE POLICY "grants_select" ON public.document_grants
  FOR SELECT USING (
    granted_to = auth.uid()
    OR granted_by = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "grants_insert" ON public.document_grants;
CREATE POLICY "grants_insert" ON public.document_grants
  FOR INSERT WITH CHECK (
    granted_by = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "grants_update" ON public.document_grants;
CREATE POLICY "grants_update" ON public.document_grants
  FOR UPDATE USING (
    granted_by = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "grants_delete" ON public.document_grants;
CREATE POLICY "grants_delete" ON public.document_grants
  FOR DELETE USING (
    granted_by = auth.uid()
    OR public.is_admin()
  );

-- 4. Storage policies for private 'documents' bucket
DROP POLICY IF EXISTS "storage_select" ON storage.objects;
CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "storage_delete" ON storage.objects;
CREATE POLICY "storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin()
    )
  );

-- 5. Ensure 'documents' bucket exists and is private
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
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
