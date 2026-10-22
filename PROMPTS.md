# PROMPTS.md — TrustVault Development Log & AI Interaction History

This document tracks all user prompts, architecture decisions, discovered defects, root causes, and applied fixes in accordance with `AGENTS.md`.

---

## Session Log: 2026-10-22

### Prompt 1
**User Request:**
```
continue
```

**Context & State at Invocation:**
- Repository inspection revealed initialized frontend pages, Tailwind CSS styles, migration scripts, and documentation (`ARCHITECTURE.md`, `SECURITY.md`, `THREATS.md`), but several core components, build errors, and required documentation files (`API.md`, `PROMPTS.md`) were pending or failing.
- Git repository was not yet initialized (`fatal: not a git repository`).
- Missing Edge Functions directory `supabase/functions/` and lack of server-side functions implementing the specification in `ARCHITECTURE.md`.

---

## Identified Defects & Applied Fixes

### Defect 1: Relative Path Import Error in `src/lib/supabase.ts`
- **Symptom:** `error TS2307: Cannot find module './types/database' or its corresponding type declarations.`
- **Root Cause:** `src/lib/supabase.ts` was importing `./types/database` instead of `../types/database`.
- **Fix:** Corrected import to `import type { Database } from '../types/database'`.

### Defect 2: Missing `Relationships` in Supabase v2 Database Types
- **Symptom:** TypeScript compilation produced:
  `Argument of type ... is not assignable to parameter of type 'never'` across all Supabase client table operations in `src/lib/api.ts`.
- **Root Cause:** `@supabase/supabase-js` v2 `GenericTable` enforces that every table schema define `Relationships: GenericRelationship[]` and `Update: Record<string, unknown>`. Missing `Relationships` and using `Update: never` on `audit_logs` caused the table types to resolve to `never`.
- **Fix:**
  - Added `Relationships: []` to `profiles`, `documents`, `document_grants`, and `audit_logs` in `src/types/database.ts`.
  - Updated `Update: never` in `audit_logs` to `Update: Record<string, unknown>`.

### Defect 3: Vitest Matchers Missing in Vitest Assertion Interface
- **Symptom:** `error TS2339: Property 'toBeInTheDocument' does not exist on type 'Assertion<void, HTMLElement>'.`
- **Root Cause:** `@testing-library/jest-dom` was imported in `setup.ts` without the Vitest binding, and `tsconfig.app.json` only declared `vite/client` under `compilerOptions.types`.
- **Fix:**
  - Updated `setup.ts` to `import '@testing-library/jest-dom/vitest'`.
  - Added `@testing-library/jest-dom/vitest` to `compilerOptions.types` in `tsconfig.app.json`.
  - Configured `defineConfig` from `vitest/config` in `vite.config.ts`.

### Defect 4: Unused Identifiers and Lint Warnings
- **Symptom:** `oxlint` reported unused `within` import in `LoginPage.test.tsx` and unused `err` catch parameter in `DocumentsPage.tsx`.
- **Root Cause:** Dead imports and unreferenced error arguments.
- **Fix:** Removed `within` from `LoginPage.test.tsx`; switched to bare `catch { ... }` in `DocumentsPage.tsx`.

### Defect 5: Tailwind CSS Version Mismatch with PostCSS
- **Symptom:** PostCSS build failed with:
  `Error: [postcss] It looks like you're trying to use tailwindcss directly as a PostCSS plugin...` followed by utility resolution errors for `bg-surface-900`.
- **Root Cause:** Tailwind v4 was initially pulled, which deprecated the classic PostCSS plugin and `@tailwind base;` directives without migration.
- **Fix:**
  - Aligned dependencies with Tailwind v3 (`tailwindcss@^3.4.17`), which matches the project design tokens in `tailwind.config.js`.
  - Added missing `surface-400: '#3d3d66'` color token in `tailwind.config.js`.
  - Removed unsupported `@apply ... group` directive from `src/index.css` (Tailwind forbids applying `group` in CSS; moved `group` to component classNames in `AppLayout.tsx`).

### Defect 6: UUID Display in Document Grants List
- **Symptom:** In `DocumentDetailPage.tsx`, granted recipients were rendered as raw user UUIDs (`grant.granted_to`), and the revoke confirmation modal did not include recipient details.
- **Root Cause:** `fetchDocumentGrants` only returned rows from `document_grants` without recipient profile resolution.
- **Fix:**
  - Enhanced `fetchDocumentGrants` in `src/lib/api.ts` to resolve recipient emails and full names into `DocumentGrantWithProfile`.
  - Updated `DocumentDetailPage.tsx` to display user initials avatar, recipient email, full name, and passed email to the revoke confirmation dialog.
  - Added `supabase/migrations/003_grants_lookup.sql` providing `lookup_user_by_email` function and cross-user grant discovery policy.

### Defect 7: Missing Supabase Edge Functions & Documentation
- **Symptom:** `supabase/functions/`, `API.md`, and `PROMPTS.md` specified in `README.md` and `AGENTS.md` were missing from the codebase.
- **Root Cause:** Server function implementation had not been committed.
- **Fix:**
  - Implemented all 7 required Edge Functions in `supabase/functions/`:
    1. `upload-document` (POST): file validation, private bucket upload, metadata insert, audit log.
    2. `download-document` (GET): permission check, 60-second signed URL generation, download audit log, access-denied logging.
    3. `delete-document` (DELETE): owner/admin check, storage removal, database deletion, audit log.
    4. `grant-access` (POST): owner/admin check, email resolution, upsert grant, audit log.
    5. `revoke-access` (DELETE): owner/admin check, grant revocation, audit log.
    6. `update-document` (PATCH): owner/edit-grant check, metadata update, audit log.
    7. `admin-users` (GET/PATCH): administrator check, user listing, role update, self-demotion prevention, audit log.
  - Implemented shared CORS (`_shared/cors.ts`) and auth client helper (`_shared/supabaseClient.ts`).
  - Created `API.md` documenting complete API specifications, request/response formats, security controls, and error codes.
  - Created `PROMPTS.md` maintaining full traceability.

### Defect 8: Unit and E2E Test Suite Coverage
- **Symptom:** Only two test files existed (`utils.test.ts` and `LoginPage.test.tsx`).
- **Fix:**
  - Created reusable test provider wrapper `src/test/test-utils.tsx`.
  - Added unit test suites for `DashboardPage`, `UploadPage`, `DocumentDetailPage`, `AdminPage`, `AuditPage`.
  - Configured Playwright with `playwright.config.ts` and added E2E authentication specs in `e2e/auth.spec.ts`.
  - All 7 unit test files (39 tests) pass cleanly.

---

## Verification Summary

| Check | Tool | Result |
|-------|------|--------|
| TypeScript Typecheck | `tsc -b` | 0 errors |
| Production Build | `vite build` | Succeeded |
| Linter | `oxlint` | 0 warnings, 0 errors (40 files) |
| Unit Tests | `vitest run` | 7/7 test files passed (39/39 tests) |
| Git Tracking | `git status` | Cleanly trackable repository |
| Security Invariants | Audit / Code Review | Verified across all Edge Functions & RLS |
