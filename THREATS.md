# THREATS.md — TrustVault STRIDE Threat Analysis

## Methodology

This document applies the STRIDE framework (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) to TrustVault's threat surface.

---

## STRIDE Analysis

### S — Spoofing

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Attacker forges JWT to impersonate another user | JWTs are RS256-signed by Supabase; only Supabase holds the private key | ✅ Mitigated |
| Attacker supplies fabricated `user_id` in API calls | Role and identity always resolved from database using verified `auth.uid()` | ✅ Mitigated |
| Session hijacking via stolen JWT | JWTs are short-lived (configurable); HTTPS only; HttpOnly cookie option available | ⚠️ Partial |

### T — Tampering

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Attacker modifies document metadata via direct DB | RLS enforces write permissions on `documents` table | ✅ Mitigated |
| Attacker tampers with grant records | RLS enforces that only owner/admin can modify grants | ✅ Mitigated |
| Attacker deletes audit logs | No DELETE policy on `audit_logs`; even admins cannot delete via app | ✅ Mitigated |
| Attacker modifies files in storage | Storage RLS limits write access to owner's folder only | ✅ Mitigated |

### R — Repudiation

| Threat | Mitigation | Status |
|--------|-----------|--------|
| User denies downloading a document | Every download creates an audit log entry with actor_id and timestamp | ✅ Mitigated |
| User denies granting access | Grant events logged in audit_logs | ✅ Mitigated |
| Audit logs are disputed as tampered | Audit logs are append-only; no UPDATE/DELETE allowed | ✅ Mitigated |
| Attacker denies failed access attempts | `denied` events are logged | ✅ Mitigated |

### I — Information Disclosure

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Unauthenticated access to documents | Auth required; RLS blocks unauthenticated queries | ✅ Mitigated |
| Cross-user document access without grant | RLS SELECT policy checks owner_id or grant existence | ✅ Mitigated |
| Permanent/guessable download URLs | 60-second signed URLs; not guessable; not public | ✅ Mitigated |
| Service-role key exposure | Service key never in frontend code or public repo | ✅ Mitigated |
| Storage bucket is public | Bucket configured as private; no public policy | ✅ Mitigated |
| Environment variables in source | `.env.local` in `.gitignore`; only anon key in frontend (by design) | ✅ Mitigated |
| File contents indexed/cached | Signed URLs expire; no CDN caching of private content | ✅ Mitigated |

### D — Denial of Service

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Large file upload exhausting storage | 50MB file size limit enforced client-side and by storage bucket config | ⚠️ Partial |
| Rate-bombing the upload endpoint | Supabase has basic rate limiting; application-level rate limiting not implemented | ❌ Not mitigated |
| Enumeration attacks on document IDs | UUIDs are used; RLS blocks access to non-owned documents | ✅ Mitigated |

### E — Elevation of Privilege

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Viewer escalates to owner by modifying profile | `profiles.role` update RLS only allows self-update of non-role fields; admin updates role | ✅ Mitigated |
| Edit-grant user escalates to delete documents | DELETE policy requires owner or admin; edit grants excluded | ✅ Mitigated |
| User grants themselves access to another document | Grant INSERT policy: only document owner or admin can create grants | ✅ Mitigated |
| IDOR: Guess document UUID to access without grant | RLS SELECT policy blocks access without grant; UUIDs are cryptographically random | ✅ Mitigated |

---

## High-Priority Residual Risks

1. **No MFA** — A compromised password grants full account access. Mitigate by enabling Supabase MFA.
2. **No rate limiting on login** — Brute-force attacks possible. Mitigate via Supabase Auth settings or a WAF.
3. **No virus scanning** — Uploaded files are not scanned for malware. A malicious file could be stored and distributed to grant recipients.
4. **Client-side JWT storage** — JWTs in localStorage are accessible to JavaScript; XSS could steal tokens. Mitigate with Content-Security-Policy headers.
5. **Upload size DoS** — The 50MB limit is enforced but a burst of concurrent large uploads could exhaust storage quota.

---

## Out-of-Scope Threats

- Physical access to Supabase infrastructure (managed by Supabase)
- Zero-day vulnerabilities in Supabase or PostgreSQL
- Supply chain attacks on npm dependencies
