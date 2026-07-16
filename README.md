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

Then create required Postgres extensions and apply HNSW and FTS indexes (one-time, after first migration):

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
bun scripts/eval-retrieval.ts    # Retrieval quality eval (needs local DB + OPENAI_API_KEY)
```

## How a question gets answered

```
question → embed → pgvector cosine search ┐
         → tsvector full-text search      ┴→ RRF fusion → access-control filter
         → confidence gate → Claude Haiku synthesis (RAG-only) → answer + citations
```

1. **Hybrid retrieval.** The question is embedded and searched two ways in parallel:
   semantic (pgvector cosine) and full-text (`websearch_to_tsquery` with terms OR-ed,
   so natural questions match on partial word overlap).
2. **Reciprocal Rank Fusion.** The two ranked lists are fused by rank (k = 60), not by
   raw score, so a chunk found by only one search can still win. Deterministic — no LLM
   reranking.
3. **Confidence gate.** `confidence` = best cosine similarity among the top-k chunks.
   Below 0.25 the API returns "I don't know" without calling the model. Borderline
   queries pass through to synthesis, which answers only from the retrieved chunks and
   refuses when they don't contain the answer — so there are two layers of protection
   against made-up answers.
4. **Follow-ups.** In a conversation, the question is first rewritten into a standalone
   search query (e.g. "summarise that" → the original topic) before retrieval, and the
   gate is skipped so conversational requests reach the model.
5. **Citations.** Every answer cites its source chunks; uncited answers are not permitted.

Retrieval quality is measured against a golden set of real questions
(`scripts/golden-set.json`). Run `bun scripts/eval-retrieval.ts` before and after any
change to chunking, scoring, or thresholds — the scoring rules live in `CLAUDE.md`
("Retrieval scoring") and must not change without updating that section.

## Access control model

Every query is scoped to org_id. The visibility JSONB column on chunks is evaluated at query time against the requesting user's role. The access_tier column enforces internal/external plane separation at the SQL level.
