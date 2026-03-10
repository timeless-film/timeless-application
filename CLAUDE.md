# CLAUDE.md — TIMELESS

## Project overview

TIMELESS is a **B2B marketplace for classic and heritage films**. It connects exhibitors (cinemas, festivals, ciné-clubs) with rights holders (distributors, archives) through a fully digitalized booking, payment, and delivery workflow.

**Status**: Prototype phase — started 2026-03-06
**Domain**: `timeless.film`

---

## Quality philosophy

This application is built for **long-term maintainability**. Every decision — naming, structure, patterns — must optimize for readability and change-tolerance over cleverness.

### Guiding principles

1. **Explicit over implicit** — No magic. Name things for what they do. Avoid abbreviations. A developer reading the code 6 months from now must understand intent without context.
2. **Single responsibility** — Each file, function, and component does one thing well. If a function needs a comment to explain _what_ it does, it should be split or renamed.
3. **Fail loudly** — Errors must be caught, typed, logged, and surfaced to the user. Never swallow errors silently. Use `console.error` + user-facing feedback (toast or inline).
4. **Tests are documentation** — Tests describe what the system does. Write them as specifications, not afterthoughts. If it's hard to test, the design is wrong — refactor.
5. **No dead code** — Delete unused functions, components, imports, and files. Git has history.
6. **DRY, but not at the cost of clarity** — Extract shared logic only when the duplication is real (same intent, same evolution path). Don't abstract prematurely.
7. **Consistent patterns** — Once a pattern is established (e.g., server action shape, error handling, form layout), follow it everywhere. Consistency enables predictability.

---

## Tech stack

| Layer           | Technology                              |
|-----------------|----------------------------------------|
| Framework       | Next.js 16 (App Router, TypeScript, React 19) |
| Database        | PostgreSQL (Scaleway Managed)           |
| ORM             | Drizzle ORM                             |
| Auth            | Better Auth (self-hosted, email+MFA)    |
| Payments        | Stripe + Stripe Connect (marketplace)   |
| Emails          | Resend (HTTP API)                       |
| UI              | Tailwind CSS v4 + shadcn/ui             |
| i18n            | next-intl (en, fr — default: en)        |
| Validation      | Zod                                     |
| State           | TanStack React Query                    |
| Unit tests      | Vitest + Testing Library                |
| E2E tests       | Playwright (Chromium)                   |
| CI              | GitHub Actions                          |

---

## Project structure

```
src/
├── app/                       # Next.js App Router
│   ├── [locale]/              # Locale-prefixed routes (next-intl)
│   │   ├── (admin)/           # Admin dashboard routes
│   │   ├── (app)/             # Exhibitor-facing routes (catalog, cart, orders…)
│   │   ├── (auth)/            # Login, register, forgot/reset password
│   │   ├── (account)/         # Shared account management (profile, info, members)
│   │   └── (rights-holder)/   # Rights holder routes (films, wallet…)
│   └── api/                   # API routes (auth, webhooks, v1 public API)
├── components/
│   ├── ui/                    # shadcn/ui primitives (do not edit manually)
│   ├── shared/                # Cross-feature reusable components
│   ├── layout/                # Layout shells, sidebars
│   ├── auth/                  # Auth-specific components
│   ├── account/               # Account management components
│   ├── profile/               # Profile components
│   └── catalog/               # Catalog-specific components
├── hooks/                     # Custom React hooks
├── i18n/                      # next-intl config (routing, request, navigation)
├── lib/
│   ├── auth/                  # Better Auth server config + client + helpers
│   ├── email/                 # Transactional email (Resend HTTP API)
│   ├── db/                    # Drizzle client + schema
│   │   └── schema/            # DB tables (accounts, films, orders, cinemas, settings, auth)
│   ├── pricing/               # Pricing calculation engine
│   ├── services/              # Business logic (shared between server actions & API routes)
│   ├── stripe/                # Stripe + Connect helpers
│   ├── tmdb/                  # TMDB API integration
│   ├── countries.ts           # ISO country codes + localized names (Intl.DisplayNames)
│   ├── currencies.ts          # ISO currency codes (Stripe-compatible) + localized names
│   └── utils.ts               # Shared utilities (cn, formatters, etc.)
├── types/                     # Shared TypeScript types
└── middleware.ts              # next-intl locale detection only — auth is in proxy.ts
messages/
├── en.json                    # English translations
└── fr.json                    # French translations
e2e/                           # Playwright E2E tests
docs/                          # Project documentation (epics, roadmap)
docs/api/                      # API documentation (README + per-resource docs)
```

