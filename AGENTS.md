# AGENTS.md — TrustVault AI Agent Configuration

## Technology Stack (FROZEN — Do Not Change)

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite |
| CSS | Tailwind CSS |
| Authentication | Supabase Auth |
| Database | PostgreSQL via Supabase |
| Row-Level Security | Supabase RLS |
| File Storage | Supabase Storage (private bucket) |
| Server Functions | Supabase Edge Functions (Deno) |
| Testing (unit) | Vitest |
| Testing (e2e) | Playwright |
| Version Control | Git |
| Deployment | Vercel (frontend) + Supabase (backend) |

## Roles

- **administrator** — Full access: manage users, view all documents, manage all grants, read all audit logs.
- **owner** — Document creator: upload, edit, delete own documents, grant/revoke access to others.
- **viewer** — Read-only access to documents explicitly shared with them.

## Security Invariants

1. Service-role keys NEVER appear in frontend code or public repos.
2. Storage bucket is NEVER public.
3. Download URLs are SHORT-LIVED signed URLs generated server-side, checked against current RLS.
4. Role and user identity are NEVER trusted from the browser.
5. Audit records are APPEND-ONLY — ordinary users cannot update/delete them.
6. Every server function verifies JWT before performing any privileged operation.

## Agent Rules

- Inspect the workspace before making changes.
- Preserve working components and configurations.
- Run tests before marking any feature complete.
- Commit working state before adding new features.
- Never fabricate credentials or mock backend responses as real.
- Keep PROMPTS.md updated with actual prompts, defects, and fixes.
