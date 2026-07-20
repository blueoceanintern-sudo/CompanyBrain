# Company's Brain

B2B enterprise knowledge operating system. Multi-tenant, org-agnostic. v1 pilot: Equest school network.

## Prerequisites

- [Bun](https://bun.sh) >= 1.1
- Docker (for Postgres 17 + pgvector)
- API keys: OpenAI, Anthropic, Stripe
- SMTP credentials (user invite emails)

## Setup

### 1. Environment

```bash
cp .env.example .env
# Fill in all values in .env
```

### 2. Start Postgres

```bash
docker compose up -d db
```

(`db` only — the compose file also defines `api` and `web` containers for production-style deploys; you don't want those in local dev. First run auto-applies `db/init.sql`, which creates the `vector` and `pg_trgm` extensions.)

### 3. Install dependencies

```bash
bun install
```

### 4. Run migrations

```bash
bun db:migrate
```

(`bun db:generate` is only needed when you change the schema.) Then apply the HNSW, FTS, and performance indexes (one-time, after first migration):

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

### 6. Start dev servers

```bash
bun run dev          # starts api (port 3002) + web (port 3000)
```

## Architecture

```
apps/api       Hono backend -- /api/v1/* (JWT cookie auth)
apps/web       Next.js 15 frontend; browser API calls go through its /api/v1 proxy routes
services/      Business logic (no cross-service imports)
workers/       node-cron jobs (ingestion-retry, query-log purge, org-data purge; manual re-embed)
db/            Drizzle schema + migrations + init/post-migrate SQL
shared/        Types and constants
scripts/       setup.ts seed, eval-retrieval.ts + golden-set.json
```

shadcn/ui components are committed under `apps/web/src/components/ui/` — no shadcn init step is needed; add new components with `npx shadcn@latest add <component>` from `apps/web`.

## Key commands

```bash
bun run --filter '@company-brain/api' dev    # API only
bun run --filter '@company-brain/web' dev    # Web only
bun run workers                              # Start cron jobs
bun test                                     # Run tests
bun scripts/eval-retrieval.ts                # Retrieval quality eval (needs local DB + OPENAI_API_KEY)
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

Every query is scoped to org_id. Four layers apply on top of that:

1. **Roles** — `super_admin | org_admin | dept_admin | staff | external_client`, mapped to permissions in `shared/constants.ts`.
2. **Visibility JSONB** on chunks (`allowedRoles`, `deniedRoles`, `allowedPrincipals`, `classification`), evaluated at query time against the requesting user.
3. **Compartments** — documents live in compartments (one level of sub-compartments allowed). A `restricted` compartment is only accessible to users or groups with an explicit grant (`compartment_grants`); groups are managed on the Users page.
4. **Access tier** — the `access_tier` column enforces internal/external plane separation at the SQL level; the external pipeline can never touch internal chunks.

## Known gaps

- `parent_chunk_id` is never set at ingest, so small-to-big retrieval expansion is currently a no-op.
- Chunking is context-free (fixed 2000-char windows); section-aware chunking is planned — benchmark against the golden set before changing.
- No CI pipeline yet — run `bun test` locally before pushing.