### Key architecture decisions

- **Route groups** (`(admin)`, `(app)`, `(auth)`, `(rights-holder)`, `(account)`) provide layout separation — they don't appear in URLs.
- **Locale prefix**: All user-facing routes are prefixed with `/en` or `/fr` (`localePrefix: "always"`).
- **Auth routing**: `proxy.ts` (not `middleware.ts`) handles auth guards, account type checks, and redirects. Middleware only does locale detection.
- **DB schema**: Split across files in `src/lib/db/schema/`, re-exported from `index.ts`.
- **Pricing**: All monetary amounts in **cents** (integers). Commission rates as decimal strings (`"0.10"` = 10%).

---

## Domain model

Three account types: **exhibitor**, **rights_holder**, **admin**.

Core flow: **Catalog → Cart → Request (if validation needed) → Payment (Stripe) → Delivery (DCP/KDM)**

---

## Coding standards

### Language

- **All code in English**: variables, functions, types, enum values, comments, JSDoc, git messages.
- **All UI strings via next-intl**: `useTranslations()` (client) / `getTranslations()` (server). Never hardcode user-facing text.
- **Translation key names in English**: namespace and key names must be English (e.g., `catalog.title`, not `catalogue.titre`).

### TypeScript

- **Strict mode**: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`.
- **Type imports**: Always use `import type { Foo } from "..."` — enforced by ESLint.
- **No `any`**: Use `unknown` + type narrowing. ESLint enforces this.
- **No type assertions (`as`)** unless absolutely necessary — add a `// SAFETY:` comment explaining why.
- **No non-null assertions (`!`)** — handle `undefined`/`null` explicitly.
- **Path alias**: `@/*` maps to `./src/*`.

### Naming conventions

| Element            | Convention         | Example                      |
|--------------------|--------------------|------------------------------|
| Files              | kebab-case         | `account-info-form.tsx`      |
| Components         | PascalCase         | `AccountInfoForm`            |
| Variables / funcs  | camelCase          | `calculatePricing`           |
| Types / interfaces | PascalCase         | `PricingResult`              |
| DB columns (SQL)   | snake_case         | `catalog_price`              |
| DB columns (TS)    | camelCase (mapped) | `catalogPrice`               |
| Enum values        | snake_case strings | `"rights_holder"`            |
| Translation keys   | camelCase dot path | `"catalog.film.addToCart"`   |

### ESLint & formatting

- **Zero warnings policy** (`--max-warnings 0`).
- **Prettier** for formatting (pre-commit via husky + lint-staged).
- Key rules: `no-console` (error/warn only), `no-explicit-any`, `no-unused-vars` (prefix `_`), `consistent-type-imports`, `import/order` (grouped + alphabetical), `import/no-duplicates`, `eqeqeq`, `prefer-const`, `react/self-closing-comp`, `react/jsx-curly-brace-presence`.

---

## Architecture patterns

### Server actions

Server actions are the primary way to mutate data. They follow a strict pattern:

```typescript
"use server";

export async function doSomething(input: SomeInput) {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  // 2. Input validation (Zod)
  const parsed = someSchema.safeParse(input);
  if (!parsed.success) return { error: "INVALID_INPUT" as const };

  // 3. Authorization (does user have access?)
  // 4. Business logic
  // 5. Return typed result
  return { success: true, data: result };
}
```

Rules:
- Always return `{ error: string }` or `{ success: true }` — **never throw** from server actions.
- Error codes are `UPPER_SNAKE_CASE` strings mapped to translations in `messages/*.json`.
- Validate all input with Zod. Never trust client data.
- Check auth + authorization before any mutation.

### Error handling

- **Server-side**: Use `console.error()` with context. Return typed error objects.
- **Client-side**: Always show `toast.error()` AND inline feedback.
- **Unexpected errors** (try/catch): show generic error toast, log with `console.error`.
- **Never silently catch** — an empty catch block is a bug.

