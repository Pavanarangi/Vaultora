-- ============================================================
-- Seed Data — TrustVault Development / Demo
-- ============================================================
-- WARNING: Run in a DEVELOPMENT or DEMO environment only.
-- These users are created with known passwords for testing.
--
-- After running this seed, you must:
-- 1. Create the users via Supabase Auth (Dashboard > Auth > Users > Add User)
--    OR use the Supabase CLI:
--    supabase auth users create --email admin@trustvault.dev --password Admin1234!
--    supabase auth users create --email alice@trustvault.dev --password Alice1234!
--    supabase auth users create --email bob@trustvault.dev   --password Bob1234!
--
-- 2. Run this SQL AFTER the users exist in auth.users.
--    The handle_new_user trigger creates their profiles automatically on signup.
--
-- 3. Run the UPDATE below to assign the admin role to the admin user.

-- Assign administrator role to the admin user (run after signup)
UPDATE public.profiles
SET role = 'administrator'
WHERE email = 'admin@trustvault.dev';

-- Demo documents (owner = alice@trustvault.dev)
-- These will be inserted after alice's profile exists
DO $$
DECLARE
  alice_id UUID;
BEGIN
  SELECT id INTO alice_id FROM public.profiles WHERE email = 'alice@trustvault.dev';
  
  IF alice_id IS NOT NULL THEN
    INSERT INTO public.documents (id, owner_id, title, description, file_path, file_name, file_size, mime_type, tags)
    VALUES
      (
        gen_random_uuid(), alice_id,
        'Q4 2024 Financial Report',
        'Quarterly financial summary including revenue, expenses, and projections.',
        alice_id || '/demo/q4-financial-report.pdf',
        'q4-financial-report.pdf', 524288, 'application/pdf',
        ARRAY['finance', '2024', 'quarterly', 'confidential']
      ),
      (
        gen_random_uuid(), alice_id,
        'Employee Handbook v3.2',
        'Company policies, procedures, and code of conduct.',
        alice_id || '/demo/employee-handbook.docx',
        'employee-handbook.docx', 1048576, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ARRAY['hr', 'policy', 'handbook']
      ),
      (
        gen_random_uuid(), alice_id,
        'Product Roadmap 2025',
        'Engineering roadmap and feature priorities for 2025.',
        alice_id || '/demo/roadmap-2025.xlsx',
        'roadmap-2025.xlsx', 262144, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ARRAY['product', '2025', 'roadmap', 'engineering']
      )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Demo documents created for alice@trustvault.dev';
  ELSE
    RAISE NOTICE 'alice@trustvault.dev not found. Create the user first.';
  END IF;
END $$;

-- Demo audit log entries
INSERT INTO public.audit_logs (action, resource_type, metadata)
VALUES
  ('login', NULL, '{"email": "admin@trustvault.dev"}'),
  ('login', NULL, '{"email": "alice@trustvault.dev"}')
ON CONFLICT DO NOTHING;
