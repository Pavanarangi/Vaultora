-- ============================================================
-- Migration 003: Grants Profile Lookup & Discovery Helpers
-- TrustVault — Snovasys Fresher Hiring Challenge 2026
-- ============================================================
-- Run AFTER 001_core_schema.sql and 002_rls_policies.sql

-- 1. Helper function to lookup user by email for granting access
-- SECURITY DEFINER allows authenticated users to find a user's ID by email
-- without needing full SELECT access to all rows in profiles.
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(target_email TEXT)
RETURNS TABLE (id UUID, email TEXT, full_name TEXT) AS $$
BEGIN
  -- Only authenticated users may invoke this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(target_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Enhanced profile policy for document sharing
-- Allows a user to view profiles of users they share documents with
-- (as either document owner or grantee)
CREATE POLICY "profiles_select_shared" ON public.profiles
  FOR SELECT USING (
    -- User can see profiles of recipients of grants on documents they own
    EXISTS (
      SELECT 1 FROM public.document_grants dg
      JOIN public.documents d ON d.id = dg.document_id
      WHERE d.owner_id = auth.uid() AND dg.granted_to = public.profiles.id
    )
    OR
    -- Grantee can see the owner profile of documents shared with them
    EXISTS (
      SELECT 1 FROM public.document_grants dg
      JOIN public.documents d ON d.id = dg.document_id
      WHERE dg.granted_to = auth.uid() AND d.owner_id = public.profiles.id
    )
  );

-- 3. Document grants view with profile details
CREATE OR REPLACE VIEW public.document_grants_with_profiles AS
SELECT
  dg.id,
  dg.document_id,
  dg.granted_to,
  dg.granted_by,
  dg.permission,
  dg.created_at,
  dg.expires_at,
  p.email AS recipient_email,
  p.full_name AS recipient_name
FROM public.document_grants dg
LEFT JOIN public.profiles p ON p.id = dg.granted_to;

COMMENT ON VIEW public.document_grants_with_profiles IS 'Document grants with recipient email and name';
