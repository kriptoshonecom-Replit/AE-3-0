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
- Accordion-based product groups with dropdown product selection
- Products loaded from `src/data/products.json` (4 categories, 20 items)
- Per-line quantity, unit price override, and optional notes
- Quote metadata: title, customer name/email, valid until, discount %, tax %
- Subtotals per group and grand total summary
- Auto-save to localStorage
- Multiple quotes sidebar (create, switch, delete)
- PDF export via jsPDF

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
