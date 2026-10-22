-- ============================================================
-- TrustVault — Complete Database Setup & Migrations
-- Snovasys Fresher Hiring Challenge 2026
-- ============================================================
-- Run this entire file in your Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Paste -> Run)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('administrator', 'owner', 'viewer')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles and role assignments';

-- ============================================================
-- 2. DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT CHECK (char_length(description) <= 1000),
  file_path   TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_size   BIGINT NOT NULL CHECK (file_size > 0),
  mime_type   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  tags        TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.documents IS 'Document metadata; actual files stored in private Supabase Storage bucket "documents"';

-- ============================================================
-- 3. DOCUMENT_GRANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_grants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  granted_to   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by   UUID NOT NULL REFERENCES public.profiles(id),
  permission   TEXT NOT NULL CHECK (permission IN ('read', 'edit')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  UNIQUE (document_id, granted_to)
);

COMMENT ON TABLE public.document_grants IS 'Explicit per-document access grants';

-- ============================================================
-- 4. AUDIT_LOGS TABLE — APPEND ONLY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  metadata      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS 'Append-only security audit trail — no UPDATE or DELETE permitted';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_owner ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON public.documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_grants_document ON public.document_grants(document_id);
CREATE INDEX IF NOT EXISTS idx_grants_granted_to ON public.document_grants(granted_to);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ============================================================
-- 5. AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'owner'  -- Default role for new signups; admin can promote later
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs      ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an administrator?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrator'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.document_grants dg
      JOIN public.documents d ON d.id = dg.document_id
      WHERE (d.owner_id = auth.uid() AND dg.granted_to = public.profiles.id)
         OR (dg.granted_to = auth.uid() AND d.owner_id = public.profiles.id)
    )
  );

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_trigger" ON public.profiles;
CREATE POLICY "profiles_insert_trigger" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- DOCUMENTS policies
DROP POLICY IF EXISTS "documents_select" ON public.documents;
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

DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "documents_update" ON public.documents;
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

DROP POLICY IF EXISTS "documents_delete" ON public.documents;
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE USING (
    owner_id = auth.uid()
    OR public.is_admin()
  );

-- DOCUMENT_GRANTS policies
DROP POLICY IF EXISTS "grants_select" ON public.document_grants;
CREATE POLICY "grants_select" ON public.document_grants
  FOR SELECT USING (
    granted_to = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "grants_insert" ON public.document_grants;
CREATE POLICY "grants_insert" ON public.document_grants
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "grants_update" ON public.document_grants;
CREATE POLICY "grants_update" ON public.document_grants
  FOR UPDATE USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "grants_delete" ON public.document_grants;
CREATE POLICY "grants_delete" ON public.document_grants
  FOR DELETE USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

-- AUDIT_LOGS policies — IMMUTABLE & APPEND ONLY
DROP POLICY IF EXISTS "audit_select" ON public.audit_logs;
CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT USING (
    public.is_admin()
    OR actor_id = auth.uid()
  );

DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;
CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (actor_id = auth.uid() OR actor_id IS NULL)
  );

-- ============================================================
-- 8. STORAGE BUCKET: "documents" (PRIVATE)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,  -- 50MB limit
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

-- Storage object policies
DROP POLICY IF EXISTS "storage_select" ON storage.objects;
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

DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
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

-- ============================================================
-- 9. USER EMAIL DISCOVERY HELPER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(target_email TEXT)
RETURNS TABLE (id UUID, email TEXT, full_name TEXT) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(target_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
