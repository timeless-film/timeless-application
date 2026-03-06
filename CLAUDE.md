# CLAUDE.md — TIMELESS

## Project overview

TIMELESS is a **B2B marketplace for classic and heritage films**. It connects exhibitors (cinemas, festivals, ciné-clubs) with rights holders (distributors, archives) through a fully digitalized booking, payment, and delivery workflow.

**Status**: Prototype phase — started 2026-03-06
**Domain**: `timeless.film`

## Tech stack

| Layer           | Technology                              |
|-----------------|----------------------------------------|
| Framework       | Next.js 16 (App Router, TypeScript)     |
| Database        | PostgreSQL (Scaleway Managed)           |
| ORM             | Drizzle ORM                             |
| Auth            | Better Auth (self-hosted, email+MFA)    |
| Payments        | Stripe + Stripe Connect (marketplace)   |
| Emails / CRM    | Customer.io                             |
| UI              | Tailwind CSS v4 + shadcn/ui             |
| i18n            | next-intl (en, fr — default: en)        |
| Validation      | Zod                                     |
| State           | TanStack React Query                    |

## Project structure

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/           # Locale-prefixed routes (next-intl)
│   │   ├── (admin)/        # Admin dashboard routes
│   │   ├── (app)/          # Exhibitor-facing routes
│   │   ├── (auth)/         # Login, register, forgot/reset password
│   │   └── (rights-holder)/ # Rights holder routes
│   └── api/                # API routes (auth, webhooks)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── shared/             # Shared components
│   ├── layout/             # Layout components
│   ├── auth/               # Auth-specific components
│   └── catalogue/          # Catalogue-specific components
├── hooks/                  # Custom React hooks
├── i18n/                   # next-intl config (routing, request, navigation)
├── lib/
│   ├── auth/               # Better Auth server config + client
│   ├── customerio/         # Customer.io user sync + event tracking
│   ├── db/                 # Drizzle client + schema
│   │   └── schema/         # All DB tables (accounts, films, orders, etc.)
│   ├── pricing/            # Pricing calculation + platform settings
│   ├── stripe/             # Stripe + Connect helpers
│   ├── tmdb/               # TMDB API integration
│   └── utils.ts            # Shared utilities (cn, expiry calc, etc.)
├── types/                  # Shared TypeScript types
└── middleware.ts            # Auth guard + next-intl locale detection
messages/
├── en.json                 # English translations
└── fr.json                 # French translations
docs/                       # Project documentation (Obsidian)
```

## Key architecture decisions

- **Route groups**: `(admin)`, `(app)`, `(auth)`, `(rights-holder)` use Next.js route groups for layout separation — they don't affect URLs.
- **Locale prefix**: All user-facing routes are prefixed with `/en` or `/fr` (localePrefix: "always").
- **DB schema**: Split across multiple files in `src/lib/db/schema/`, re-exported from `index.ts`. The schema is passed to the Drizzle client for relational queries.
- **Pricing**: All monetary amounts are stored in **cents** (integers). Commission rates are stored as decimal strings (e.g., `"0.10"` = 10%).
- **Auth**: Better Auth handles sessions, email verification, password reset, and MFA/TOTP. The middleware checks session cookies for protected routes.

## Domain model

Three account types:
- **exhibitor** — cinemas / festivals that browse the catalogue and book films
- **rights_holder** — distributors / archives that publish films and validate bookings
- **admin** — platform operators

Core flow: Catalogue → Cart → Request (if validation required) → Payment → Delivery (DCP/KDM)

## Coding conventions

### Language
- **All code in English**: variable names, function names, type names, enum values, comments, JSDoc.
- Translation strings go in `messages/en.json` and `messages/fr.json` — never hardcoded in components.

### TypeScript
- Strict mode enabled (`strict: true`, `noUncheckedIndexedAccess: true`).
- Use `type` imports: `import type { Foo } from "..."` — enforced by ESLint.
- Path alias: `@/*` maps to `./src/*`.

### Style & formatting
- **Prettier** for formatting (runs on pre-commit via husky + lint-staged).
- **ESLint** with zero warnings policy (`--max-warnings 0`).
- Key ESLint rules:
  - `no-console`: only `console.error` and `console.warn` allowed.
  - `@typescript-eslint/no-explicit-any`: error.
  - `@typescript-eslint/no-unused-vars`: error (prefix unused args with `_`).
  - `import/order`: enforced grouping + alphabetical.
  - `eqeqeq`: always use `===`.

### Components
- shadcn/ui for primitives (installed in `src/components/ui/`).
- Use `cn()` from `@/lib/utils` for conditional class merging (clsx + tailwind-merge).
- React Server Components by default; add `"use client"` only when needed.

### Database
- Drizzle ORM with PostgreSQL.
- Schema in `src/lib/db/schema/` — each file exports tables + relations.
- Use `uuid` for all primary keys (`.defaultRandom()`).
- All tables include `createdAt` / `updatedAt` timestamps.
- Enums use `pgEnum` with snake_case values.
- Run `pnpm db:generate` then `pnpm db:migrate` for schema changes.

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # ESLint (zero warnings)
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format
pnpm format:check     # Prettier check
pnpm typecheck        # TypeScript type check (tsc --noEmit)
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema directly (dev only)
pnpm db:studio        # Open Drizzle Studio
```

## Environment variables

Required in `.env`:
- `DATABASE_URL` — PostgreSQL connection string
- `STRIPE_SECRET_KEY` — Stripe API key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `CUSTOMERIO_SITE_ID` — Customer.io site ID
- `CUSTOMERIO_API_KEY` — Customer.io API key
- `TMDB_API_KEY` — TMDB API key (read access token)
- `NEXT_PUBLIC_APP_URL` — App URL (defaults to `http://localhost:3000`)
- `BETTER_AUTH_SECRET` — Secret for Better Auth session signing

## Important notes

- Do NOT use `console.log` — use `console.warn` or `console.error` instead.
- Always run `pnpm lint` before committing — pre-commit hooks enforce this.
- When adding new DB tables, export them from `src/lib/db/schema/index.ts`.
- Use `next-intl` for all user-facing strings — import `useTranslations` in client components, `getTranslations` in server components.
