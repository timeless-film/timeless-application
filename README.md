# TIMELESS

B2B marketplace for classic and heritage films. Exhibitors (cinemas, festivals) book films from rights holders (distributors, archives) through a fully digitalized booking, payment, and delivery workflow.

## Tech stack

| Layer        | Technology                              |
|-------------|----------------------------------------|
| Framework   | Next.js 16 (App Router, TypeScript)     |
| Database    | PostgreSQL + Drizzle ORM                |
| Auth        | Better Auth (email + MFA/TOTP)          |
| Payments    | Stripe + Stripe Connect                 |
| Emails      | Resend (HTTP API)                        |
| UI          | Tailwind CSS v4 + shadcn/ui             |
| i18n        | next-intl (en, fr)                      |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# → Fill in DATABASE_URL, STRIPE_SECRET_KEY, etc.

# Push schema to database (dev only)
pnpm db:push

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable                 | Description                          |
|-------------------------|--------------------------------------|
| `DATABASE_URL`           | PostgreSQL connection string          |
| `BETTER_AUTH_SECRET`     | Session signing secret                |
| `NEXT_PUBLIC_APP_URL`    | App URL (default: http://localhost:3000) |
| `STRIPE_SECRET_KEY`      | Stripe API key                        |
| `STRIPE_WEBHOOK_SECRET`  | Stripe webhook signing secret         |
| `RESEND_API_KEY`         | Resend API key                         |
| `TMDB_API_KEY`           | TMDB read access token                |

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # ESLint (zero warnings)
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format
pnpm format:check     # Prettier check
pnpm typecheck        # tsc --noEmit
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema directly (dev only)
pnpm db:studio        # Open Drizzle Studio
```

## Project structure

```
src/
├── app/[locale]/           # Locale-prefixed routes (next-intl)
│   ├── (admin)/            # Admin dashboard
│   ├── (app)/              # Exhibitor-facing (catalogue, cart, orders)
│   ├── (auth)/             # Login, register, password reset
│   └── (rights-holder)/    # Rights holder (films, wallet, requests)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   └── ...                 # Feature components
├── lib/
│   ├── auth/               # Better Auth config
│   ├── db/schema/          # Drizzle schema (accounts, films, orders…)
│   ├── stripe/             # Stripe + Connect helpers
│   ├── email/              # Transactional email (Resend HTTP API)
│   ├── pricing/            # Pricing engine
│   └── tmdb/               # TMDB API integration
├── i18n/                   # next-intl setup
└── middleware.ts            # Auth + locale middleware
messages/
├── en.json                 # English translations
└── fr.json                 # French translations
```

## Infrastructure (Scaleway)

TIMELESS runs entirely on **Scaleway** in `fr-par` (Paris). The production domain is `app.timeless.film`.

| Service | Product | Details |
|---|---|---|
| **Compute** | Serverless Containers | Scales 0→3 instances, 1 GB RAM / 560 mCPU each, 50 max concurrency |
| **Database** | Managed PostgreSQL 16 | `db-dev-s` instance, automated backups enabled |
| **Storage** | Object Storage (S3) | `timeless-uploads` bucket for user-uploaded files |
| **Registry** | Container Registry | Private registry `rg.fr-par.scw.cloud/timeless` |
| **DNS** | Scaleway Domains | `timeless.film` zone, `app` CNAME → Serverless Containers |
| **Email** | Resend (external) | Transactional emails, DKIM configured on `timeless.film` |

### Deployment pipeline

```
Push to main → CI (typecheck, lint, tests) → Deploy workflow:
  1. Build Docker image (multi-stage, standalone Next.js)
  2. Push to Scaleway Container Registry (tagged by commit SHA)
  3. Run Drizzle migrations against production DB
  4. Update container image + trigger deploy via Scaleway API
```

### Key configuration

- **HTTP → HTTPS**: forced via Scaleway (`http-option=redirected`)
- **Runtime secrets**: injected as Scaleway container environment variables (never baked in the image)
- **`NEXT_PUBLIC_*` vars**: baked at Docker build time via GitHub Actions secrets

## Coding conventions

- **All code in English** (variables, functions, comments, JSDoc)
- User-facing strings use next-intl (`messages/*.json`)
- TypeScript strict mode with type imports
- ESLint zero-warnings policy — no `console.log`, no `any`
- shadcn/ui + `cn()` for styling
- React Server Components by default
- DB amounts in cents (integers), rates as decimal strings

## Documentation

Project specs and epics are in `docs/` (Obsidian vault).

## License

Private — All rights reserved.
