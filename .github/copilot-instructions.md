# Copilot Instructions — TIMELESS

## Project context

TIMELESS is a B2B marketplace for classic and heritage films. Exhibitors (cinemas, festivals) book films from rights holders (distributors, archives) through a digitalized booking, payment (Stripe Connect), and delivery workflow.

**Status**: Prototype phase — started 2026-03-06.

---

## Quality philosophy

Every decision must optimize for **long-term readability and maintainability**, not cleverness.

1. **Explicit over implicit** — name things for what they do. No abbreviations. Code must be understood without prior context.
2. **Single responsibility** — one function = one job. If it needs a comment to explain _what_ it does, rename or split it.
3. **Fail loudly** — catch, type, log (`console.error`), and surface errors to users. Never swallow silently.
4. **Tests are specs** — write tests as documentation. If it's hard to test, the design is wrong.
5. **No dead code** — delete unused code. Git has history.
6. **DRY, not premature** — extract only when duplication is real (same intent, same evolution path).
7. **Consistent patterns** — follow established patterns everywhere. Consistency enables predictability.

---

## Tech stack

- **Next.js 16** (App Router, TypeScript, React 19)
- **Drizzle ORM** + PostgreSQL
- **Better Auth** (self-hosted — email + password + MFA/TOTP)
- **Stripe + Stripe Connect** (marketplace payments)
- **Customer.io** (transactional emails, CRM)
- **Tailwind CSS v4 + shadcn/ui**
- **next-intl** (i18n — en/fr, default: en)
- **Zod** (validation)
- **TanStack React Query** (client-side state)
- **Vitest** (unit tests) + **Playwright** (E2E)

---

## Project structure