### Data fetching

- **Server Components (default)**: fetch data directly with `db.query.*` or service functions.
- **Client Components**: TanStack React Query when interactivity demands it.
- **Server actions**: mutations and queries from the Next.js UI. Never use `fetch()` from client to internal API routes.
- **API routes** (`src/app/api/`): public REST API for external consumers (third parties, mobile apps) + webhooks + Better Auth.

### Service layer — shared business logic

Business logic lives in **service functions** (`src/lib/services/*.ts`), not in server actions or API route handlers. Both entry points call the same services:

```
Next.js UI  →  server action  →  service function  ←  API route handler  ←  External client
```

- **Service functions** are pure business logic: validation, DB queries, rules enforcement. They receive already-authenticated context (accountId, userId) — they don't handle auth themselves.
- **Server actions** handle auth (session check), call service functions, return `{ success }` or `{ error }`.
- **API route handlers** handle auth (Bearer token), call service functions, return JSON with HTTP status codes.

### API routes (REST v1)

All public API routes live under `/api/v1/` with RESTful conventions:

```
src/app/api/
├── auth/[...all]/route.ts          ← Better Auth (not versioned)
├── webhooks/                       ← External webhooks (not versioned)
│   ├── stripe/route.ts
│   └── customerio/route.ts
└── v1/                             ← Versioned public API
    └── cinemas/
        ├── route.ts                ← GET (list), POST (create)
        └── [cinemaId]/
            ├── route.ts            ← GET (detail), PATCH (update), DELETE
            └── rooms/
                ├── route.ts        ← GET (list), POST (create)
                └── [roomId]/
                    └── route.ts    ← GET, PATCH, DELETE
```

#### Conventions

| Rule | Detail |
|------|--------|
| **Versioning** | `/api/v1/` prefix. Auth and webhooks stay unversioned (stable by nature). |
| **RESTful** | Plural resource names. Standard HTTP verbs (GET/POST/PATCH/DELETE). |
| **Nesting** | Max 2 levels deep (`/cinemas/[id]/rooms/[id]`). Beyond that, flatten. |
| **Auth** | Bearer token in `Authorization` header. Webhooks use signature verification. |
| **Success response** | `{ data: ... }` with appropriate status code (200, 201). |
| **Error response** | `{ error: { code: "UPPER_SNAKE", message: "Human-readable" } }` with status code. |
| **Status codes** | 200 (ok), 201 (created), 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 500 (server error). |
| **Pagination** | `?page=1&limit=20` → `{ data: [...], pagination: { page, limit, total } }`. |

#### API route handler pattern

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { listCinemasForAccount } from "@/lib/services/cinema-service";

export async function GET(request: NextRequest) {
  // 1. Auth — verify Bearer token
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  // 2. Business logic — call service function
  const cinemas = await listCinemasForAccount(authResult.accountId);

  // 3. Return JSON response
  return NextResponse.json({ data: cinemas });
}
```

#### API documentation

Every API route **must** have corresponding documentation in `docs/api/v1/`. Update docs whenever a route changes.

```
docs/api/
├── README.md                       ← Overview, auth, conventions, versioning
└── v1/
    ├── cinemas.md                  ← Cinema endpoints
    ├── rooms.md                    ← Room endpoints
    └── ...
```

Standard format per endpoint:

```markdown
## GET /api/v1/cinemas

List all cinemas for the authenticated account.

**Auth**: Bearer token (required)

**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page  | int  | 1       | Page number |
| limit | int  | 20      | Items per page (max 100) |

**Response 200**:
\`\`\`json
{
  "data": [{ "id": "...", "name": "...", ... }],
  "pagination": { "page": 1, "limit": 20, "total": 3 }
}
\`\`\`

**Errors**: 401 Unauthorized, 403 Forbidden
```

### Loading & error states

- Route-level: `loading.tsx` and `error.tsx`.
- Component-level: React Suspense boundaries.
- Forms: disable submit button + show spinner during async operations.

---

## UI components

### shadcn/ui

- Primitives in `src/components/ui/` — managed by shadcn CLI, don't edit manually.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- **React Server Components by default**. Add `"use client"` only for hooks/interactivity.

