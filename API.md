# API.md — TrustVault Edge Function API Reference

## Overview

TrustVault uses Supabase Edge Functions (Deno runtime) to enforce server-side business logic, JWT validation, Row-Level Security checks, file lifecycle management, and append-only audit logging.

All requests must include an `Authorization: Bearer <jwt>` header containing a valid Supabase Auth session token unless otherwise stated.

---

## Base URL

In local development:
```
http://localhost:54321/functions/v1
```

In production:
```
https://<project-ref>.supabase.co/functions/v1
```

---

## Authentication & Headers

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | Yes | `Bearer <supabase_jwt_access_token>` |
| `apikey` | Yes | Supabase Anon Key (for client routing) |
| `Content-Type` | Condition | `application/json` or `multipart/form-data` |

---

## Endpoints

### 1. Upload Document

Uploads a new document file to private storage, creates document metadata in PostgreSQL, and creates an append-only audit log entry.

- **URL:** `/upload-document`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Allowed Roles:** `administrator`, `owner`

#### Form Data Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | Binary | Yes | File to upload (max 50MB, allowed MIME types only) |
| `title` | String | Yes | Title (1–200 characters) |
| `description` | String | No | Description (max 1000 characters) |
| `tags` | String | No | Comma-separated tags (e.g. `finance, confidential`) |

#### Response (201 Created)
```json
{
  "success": true,
  "document": {
    "id": "e0d7c71e-3f62-4b2a-8b17-38e55e2d1234",
    "owner_id": "8f3b23e1-...",
    "title": "Q4 Financial Report",
    "description": "Quarterly overview",
    "file_path": "8f3b23e1-.../e0d7c71e-.../q4-report.pdf",
    "file_name": "q4-report.pdf",
    "file_size": 524288,
    "mime_type": "application/pdf",
    "version": 1,
    "tags": ["finance", "confidential"],
    "created_at": "2026-10-22T10:00:00Z",
    "updated_at": "2026-10-22T10:00:00Z"
  }
}
```

---

### 2. Download Document

Validates that caller is the document owner, administrator, or has an active unexpired grant. Returns a short-lived (60-second) signed download URL and logs the download in the audit trail. If access is denied, logs a `denied` audit entry and returns 403.

- **URL:** `/download-document?id=<document_id>`
- **Method:** `GET`
- **Allowed Roles:** Caller must be document owner, administrator, or grantee with active grant

#### Query Parameters
- `id` (UUID, required): The document ID.

#### Response (200 OK)
```json
{
  "downloadUrl": "https://<project-ref>.supabase.co/storage/v1/object/sign/documents/...token=...",
  "fileName": "q4-report.pdf",
  "expiresIn": 60
}
```

#### Error Response (403 Forbidden)
```json
{
  "error": "Access denied: you do not have permission to download this document"
}
```

---

### 3. Delete Document

Deletes the document from private Supabase storage and removes metadata from PostgreSQL (cascading all associated grants). Logs a `delete` audit event.

- **URL:** `/delete-document?id=<document_id>`
- **Method:** `DELETE`
- **Allowed Roles:** Document `owner` or `administrator` only

#### Query Parameters
- `id` (UUID, required): The document ID.

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

### 4. Grant Access

Grants `read` or `edit` permission for a document to another user by email. Looks up the recipient user profile server-side, upserts `document_grants`, and logs a `grant` audit event.

- **URL:** `/grant-access`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Allowed Roles:** Document `owner` or `administrator` only

#### Request Body
```json
{
  "documentId": "e0d7c71e-3f62-4b2a-8b17-38e55e2d1234",
  "grantedToEmail": "bob@trustvault.dev",
  "permission": "read",
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "grant": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "document_id": "e0d7c71e-3f62-4b2a-8b17-38e55e2d1234",
    "granted_to": "123e4567-e89b-12d3-a456-426614174000",
    "granted_by": "8f3b23e1-...",
    "permission": "read",
    "created_at": "2026-10-22T10:15:00Z",
    "expires_at": "2026-12-31T23:59:59Z"
  },
  "recipient": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "bob@trustvault.dev",
    "full_name": "Bob Viewer"
  }
}
```

---

### 5. Revoke Access

Revokes a permission grant. Any active signed download URLs expire within 60 seconds. Logs a `revoke` audit event.

- **URL:** `/revoke-access?id=<grant_id>`
- **Method:** `DELETE`
- **Allowed Roles:** Document `owner` or `administrator` only

#### Query Parameters
- `id` (UUID, required): The grant ID.

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Access revoked successfully"
}
```

---

### 6. Update Document

Updates document metadata (`title`, `description`, `tags`). Enforces permissions for document owner, administrator, or users with active `edit` grants. Logs an `update` audit event.

- **URL:** `/update-document?id=<document_id>`
- **Method:** `PATCH`
- **Content-Type:** `application/json`
- **Allowed Roles:** Document `owner`, `administrator`, or user with active `edit` grant

#### Request Body
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "tags": ["finance", "reviewed"]
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "document": {
    "id": "e0d7c71e-...",
    "title": "Updated Title",
    "description": "Updated description",
    "tags": ["finance", "reviewed"],
    "updated_at": "2026-10-22T10:30:00Z"
  }
}
```

---

### 7. Admin Users

Administrative user management. Lists all system users or modifies user role assignments.

- **URL:** `/admin-users`
- **Method:** `GET` | `PATCH`
- **Allowed Roles:** `administrator` only

#### GET /admin-users
Returns all user profiles.

##### Response (200 OK)
```json
{
  "users": [
    {
      "id": "8f3b23e1-...",
      "email": "admin@trustvault.dev",
      "full_name": "Admin User",
      "role": "administrator",
      "created_at": "2026-10-20T00:00:00Z"
    }
  ]
}
```

#### PATCH /admin-users
Updates a user's role. Admins cannot change their own role to prevent self-lockout.

##### Request Body
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "role": "owner"
}
```

##### Response (200 OK)
```json
{
  "success": true,
  "profile": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "bob@trustvault.dev",
    "role": "owner",
    "updated_at": "2026-10-22T10:45:00Z"
  }
}
```

---

## Security Invariants

1. **JWT Verification:** Every Edge Function verifies the JWT via `supabaseAdmin.auth.getUser(token)` before performing any operations.
2. **Role Resolution:** The user's role is never trusted from the client payload or JWT claims; it is always looked up from `public.profiles`.
3. **Short-Lived URLs:** Signed download URLs expire in 60 seconds; no permanent URLs are generated.
4. **Append-Only Auditing:** Security-sensitive actions (`upload`, `download`, `delete`, `grant`, `revoke`, `denied`, `role_change`) write append-only records to `audit_logs`.
5. **No Service-Role Key Leakage:** Service-role keys remain strictly within Edge Functions and environment variables, never accessible in browser code.
