# Vaultora

**Enterprise Secure Document Vault** — Snovasys Fresher Hiring Challenge 2026

Vaultora is a secure enterprise document management system featuring role-based access control, explicit per-document permission grants, private encrypted file storage, and a tamper-evident audit trail.

---

## Features

- **Authentication** — Email/password via Supabase Auth; JWT-based sessions
- **Three Roles** — `administrator`, `owner`, `viewer` with distinct capabilities
- **Document Management** — Upload, view, edit metadata, delete documents
- **Fine-Grained Grants** — Per-document `read` or `edit` grants to specific users; explicit revocation
- **Private Storage** — Files never publicly accessible; short-lived (60s) signed download URLs
- **Audit Logging** — Every security-relevant action logged; append-only; admin readable
- **Admin Dashboard** — User management, role assignment, system-wide audit view
- **Search & Filter** — Full-text search, filter by type/date/owner

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Auth | Supabase Auth |
| Database | PostgreSQL (Supabase) + RLS |
| Storage | Supabase Storage (private) |
| Backend | Supabase Edge Functions |
| Unit Tests | Vitest |
| E2E Tests | Playwright |
| Deployment | Vercel + Supabase |

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/Pavanarangi/Vaultora.git
cd Vaultora
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials (see `.env.example` for field descriptions).

### 3. Run Database Migrations

Apply SQL files in `supabase/migrations/` in numerical order using the Supabase Dashboard SQL editor, or via CLI:

```bash
supabase db push
```

### 4. Seed the Database

Run `supabase/seed.sql` in the SQL editor. This creates:
- `admin@vaultora.dev` / `Admin1234!` — administrator role
- `alice@vaultora.dev` / `Alice1234!` — owner role  
- `bob@vaultora.dev` / `Bob1234!` — viewer role

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Running Tests

### Unit Tests
```bash
npm run test
```

### Unit Tests (UI)
```bash
npm run test:ui
```

---

## Deployment

- **Live Production URL:** [https://vaultora-nine.vercel.app](https://vaultora-nine.vercel.app)
- **Deployment URL:** [https://vaultora-559rygthz-pavanarangi2005-9333.vercel.app](https://vaultora-559rygthz-pavanarangi2005-9333.vercel.app)
- **Vercel Project Dashboard:** [https://vercel.com/pavanarangi2005-9333/vaultora](https://vercel.com/pavanarangi2005-9333/vaultora)

To redeploy or update:
```bash
npm run build
npx vercel deploy --prod
```

---

## Documentation

| File | Contents |
|------|---------|
| `ARCHITECTURE.md` | System design, DB schema, security model |
| `AGENTS.md` | AI agent configuration and tech stack rules |
| `SECURITY.md` | Threat model and security controls |
| `THREATS.md` | STRIDE threat analysis |
| `API.md` | Edge Function API reference |
| `PROMPTS.md` | Development log and AI interaction history |

---

## License

MIT — Snovasys Fresher Hiring Challenge 2026