### shadcn/ui testing gotchas

- **CardTitle** renders `<div>`, not `<h1-h6>` — don't use `getByRole("heading")`.
- **Select** is Radix-based — use `getByRole("combobox")`, not `selectOption()`.
- **Text collisions**: when text appears in both CardTitle and CardDescription, use exact regex: `/^Active sessions$/i`.

### Forms & feedback

- **sonner** toasts for success/error. `<Toaster />` is in root layout.
- **Inline errors** below fields AND `toast.error()` for all user-facing errors.
- Required fields: red asterisk `<span className="text-destructive">*</span>`.
- Password fields: hint below (`text-xs text-muted-foreground`).
- Confirm password: real-time mismatch feedback.
- Auth pages: if already signed in, render `<AlreadyConnected />`.

---

## Database

- **Drizzle ORM** with PostgreSQL.
- Schema in `src/lib/db/schema/*.ts`, re-exported from `index.ts`.
- **Primary keys**: `uuid` with `.defaultRandom()`.
- **Timestamps**: all tables must have `createdAt` / `updatedAt`.
- **Enums**: `pgEnum` with snake_case values.
- **Money**: integers in cents. Rates as decimal strings (`"0.10"`).
- **New tables**: always export from `src/lib/db/schema/index.ts`.
- **Schema changes**: `pnpm db:generate` → `pnpm db:migrate`. Use `pnpm db:push` for dev quick sync only.

---

## Security

- **Validate server-side**: Zod in every server action and API route.
- **Auth first**: every server action / protected route verifies session before anything.
- **Authorization**: after auth, verify user has permission (correct account, correct role).
- **No secrets in client code**: only `NEXT_PUBLIC_*` vars reach the browser.
- **Stripe webhooks**: always verify signatures.
- **SQL injection**: Drizzle parameterizes by default. Never raw string interpolation.

---

## Accessibility

- **Semantic HTML**: `<nav>`, `<main>`, `<section>`, `<button>` (not `<div onClick>`).
- **Keyboard accessible**: all interactive elements.
- **`alt` text**: all images (empty `alt=""` for decorative).
- **Labels**: form fields must have `<Label htmlFor>`.
- **Color not sole indicator**: pair with icon or text.
- **Visible focus states**: Tailwind's `focus-visible:ring-*`.

---

## Performance

- **Server Components** by default — minimize client JS.
- **Dynamic imports** (`next/dynamic`) for heavy client components.
- **`next/image`** for all images with explicit dimensions.
- **Efficient queries**: select only needed fields, use indexes, avoid N+1.
- **Drizzle `with`** for relational data. Batch DB calls when possible.

---

## Testing

### Principles

- **Every pure function must have unit tests** — no exceptions.
- **New user flows must have E2E tests**.
- **Extract pure logic** from side-effectful modules for testability (e.g., `proxy-helpers.ts` from `proxy.ts`).
- **Tests are specs**: `it("returns /catalog for exhibitor accounts")`.
- File naming: `*.test.ts` (unit), `*.spec.ts` (E2E).
- Unit tests are collocated: `src/lib/auth/__tests__/proxy-helpers.test.ts`.

### E2E configuration

- Playwright uses **port 3099** (not 3000). Configured in `playwright.config.ts`.
- Never run E2E on port 3000. Never manually set `PLAYWRIGHT_BASE_URL`.

### E2E — UI tests are the standard

- **UI tests by default**: all feature tests must exercise the real UI (navigate pages, fill forms, click buttons, assert visible text). Pure DB or direct-fetch tests are forbidden for features — they test nothing meaningful.
- **API tests for API endpoints only**: `e2e/api-v1.spec.ts`, `e2e/catalog.spec.ts`, `e2e/film-*.spec.ts`, `e2e/cart.spec.ts` use `request` fixture to test REST API routes. This is correct — API endpoints have no UI.
- **Never test features with raw DB queries or API calls when there is a UI**. If a page exists for a feature, the E2E test must use `page` to navigate and interact with it.

### E2E — shared helpers

