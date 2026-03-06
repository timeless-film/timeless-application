# Copilot Instructions — TIMELESS

## Project context

TIMELESS is a B2B marketplace for classic and heritage films. Exhibitors (cinemas, festivals) book films from rights holders (distributors, archives) through an integrated booking, payment (Stripe Connect), and delivery workflow.

**Status**: Prototype phase.

## Tech stack

- **Next.js 16** (App Router, TypeScript, React 19)
- **Drizzle ORM** with PostgreSQL
- **Better Auth** (self-hosted auth — email + password + MFA/TOTP)
- **Stripe + Stripe Connect** (payments, marketplace splits, KYC)
- **Customer.io** (transactional emails, CRM events)
- **Tailwind CSS v4 + shadcn/ui** (UI components)
- **next-intl** (i18n — en/fr, default: en)
- **Zod** (validation)
- **TanStack React Query** (client-side data fetching)

## Project structure

- `src/app/[locale]/` — locale-prefixed routes with route groups: `(admin)`, `(app)`, `(auth)`, `(rights-holder)`
- `src/components/ui/` — shadcn/ui primitives
- `src/lib/db/schema/` — Drizzle schema files (accounts, films, orders, cinemas, settings, auth)
- `src/lib/auth/` — Better Auth config (server) + client
- `src/lib/stripe/` — Stripe helpers (payments, Connect transfers)
- `src/lib/customerio/` — Customer.io user sync + event tracking
- `src/lib/pricing/` — Pricing calculation engine
- `src/lib/tmdb/` — TMDB API integration for film metadata
- `src/i18n/` — next-intl routing, request config, navigation helpers
- `src/middleware.ts` — Auth guard + next-intl locale handling
- `messages/en.json`, `messages/fr.json` — Translation files

## Coding rules

### Language
- **All code must be in English**: variable names, function names, types, enums, comments, JSDoc.
- User-facing strings go in `messages/en.json` and `messages/fr.json` via next-intl — never hardcode them.

### TypeScript
- Strict mode (`strict: true`, `noUncheckedIndexedAccess: true`).
- Always use **type imports**: `import type { Foo } from "..."`.
- Path alias: `@/*` → `./src/*`.

### ESLint (zero warnings policy)
- `no-console`: only `console.error` and `console.warn` are allowed. Never use `console.log`.
- `@typescript-eslint/no-explicit-any`: error — avoid `any`.
- `@typescript-eslint/no-unused-vars`: error — prefix unused args with `_`.
- `import/order`: enforced grouping (builtin → external → internal → parent/sibling → index → type) + alphabetical.
- `eqeqeq`: always use `===`.
- `react/self-closing-comp`: self-close components without children.

### Components
- Use shadcn/ui components from `@/components/ui/`.
- Use `cn()` from `@/lib/utils` for conditional class names (clsx + tailwind-merge).
- Default to React Server Components. Only add `"use client"` when required (hooks, interactivity).

### Database
- Drizzle ORM with PostgreSQL.
- Schema split across `src/lib/db/schema/*.ts`, re-exported from `index.ts`.
- Use `uuid` primary keys with `.defaultRandom()`.
- All tables must have `createdAt` / `updatedAt` timestamp columns.
- Enums: `pgEnum` with snake_case values.
- Monetary amounts in **cents** (integers). Rates as decimal strings (e.g., `"0.10"`).

### Naming conventions
- **Files**: kebab-case (`my-component.tsx`, `my-util.ts`)
- **Components**: PascalCase (`MyComponent`)
- **Variables / functions**: camelCase
- **DB columns**: snake_case (Drizzle maps to camelCase in TS)
- **Enum values**: snake_case strings

## Domain model

Three account types: `exhibitor`, `rights_holder`, `admin`.

Core flow: **Catalogue → Cart → Request (if validation needed) → Payment (Stripe) → Delivery (DCP/KDM)**

## Commands

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm lint             # ESLint (--max-warnings 0)
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier
pnpm typecheck        # tsc --noEmit
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema (dev only)
pnpm db:studio        # Drizzle Studio
```

## Environment variables

Required: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CUSTOMERIO_SITE_ID`, `CUSTOMERIO_API_KEY`, `TMDB_API_KEY`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_SECRET`.
