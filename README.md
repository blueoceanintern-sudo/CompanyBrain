# Company's Brain

B2B enterprise knowledge operating system. Multi-tenant, org-agnostic. v1 pilot: Equest school network.

## Prerequisites

- [Bun](https://bun.sh) >= 1.1
- Docker (for Postgres + pgvector)
- API keys: OpenAI, Anthropic, Stripe

## Setup

### 1. Environment

```bash
cp .env.example .env
# Fill in all values in .env
```

### 2. Start Postgres

```bash
docker-compose up -d
```

### 3. Install dependencies

```bash
bun install
```

### 4. Run migrations

```bash
bun db:generate
bun db:migrate
```

Then apply HNSW and FTS indexes (one-time, after first migration):

```bash
psql $DATABASE_URL -f db/post-migrate.sql
```

### 5. Seed first org + admin

```bash
SETUP_ORG_NAME="Equest School Network" \
SETUP_ADMIN_EMAIL="admin@equest.edu.au" \
SETUP_ADMIN_PASSWORD="changeme123" \
bun run scripts/setup.ts
```

### 6. Install shadcn/ui components

```bash
cd apps/web
npx shadcn@latest init
npx shadcn@latest add button input textarea select dialog sheet tooltip table tabs badge card skeleton avatar alert switch toggle-group pagination progress sonner
cd ../..
```

### 7. Start dev servers

```bash
bun run dev          # starts api (port 3002) + web (port 3000)
```

## Architecture

```
apps/api       Hono backend -- /api/v1/*
apps/web       Next.js 15 frontend
services/      Business logic (no cross-service imports)
workers/       node-cron jobs (ingestion-retry, re-embed)
db/            Drizzle schema + migrations
shared/        Types and constants
```

## Key commands

```bash
bun run dev --filter apps/api    # API only
bun run dev --filter apps/web    # Web only
bun run workers                  # Start cron jobs
bun test                         # Run tests
```

## Access control model

Every query is scoped to org_id. The visibility JSONB column on chunks is evaluated at query time against the requesting user's role. The access_tier column enforces internal/external plane separation at the SQL level.
