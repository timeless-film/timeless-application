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

### Forms & feedback
- Use **sonner** (`toast` from `"sonner"`) for success and error toasts. The `<Toaster />` is in the root layout.
- Display **inline errors** in forms (below the field or in a summary) **and** fire a `toast.error()` for every user-facing error.
- Mark required fields with a red asterisk: `<span className="text-destructive">*</span>` after the label text.
- Show password rules as a hint (`text-xs text-muted-foreground`) below the password field.
- Show real-time password mismatch below the confirm field when the user starts typing.
- On auth pages, check the session (`useSession`). If the user is already signed in, render the `<AlreadyConnected />` component instead of the form.

### Database
- Drizzle ORM with PostgreSQL.
- Schema in `src/lib/db/schema/` — each file exports tables + relations.
- Use `uuid` for all primary keys (`.defaultRandom()`).
- All tables include `createdAt` / `updatedAt` timestamps.
- Enums use `pgEnum` with snake_case values.
- Run `pnpm db:generate` then `pnpm db:migrate` for schema changes.

## Testing

### Stack
- **Vitest** — unit tests (fast, Vite-powered, with `@testing-library/react` for components)
- **Playwright** — end-to-end tests (Chromium headless)
- **GitHub Actions** — CI pipeline (`.github/workflows/ci.yml`) runs on every push and PR

### Conventions
- Unit tests collocated next to source: `src/lib/auth/__tests__/active-account-cookie.test.ts`
- E2E tests in `e2e/` directory: `e2e/auth.spec.ts`, `e2e/account.spec.ts`
- Test file naming: `*.test.ts` (unit), `*.spec.ts` (E2E)
- Use `describe` / `it` blocks with clear, behavior-driven names
- Pure helper functions must have unit tests — extract them from modules that mix pure logic + side effects (e.g. `proxy-helpers.ts` extracted from `proxy.ts`)

### E2E port strategy
- Playwright uses a **dedicated port (3099)** to avoid conflicts with any dev server already running on 3000.
- The port is configured in `playwright.config.ts` via `PLAYWRIGHT_PORT` env var (default: 3099).
- The webServer config passes `PORT` and `NEXT_PUBLIC_APP_URL` to the dev server so Better Auth client connects to the correct instance.
- **Never run E2E tests on port 3000** — always let Playwright manage its own server on 3099.

### Development workflow (MANDATORY)
1. **After developing any feature**: run `pnpm typecheck && pnpm lint` to verify no regressions
2. **Write tests for new logic**: every new pure function or helper must have unit tests. New pages/flows should have E2E coverage.
3. **Run tests before completing a ticket**: `pnpm test` (unit) and `pnpm test:e2e` (E2E) must pass
4. **Always update documentation**: update the relevant epic file, CLAUDE.md, and copilot-instructions.md when architecture changes
5. **Smoke-test manually**: curl or browse key pages after changes to catch runtime errors

### CI pipeline
- **Trigger**: every push to `main`/`develop` and every PR targeting those branches.
- **Quality job**: typecheck → lint → unit tests (no DB required).
- **E2E job**: PostgreSQL service container → schema push → Playwright tests.
- Failing tests upload `playwright-report/` and `test-results/` as artifacts for debugging.

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # ESLint (zero warnings)
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format
pnpm format:check     # Prettier check
pnpm typecheck        # TypeScript type check (tsc --noEmit)
pnpm test             # Run unit tests (Vitest)
pnpm test:watch       # Run unit tests in watch mode
pnpm test:coverage    # Run unit tests with coverage
pnpm test:e2e         # Run E2E tests (Playwright)
pnpm test:e2e:ui      # Run E2E tests with UI
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
- **Always write tests** for new pure functions and helpers. Run `pnpm test` after changes.
- **Always smoke-test** new pages/features (curl or browser) before marking a ticket done.
- **Always update docs** (epic files, CLAUDE.md) when architecture or file structure changes.

## Progress tracking

- Epics and tickets are documented in `docs/Epics/E*.md`. The roadmap is in `docs/01 - Roadmap.md`.
- **Always update the relevant epic file when a ticket is completed or progresses** — add a status (`✅ Done`, `🔄 En cours`, `⬜ A faire`) next to each ticket title so we always know where we stand.
- When a full epic is completed, update its status in `docs/01 - Roadmap.md` as well.
- Move completed standalone files to the `done/` folder if applicable.