- **Exhibitor setup**: import `setupExhibitor`, `registerAndLogin`, `completeOnboarding`, `uniqueEmail` from `e2e/helpers/exhibitor.ts`. Never duplicate these functions in test files.
- **Rights holder setup**: import from `e2e/helpers/rights-holder.ts`.
- **Unique emails**: always use `uniqueEmail(prefix)` (crypto `randomBytes`) for test accounts. Never hardcode emails — parallel test runs will collide.
- **Test isolation**: use `TEST_ID = Date.now().toString(36)` for unique company/cinema names within a file.

### E2E — assertion quality

- **No `waitForTimeout()`**: never use hard sleeps. Use `toBeVisible({ timeout })`, `waitForURL()`, `waitForResponse()`, or Playwright auto-waiting.
- **Precise assertions**: use `toBe(200)` not `toBeLessThan(500)`. Use `toBe(true)` not `toBeTruthy()` for `Array.isArray()`. Use `toBe(400)` not `[200, 400].toContain(status)`.
- **Test names must match behavior**: if a test calls an API, don't name it "Modal shows…". Name it "Cart API rejects…".
- **No duplicate tests**: before adding a test, check it doesn't already exist in another file. Redirect tests live in `auth.spec.ts`, not scattered across files.
- **No `test.skip`**: either fix the test or delete it. Skipped tests are dead code.

### E2E best practices

- **DB access**: use `postgres` npm package, never `psql` CLI.
- **Fixtures**: relative URLs with `request` fixture (has `baseURL`).
- **Redirect chains**: trace actual flow in `proxy.ts` before writing assertions.
- **Cleanup**: `lsof -ti:3099 | xargs kill -9 2>/dev/null; rm -rf .next/dev/lock`.
- **Session cache**: Better Auth's `cookieCache` (5-min TTL) → assert on toast + local state, not reload.

### CI pipeline

- **Quality job**: typecheck → lint → unit tests (no DB needed).
- **E2E job**: PostgreSQL service container → schema push → Playwright.
- Failing tests upload `playwright-report/` and `test-results/` as artifacts.

---

## Development workflow

### Before every commit

```bash
pnpm typecheck && pnpm lint && pnpm test
```

### After every feature

1. Run typecheck + lint + unit tests.
2. Smoke-test affected pages (curl or browser).
3. If feature involves a user flow, ensure E2E coverage.
4. Update relevant epic doc + roadmap.

### When modifying architecture

- Update this file (`CLAUDE.md`) and `.github/copilot-instructions.md`.
- If new tables are added, export from `src/lib/db/schema/index.ts`.

---

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # ESLint (zero warnings)
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format
pnpm format:check     # Prettier check
pnpm typecheck        # tsc --noEmit
pnpm test             # Unit tests (Vitest)
pnpm test:watch       # Unit tests watch mode
pnpm test:coverage    # Unit tests + coverage
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:e2e:ui      # E2E tests with UI
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run Drizzle migrations
pnpm db:push          # Push schema to DB (dev only)
pnpm db:studio        # Open Drizzle Studio
```

## Environment variables

Required in `.env.local`:

| Variable                        | Purpose                                             |
|---------------------------------|-----------------------------------------------------|
| `DATABASE_URL`                  | PostgreSQL connection string                        |
| `BETTER_AUTH_SECRET`            | Session signing secret                              |
| `STRIPE_SECRET_KEY`             | Stripe API key                                      |
| `STRIPE_WEBHOOK_SECRET`         | Stripe webhook signing secret                       |
| `RESEND_API_KEY`                | Resend API key for transactional emails          |
| `EMAIL_FROM`                    | Sender address (default: `hello@timeless.film`)     |
| `TMDB_API_KEY`                  | TMDB read access token                              |
| `NEXT_PUBLIC_APP_URL`           | App URL (default: `http://localhost:3000`)          |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (baked at build time)  |

---

## Progress tracking

- Epics and tickets: `docs/Epics/E*.md`. Roadmap: `docs/01 - Roadmap.md`.
- **Always update** epic and ticket status continuously during development milestones — use `✅ Done`, `🔄 En cours`, `⬜ A faire`.
- Keep a concise ticket checklist in epic docs and refresh it after each meaningful merge.
- When a full epic is completed, update its status in `docs/01 - Roadmap.md`.