- `src/app/[locale]/` — locale-prefixed routes. Route groups: `(admin)`, `(app)`, `(auth)`, `(account)`, `(rights-holder)`.
- `src/components/ui/` — shadcn/ui primitives (don't edit manually).
- `src/components/{feature}/` — feature-scoped components (auth, account, catalog, profile…).
- `src/lib/db/schema/` — Drizzle schema files, re-exported from `index.ts`.
- `src/lib/auth/` — Better Auth config + helpers. `proxy.ts` handles auth routing.
- `src/lib/pricing/` — pricing engine. All money in **cents** (integers).
- `src/lib/services/` — business logic shared between server actions & API routes.
- `src/lib/customerio/` — Customer.io integration with `safeCio` wrapper.
- `src/lib/countries.ts` — ISO country codes + localized names (`Intl.DisplayNames`).
- `src/lib/currencies.ts` — ISO currency codes (Stripe-compatible) + localized names.
- `src/i18n/` — next-intl routing, request, navigation.
- `messages/en.json`, `messages/fr.json` — translations (keys must be English).
- `middleware.ts` — next-intl locale detection only. Auth guards are in `proxy.ts`.

---

## Coding rules

### Language

- **All code in English**: variables, functions, types, enums, comments, JSDoc, git messages.
- **All UI strings via next-intl** — `useTranslations()` / `getTranslations()`. Never hardcode user-facing text.
- **Translation keys in English** — `catalog.title`, not `catalogue.titre`.

### TypeScript

- Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`.
- Always `import type { Foo }` — enforced by ESLint.
- No `any` (use `unknown` + narrowing). No `as` (unless `// SAFETY:` comment). No `!` (handle null explicitly).
- Path alias: `@/*` → `./src/*`.

### Naming

| Element          | Convention    | Example                    |
|------------------|---------------|----------------------------|
| Files            | kebab-case    | `account-info-form.tsx`    |
| Components       | PascalCase    | `AccountInfoForm`          |
| Variables/funcs  | camelCase     | `calculatePricing`         |
| Types            | PascalCase    | `PricingResult`            |
| DB columns (SQL) | snake_case    | `catalog_price`            |
| DB columns (TS)  | camelCase     | `catalogPrice`             |
| Enum values      | snake_case    | `"rights_holder"`          |
| Translation keys | camelCase dot | `"catalog.film.addToCart"` |

### ESLint (zero warnings)

`no-console` (error/warn only) · `no-explicit-any` · `no-unused-vars` (prefix `_`) · `consistent-type-imports` · `import/order` + `import/no-duplicates` · `eqeqeq` · `prefer-const` · `react/self-closing-comp` · `react/jsx-curly-brace-presence`.

---

## Architecture patterns

### Server actions (mutations)

```typescript
"use server";
export async function doSomething(input: Input) {
  // 1. Auth — verify session
  // 2. Validation — Zod parse
  // 3. Authorization — check permissions
  // 4. Business logic
  // 5. Return { success: true } or { error: "CODE" }
}
```

- **Never throw** from server actions — return typed `{ error }` or `{ success }`.
- Error codes are `UPPER_SNAKE_CASE` mapped to `messages/*.json`.
- Always validate with Zod. Always check auth + authorization first.

### Error handling

- Server: `console.error()` + return `{ error }`.
- Client: `toast.error()` + inline error below field.
- Never silently catch — empty catch blocks are bugs.

### Data fetching

- **Server Components** (default): `db.query.*` directly in component.
- **Client Components**: TanStack React Query.
- **Server actions**: mutations and queries from the Next.js UI.
- **API routes**: public REST API for external consumers (third parties, mobile apps) + webhooks + Better Auth.

### Service layer

Business logic in `src/lib/services/*.ts`. Server actions and API routes both call service functions:

```
Next.js UI → server action → service function ← API route ← External client
```

### API routes (REST v1)

- `/api/v1/` prefix. Auth and webhooks stay unversioned.
- Plural resource names. Standard HTTP verbs. Max 2 levels nesting.
- Auth: Bearer token in `Authorization` header.
- Success: `{ data: ... }`. Error: `{ error: { code, message } }`.
- Status codes: 200, 201, 400, 401, 403, 404, 409, 500.
- Pagination: `?page=1&limit=20` → `{ data, pagination: { page, limit, total } }`.
- **Documentation required**: every route must have docs in `docs/api/v1/*.md`. Update docs when routes change.

---

## UI & components

- **shadcn/ui** in `src/components/ui/` — don't edit manually. Use `cn()` for class merging.
- **Server Components by default**. `"use client"` only for hooks/interactivity.
- **sonner** toasts for success/error. Inline errors below form fields.
- Required fields: `<span className="text-destructive">*</span>`.
- Auth pages: render `<AlreadyConnected />` if user is signed in.

### shadcn/ui testing gotchas

- **CardTitle** = `<div>` not heading — use `getByText`, not `getByRole("heading")`.
- **Select** = Radix — use `getByRole("combobox")`, not `selectOption()`.
- **Text collisions**: use exact regex `/^Title$/i` when text appears in multiple elements.

---

## Database

- Drizzle ORM + PostgreSQL. Schema in `src/lib/db/schema/`, re-exported from `index.ts`.
- `uuid` primary keys. `createdAt`/`updatedAt` on all tables. `pgEnum` with snake_case values.
- Money in **cents** (integers). Rates as decimal strings (`"0.10"`).
- New tables → export from `index.ts`. Changes → `pnpm db:generate` + `pnpm db:migrate`.

---

## Security

- Validate all input server-side (Zod). Never trust client data.
- Auth check first in every server action / protected route.
- No secrets in client code — only `NEXT_PUBLIC_*` vars.
- Stripe webhooks: verify signatures.

## Accessibility

- Semantic HTML (`<nav>`, `<main>`, `<button>`, not `<div onClick>`).
- Keyboard accessible. Visible focus states (`focus-visible:ring-*`).
- `alt` text on images. `<Label htmlFor>` on form fields.
- Color never sole indicator — pair with icon or text.

## Performance

- Server Components by default. Dynamic imports for heavy client code.
- `next/image` with explicit dimensions. Efficient DB queries (no N+1).

---

## Testing

- **Every pure function** → unit tests. **Every user flow** → E2E test.
- Extract pure logic from side-effectful modules for testability.
- Unit: `*.test.ts` collocated in `__tests__/`. E2E: `e2e/*.spec.ts`.
- After any change: `pnpm typecheck && pnpm lint && pnpm test`.

### E2E

- Port **3099** (never 3000). Configured in `playwright.config.ts`.
- DB operations: `postgres` npm package, not `psql` CLI.
- Relative URLs with `request` fixture. Trace `proxy.ts` redirect chains before asserting.
- Better Auth `cookieCache` (5-min TTL) → assert toast + state, not reload.

### CI (GitHub Actions)

- Quality job: typecheck → lint → unit tests.
- E2E job: PostgreSQL service → schema push → Playwright.

---

## Commands

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm lint             # ESLint (--max-warnings 0)
pnpm typecheck        # tsc --noEmit
pnpm test             # Unit tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema (dev only)
pnpm db:studio        # Drizzle Studio
```

## Environment variables

`DATABASE_URL` · `BETTER_AUTH_SECRET` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `RESEND_API_KEY` · `CUSTOMERIO_SITE_ID` · `CUSTOMERIO_API_KEY` · `CUSTOMERIO_APP_API_KEY` · `TMDB_API_KEY` · `NEXT_PUBLIC_APP_URL`

## Progress tracking

- Epics: `docs/Epics/E*.md`. Roadmap: `docs/01 - Roadmap.md`.
- Update epic files on ticket completion (`✅ Done`, `🔄 En cours`, `⬜ A faire`).
- Update roadmap when a full epic is completed.
