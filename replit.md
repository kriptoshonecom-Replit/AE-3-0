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
- Auto-save to localStorage (keyed by userId from JWT) + debounced server sync via `POST /api/quotes/sync`
- On app init, server quotes are fetched and merged with localStorage (admin-edited versions win)
- Multiple quotes sidebar (create, switch, delete) — width 340px
  - Each sidebar item shows: creator name, created date, updated date, "updated by" (admin edits shown in purple), Pass/Fail badge
- Quote Library admin page (`/admin/quote-library`): table of all users' quotes with search, creator info, Pass/Fail status, edit drawer
  - Edit drawer: admin can update quote #, opp #, company, customer, sales rep, valid until, discount, tax, notes, Pass/Fail
  - Admin edits write back to DB and are pulled by users on next load
- PDF export via jsPDF
- License sync modal (triggers on device qty change or 5s after device selection)
- StatusPass page shows quote-name badge (synced via localStorage `cpq_sp_context`)

### API Server (`artifacts/api-server`)
- Express 5 on port 8080
- Auth routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/auth/me`
- Passwords hashed with bcrypt (10 rounds)
- 8-char verification codes [A-Z0-9], expire in 10 minutes
- JWT signed with `JWT_SECRET` env var, stored in httpOnly cookie
- Email via Nodemailer (SMTP); falls back to console.log if SMTP not configured (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
- Product image upload: admin uploads PNG via `POST /api/admin/products/upload-image`; files are stored in **Replit Object Storage** (GCS bucket, env var `DEFAULT_OBJECT_STORAGE_BUCKET_ID`) under the `products/` prefix, served at `GET /api/images/products/:slug`. The same bucket is used in both dev and production so images are always in sync. Legacy filesystem images (`uploads/` and `quote-builder/public/`) still served as fallback.

### Database (`lib/db`)
- Tables: `users`, `verification_codes`, `product_catalog`, `pit_catalog`, `media_files`, `alert_configs`, `status_pass_config`, **`quotes`** (id varchar, user_id, data jsonb, quote_number, company_name, customer_name, created_at, updated_at, updated_by_user_id, updated_by_name, pass_status)
- `quotes.data` stores the full Quote JSON blob; `quotes.updated_by_name` tracks admin edits
- Push schema: `cd lib/db && pnpm run push`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
