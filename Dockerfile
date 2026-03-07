# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Install dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable pnpm

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into client bundles at build time.
# Real values are injected via GitHub secrets at build.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Dummy runtime secrets — never used at build time, only satisfying TypeScript/Next
ENV DATABASE_URL="postgresql://x:x@localhost/x"
ENV BETTER_AUTH_SECRET="build-placeholder"
ENV STRIPE_SECRET_KEY="sk_test_build"
ENV STRIPE_WEBHOOK_SECRET="whsec_build"
ENV CUSTOMERIO_SITE_ID="build"
ENV CUSTOMERIO_API_KEY="build"
ENV TMDB_API_KEY="build"
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — Production runner (minimal image)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Static public assets
COPY --from=builder /app/public ./public

# Next.js standalone output (server.js + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Next.js generated static assets (_next/static)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# All runtime secrets (DATABASE_URL, BETTER_AUTH_SECRET, etc.) are injected
# via Scaleway Serverless Containers environment variables — never baked in.
CMD ["node", "server.js"]
