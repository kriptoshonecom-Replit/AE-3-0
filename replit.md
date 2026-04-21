# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Quote Builder (`artifacts/quote-builder`)
- React + Vite frontend-only app at path `/`
- Authentication: custom email/password + 8-char alphanumeric email verification codes (no Clerk)
  - `src/context/AuthContext.tsx` — `AuthProvider` + `useAuth()` hook; calls API `/api/auth/me` on mount
  - Sign-in and sign-up are two-step: credentials → verify code
  - Session stored as httpOnly JWT cookie (`session`) via API server
- Vite dev proxy: `/api` → `http://localhost:8080` (API server)
- Accordion-based product groups with dropdown product selection
- Products loaded from `src/data/products.json` (4 categories, 20 items)
- Per-line quantity, unit price override, and optional notes
- Quote metadata: title, customer name/email, valid until, discount %, tax %
- Subtotals per group and grand total summary
- Auto-save to localStorage (keyed by userId from JWT)
- Multiple quotes sidebar (create, switch, delete)
- PDF export via jsPDF
- License sync modal (triggers on device qty change or 5s after device selection)

### API Server (`artifacts/api-server`)
- Express 5 on port 8080
- Auth routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/auth/me`
- Passwords hashed with bcrypt (10 rounds)
- 8-char verification codes [A-Z0-9], expire in 10 minutes
- JWT signed with `JWT_SECRET` env var, stored in httpOnly cookie
- Email via Nodemailer (SMTP); falls back to console.log if SMTP not configured (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)

### Database (`lib/db`)
- Tables: `users` (id, email, password_hash, full_name, created_at), `verification_codes` (id, user_id, code, type, expires_at, used, created_at)
- Push schema: `pnpm --filter @workspace/db run push`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
