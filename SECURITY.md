# SECURITY.md — TrustVault Security Model

## Overview

TrustVault is designed with a security-first approach. Every architectural decision prioritizes data protection, access control, and auditability.

---

## Authentication

| Control | Implementation |
|---------|---------------|
| Provider | Supabase Auth (Email + Password) |
| Token Format | JWT (RS256 signed by Supabase) |
| Session Storage | Browser localStorage via Supabase client |
| Token Refresh | Automatic via Supabase client |
| Password Policy | Minimum 8 characters (enforced by Supabase) |
| Email Confirmation | Configurable in Supabase dashboard |

### What We Do
- JWTs are verified by Supabase on every API call
- Edge Functions re-verify the JWT server-side before any privileged operation
- Role is read from the `profiles` table — never from the JWT or client request

---

## Authorization (Role-Based Access Control)

### Roles

| Role | Capabilities |
|------|-------------|
| `administrator` | Full access: all documents, all users, all grants, all audit logs |
| `owner` | Upload/edit/delete own documents; grant/revoke access to others |
| `viewer` | Read-only access to explicitly shared documents |

### Key Invariants

1. **Role is never trusted from the client.** It is always read from the `profiles` table using the verified JWT's `uid`.
2. **Ownership is enforced at the database level** via Row-Level Security (RLS) policies.
3. **Grants are document-specific.** A viewer access to document A does not imply access to document B.
4. **Edit grants** allow metadata updates only. They do not allow role escalation or grant management.

---

## Database Security (Row-Level Security)

All four tables have RLS enabled:

### `profiles`
- Users read/update their own profile only
- Administrators read/update any profile
- Role changes are only possible via admin context

### `documents`
- SELECT: owner, admin, or user with active (non-expired) grant
- INSERT: authenticated user; `owner_id` must equal `auth.uid()`
- UPDATE: owner, admin, or user with active `edit` grant
- DELETE: owner or admin only

### `document_grants`
- SELECT: the granted user, the document owner, or admin
- INSERT/UPDATE/DELETE: document owner or admin

### `audit_logs`
- SELECT: admin sees all; others see only their own events
- INSERT: authenticated users (actor_id = auth.uid())
- **NO UPDATE or DELETE policies** — audit records are immutable

---

## Storage Security

- Bucket `documents` is configured as **private** (not public)
- Files are organized as `{owner_id}/{document_id}/{filename}`
- Storage RLS policies enforce:
  - Users read only their own files OR files they have grants for
  - Users upload only into their own folder (`{auth.uid()}/...`)
  - Only owner or admin can delete files
- **No public URLs are ever issued**
- Download URLs are **60-second signed URLs** generated after RLS verification

---

## Download Security

When a user requests a download:
1. Client calls `getDownloadUrl(documentId)` 
2. Supabase RLS verifies the user has SELECT access to the document
3. A 60-second signed URL is generated from the private bucket
4. The URL is returned to the client
5. An audit log entry is created

**Revocation:** When a grant is revoked, any previously issued signed URLs expire within 60 seconds. No long-lived links exist.

---

## Audit Logging

Every security-relevant event generates an audit record:

| Event | Logged |
|-------|--------|
| Document upload | ✅ |
| Document download | ✅ |
| Document delete | ✅ |
| Grant access | ✅ |
| Revoke access | ✅ |
| Access denied | ✅ |
| User login | ✅ |

Audit logs are **append-only**: there are no UPDATE or DELETE RLS policies on `audit_logs`. Even administrators cannot delete audit records through the application.

---

## What Is NOT Present (Honest Assessment)

| Control | Status | Note |
|---------|--------|------|
| MFA / 2FA | ❌ | Not implemented; configurable in Supabase |
| IP allowlisting | ❌ | Not implemented |
| Rate limiting | ❌ | Depends on Supabase tier / Edge Function config |
| File encryption at rest | ✅ | Supabase Storage handles encryption at rest |
| File encryption client-side | ❌ | Not implemented |
| Virus/malware scanning | ❌ | Not implemented; file type validation is the only gate |
| LDAP/SSO | ❌ | Not implemented |
| Service-role key exposure | ✅ | Service-role key never in frontend code |

---

## Responsible Disclosure

This is a hackathon project. Do not use in production without a full security review.
