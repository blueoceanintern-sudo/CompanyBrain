# CLAUDE.md — Company's Brain

This file defines **how to build** this project. For **what to build**, refer to the PRD.

B2B SaaS knowledge platform: ingests documents → chunks + embeds → stores with row-level access control → answers plain-language queries with grounded, citation-backed responses. Two knowledge planes per org: internal (staff-only) and external (client-facing, monetised via Stripe). Multi-tenant, org-agnostic. v1 pilot: Equest school network.

---

## Current State vs Target

The repo shares infrastructure with the Automated Marketing Solution — same VPS, same Postgres instance, same backend framework. Company's Brain is a **new product** being built on top of that shared base.

| Area | Built today | Target (this doc) |
|---|---|---|
| Repo layout | Shared monorepo base with Marketing Tool | `apps/web`, `apps/api`, `services/*`, `workers/`, `db/` |
| Backend routes | None (Company's Brain specific) | `/api/v1/*` (knowledge, query, admin, payments, analytics) |
| Document ingestion | None | Parse PDFs/Word → chunk → embed → store |
| Vector search | None | pgvector HNSW + tsvector parallel retrieval |
| Frontend | None | Chat interface, admin doc manager, analytics dashboard |
| Payments | None | Stripe Connect (org subscriptions + BlueOcean 15% fee) |
| Workers | None | `workers/` — re-embedding, ingestion retry |

When adding features, build into the **target layout** from the start. Shared types go in `shared/`.

---

## Agent Instructions

When implementing anything in this project:

- **Prefer editing existing files** over creating new ones
- **Complete one end-to-end flow** before polishing or refactoring
- **Keep functions small and explicit** — if a function needs a comment to explain what it does, it should be split
- **No premature abstraction** — do not generalise until the same logic appears in 3+ places
- **No speculative infrastructure** — do not introduce a new layer, pattern, or dependency because it might be useful later
- **Ask before adding dependencies** — especially anything that might not be Bun-compatible
- **Verify Bun compatibility** before using any npm package — many tools assume Node.js internals; check the package's README or issues before adding
- **Prioritise working implementations** over ideal architecture
- **Do not introduce:**
  - repositories
  - factories
  - dependency injection containers
  - event buses
  - abstract base classes
  - `Base*` or `Abstract*` classes
  - unless explicitly requested

---

## Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Runtime | Bun | Use Bun, not Node, for all scripts and server; verify npm package Bun compatibility before adding |
| Backend | Hono | TypeScript; runs on Bun |
| Frontend | Next.js | v15+; server components preferred; shadcn/ui for all UI |
| Database | PostgreSQL 16 + pgvector + pg_trgm | Single DB; pgvector for HNSW semantic search; pg_trgm for fuzzy text |
| ORM | Drizzle + postgres.js | Close to raw SQL; no heavy abstraction |
| Embeddings | OpenAI text-embedding-3-large | 1536 dimensions; computed once at ingest; cached in DB |
| AI — query synthesis | Claude Haiku 4.5 | RAG-style answer synthesis; called only after confidence gate passes |
| Payments | Stripe Connect | Org subscriptions + automatic 15% platform fee split |
| Background jobs | node-cron | No Redis, Bull, or external queue |
| Hosting | AWS Lightsail | 2 GB RAM, 2 vCPUs, 60 GB SSD — shared with Marketing Tool |

---

## Target Folder Structure

```
/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # Hono backend
├── services/
│   ├── ingestion/            # Parse, chunk, tag, embed documents
│   ├── retrieval/            # pgvector + tsvector parallel search + rerank
│   ├── synthesis/            # Claude Haiku RAG answer generation
│   ├── access-control/       # Visibility JSONB evaluation at query time
│   └── payments/             # Stripe Connect subscriptions + fee logic
├── workers/                  # node-cron jobs
├── db/
│   ├── schema/               # Drizzle schema (one file per table)
│   └── migrations/
├── shared/                   # Shared types, constants, utils
├── docker-compose.yml
└── CLAUDE.md
```

---

## Commands

### Dev

```bash
bun install                          # install dependencies (root monorepo)
bun run dev                          # start api + web
bun run dev --filter=apps/api        # api only
bun run dev --filter=apps/web        # web only
```

### Database

```bash
bun drizzle-kit generate             # generate migration from schema
bun drizzle-kit migrate              # apply migrations
bun drizzle-kit studio               # Drizzle Studio
```

### Workers

```bash
bun run workers                      # start all cron jobs
```

| Worker | Schedule | What it does |
|---|---|---|
| `re-embed-worker` | On schema change | Re-embeds chunks when embedding model or schema changes |
| `ingestion-retry` | Daily 3am | Retry failed ingestion jobs under `max_retries` |

### Tests

```bash
bun test
bun test --watch
bun test services/retrieval
```

---

## Coding Conventions

### General

- **TypeScript everywhere** — no plain JS
- **No `any`** — use proper types or `unknown` + guards
- **Async/await only** — no `.then()` chains
- **Drizzle** — explicit queries; no magic finders
- **Secrets** — `.env` only; never hardcoded
- **Errors** — log with context; never swallow silently; never throw raw errors across service boundaries
- **AI calls** — only via `services/synthesis`; never from route handlers
- **Retrieval** — only via `services/retrieval`; never inline in routes
- **Background work** — `workers/` only; no inline async jobs in HTTP handlers

### File naming

- Folders: `kebab-case`
- Files: `kebab-case.ts`
- Variables and functions: `camelCase`
- Types, interfaces, classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Route handlers

- Route handlers only orchestrate — validate input, call a service, return response
- No business logic inside route handlers
- Keep route handler files under 150 LOC
- All external input validated with Zod before use

### Services

- Services contain all business logic
- Services return `{ success: true, data }` or `{ success: false, error: { code, message } }` — never throw across service boundaries
- One responsibility per service file
- No service imports another service directly — compose in the route handler or worker

### Response contract

Every API response follows this shape:

```ts
// Success
{ success: true, data: T }

// Failure
{ success: false, error: { code: string, message: string } }
```

Never return raw error objects or stack traces to the client.

---

## Frontend Rules

- **Server components by default** — add `"use client"` only when interactivity requires it
- **TanStack Query** for live client-side data fetching and cache management
- **react-hook-form + Zod** for all forms — no uncontrolled inputs
- **shadcn/ui** for all UI components — add via `npx shadcn@latest add <component>`; import from `@/components/ui/<name>`; do not hand-edit generated components
- **Styling** — Tailwind CSS v4 with CSS variable design tokens from `globals.css`; use `oklch` values from those variables, not hardcoded colours
- **No Redux** — no global state libraries unless explicitly approved
- **No Zustand** unless explicitly approved
- **No mixing of data fetching strategies** — pick server component data fetching or TanStack Query per route; do not mix both in the same view
- Path alias: `@/*` → `src/*`

### App router structure

```
apps/web/src/
├── app/
│   ├── (auth)/               # unauthenticated routes
│   ├── (dashboard)/          # authenticated staff/admin routes
│   │   ├── chat/             # query interface
│   │   ├── documents/        # document management
│   │   └── analytics/        # analytics dashboard
│   └── layout.tsx
├── components/
│   ├── ui/                   # shadcn components (do not edit manually)
│   └── [feature]/            # feature-specific components
├── lib/
│   └── utils.ts              # cn() and shared utilities
└── app/globals.css           # design tokens
```

---

## Ingestion Pipeline

```
1. Ingest       Upload / parse PDF or Word doc
2. Chunk + Tag  org_id, compartment, access_tier, source_type, visibility JSONB
3. Embed        OpenAI text-embedding-3-large (1536d) → HNSW index
4. Store        Immutable chunk in Postgres + content hash dedup
5. Retrieve     pgvector + tsvector in parallel
6. Rerank       Deterministic weighted score + confidence gate → "I don't know" if low
7. Synthesise   Agent → grounded answer + citations only
```

**Small-to-big retrieval:** When a matching chunk is found, retrieve surrounding chunks (parent section) before synthesis. Prevents answers losing the caveat, the heading, or the action item that follows a decision.

**Response shape:** `{ answer, citations, confidence, missing }`

### Retrieval scoring

Reranking is deterministic — no LLM reranking in v1:

```
final_score = 0.7 * semantic_similarity + 0.3 * bm25_score
```

- `semantic_similarity`: cosine similarity from pgvector
- `bm25_score`: normalised tsvector rank from PostgreSQL `ts_rank`
- Confidence gate threshold: `final_score < 0.5` → return `"I don't know"`, skip synthesis
- Results merged and deduplicated before scoring; top-k = 5 chunks passed to synthesis

Do not change this formula without updating this doc.

---

## Database Schema (target)

All tables in `db/schema/`. Drizzle only — never raw `pg` client.

### Enums

```ts
access_tier:        internal | external
visibility_class:   public | restricted | confidential
compartment_mode:   autonomous | schema_driven
chunk_status:       active | processing | error | archived
org_plan:           free | paid
source_type:        hr_policy | sop | faq | case_note | compliance | product_doc | other
ingestion_status:   queued | running | complete | failed
```

### Tables

```ts
// orgs
id, name, plan (org_plan), stripe_customer_id, stripe_subscription_id,
compartment_mode, created_at, updated_at

// users
id, org_id (FK), email (UNIQUE), role (super_admin | org_admin | dept_admin | staff | external_client),
created_at, updated_at

// compartments
id, org_id (FK), name, description, mode (compartment_mode), created_at, updated_at

// documents
id, org_id (FK), compartment_id (FK), filename, access_tier, source_type,
content_hash (UNIQUE per org), status, uploaded_by (FK → users), version,
previous_version_id (FK → documents), created_at, updated_at

// chunks
id, org_id (FK), document_id (FK), compartment_id (FK),
content (TEXT),                         # raw immutable chunk text
embedding (vector(1536)),               # HNSW-indexed via pgvector
content_hash (TEXT),                    # SHA hash; unchanged re-upload is a no-op
visibility (JSONB),                     # { allowedGroups, deniedGroups, allowedPrincipals, classification }
access_tier (access_tier),              # enforced at SQL level
source_type (source_type),
chunk_index (INT),                      # position within document
parent_chunk_id (FK → chunks),          # for small-to-big retrieval
status (chunk_status),
created_at

// queries
id, org_id (FK), user_id (FK), query_text, answer, citations (JSONB),
confidence (FLOAT), missing (JSONB), access_tier, created_at

// audit_logs
id, org_id (FK), user_id (FK), action, resource_type, resource_id,
metadata (JSONB), created_at

// ingestion_jobs
id, org_id (FK), document_id (FK), status (ingestion_status),
error_message, retry_count, max_retries, started_at, completed_at, created_at

// stripe_events
id, org_id (FK), stripe_event_id (UNIQUE), event_type, payload (JSONB), processed_at
```

### Key relationships

- `users` → `orgs`: many-to-one
- `documents` → `orgs`, `compartments`: many-to-one each
- `chunks` → `documents`, `compartments`: many-to-one each
- `chunks` → `chunks` (self): `parent_chunk_id` for small-to-big retrieval
- `queries` → `orgs`, `users`: many-to-one each
- `audit_logs` → `orgs`, `users`: many-to-one each
- `ingestion_jobs` → `documents`: one-to-one

### Content hash dedup

- On upload: compute SHA hash of raw content
- If hash matches existing chunk for same `org_id` → no-op (no re-ingest, no re-embed)
- If hash differs → create new version, archive previous (`status = archived`)

### Tenant isolation enforcement

- Every table scoped by `org_id`; every query filters `org_id` first
- `visibility` JSONB evaluated at query time against requesting user's role
- `access_tier` enforced at SQL level — external pipeline cannot touch `access_tier = internal` chunks
- Automated isolation tests in CI verify no cross-org access

---

## API Routes (target)

Prefix: `/api/v1`. Internal auth only.

### Knowledge base

```
POST   /orgs/:id/documents                  # upload document
GET    /orgs/:id/documents                  # list documents (admin)
PATCH  /orgs/:id/documents/:docId           # update compartment / access tier
DELETE /orgs/:id/documents/:docId           # soft-delete + archive
```

### Query

```
POST   /orgs/:id/query                      # plain-language query → { answer, citations, confidence, missing }
GET    /orgs/:id/queries                    # query history (admin)
```

### Admin

```
POST   /orgs/:id/compartments               # create compartment
GET    /orgs/:id/compartments               # list compartments
PATCH  /orgs/:id/compartments/:cId          # update compartment config
POST   /orgs/:id/users                      # invite user
PATCH  /orgs/:id/users/:userId/role         # update role
```

### Payments

```
POST   /orgs/:id/subscriptions              # create Stripe subscription
GET    /orgs/:id/subscriptions              # current subscription status
POST   /webhooks/stripe                     # Stripe Connect webhook
```

### Analytics

```
GET    /orgs/:id/analytics/overview         # KB coverage, query volume, citation hit rate
GET    /orgs/:id/analytics/queries          # top unanswered, low-confidence queries
GET    /orgs/:id/analytics/export           # export audit log
```

---

## Environment Variables

Never hardcode. Never commit `.env`.

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/blueocean

OPENAI_API_KEY=
ANTHROPIC_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PLATFORM_FEE_PERCENT=15

NODE_ENV=development | production
PORT=3002
NEXT_PUBLIC_API_URL=http://localhost:3002
```

---

## Testing Priorities

Focus tests on security and correctness boundaries. Avoid testing implementation details.

**Write tests for:**
- Tenant isolation — a query with `org_id = A` must never return chunks from `org_id = B`
- Access control — a user's role must be checked against `visibility` JSONB before any chunk is returned
- Retrieval correctness — scoring formula returns expected top-k for known inputs
- Confidence gate — queries below threshold return `"I don't know"` and never reach synthesis
- Content hash dedup — re-uploading unchanged content is a no-op; changed content creates a new version
- Stripe fee routing — 15% platform fee applied correctly on subscription events

**Avoid:**
- Snapshot tests
- Testing Drizzle or pgvector internals
- Excessive mocking that makes tests meaningless
- Testing that a function was called — test what it returned

---

## Hard Constraints (access control & compliance)

Non-negotiable:

1. **No cross-org data access** — `org_id` on every table; every query filters it first
2. **Internal plane isolation** — external retrieval pipeline cannot touch `access_tier = internal` chunks under any circumstance, even on shared infrastructure
3. **Visibility policy enforced at query time** — a user without matching `visibility` JSONB cannot receive a chunk through any path
4. **RAG only** — no freeform generation permitted; explicit `"I don't know"` fallback when confidence below threshold
5. **Audit log all admin actions** — permission changes, document access events; exportable for compliance orgs
6. **Compliance** — PDPA (SG), GDPR, Australia Privacy Act; data processing agreements required per org before pilot
7. **Data retention** — query logs purged after 90 days; org data quarantined 30 days on cancellation then permanently deleted
8. **External publishing locked to paid tier** — `org_plan = free` cannot expose external knowledge plane
9. **Stripe platform fee** — BlueOcean automatically takes 15% via Stripe Connect; no manual payout logic

---

## AI Usage Rules

- **Query synthesis:** Claude Haiku 4.5 — called only after confidence gate passes, not on every query
- **Anti-hallucination:** RAG only; synthesise from retrieved chunks exclusively; no freeform generation
- **Confidence gate:** `final_score < 0.5` → return `{ answer: "I don't know, not in the knowledge base" }` — do not call synthesis
- **Small-to-big context:** always expand matched chunk to parent section before synthesis call
- **Citations:** every answer must cite source chunks; unsourced answers are not permitted
- **No LLM reranking in v1** — reranking is deterministic (see retrieval scoring formula above)

---

## Architecture

### System flow

```
Admin uploads document
        ↓
services/ingestion (parse → chunk → tag → embed)
        ↓
db: chunks table (content, embedding, visibility JSONB, access_tier, content_hash)
        ↓
User submits plain-language query
        ↓
services/retrieval (pgvector + tsvector parallel → deterministic rerank)
        ↓
Confidence gate: final_score < 0.5 → "I don't know"
        ↓
services/retrieval (small-to-big: expand to parent chunks)
        ↓
services/synthesis (Claude Haiku → grounded answer + citations)
        ↓
Response: { answer, citations, confidence, missing }
```

### Layer responsibilities

| Layer | Role |
|---|---|
| `apps/api` | HTTP routes (`/api/v1/*`); validates input with Zod; enforces `org_id` scoping; orchestrates services; no inline AI or direct vector calls |
| `apps/web` | Chat interface, document manager, analytics dashboard; talks to API via `NEXT_PUBLIC_API_URL` |
| `services/ingestion` | Parse PDF/Word → chunk → tag with org_id, compartment, access_tier, visibility → embed via OpenAI → store |
| `services/retrieval` | pgvector semantic + tsvector full-text in parallel; deterministic weighted rerank; confidence gate; small-to-big expansion |
| `services/synthesis` | Claude Haiku RAG generation; citation assembly; enforces no-freeform rule |
| `services/access-control` | Visibility JSONB evaluation; role-to-chunk permission resolution at query time |
| `services/payments` | Stripe Connect subscription management; platform fee routing |
| `workers/` | node-cron only — ingestion retry, re-embedding on schema change |
| `db/schema` | Drizzle models + migrations; all persistence |
| `shared/` | Types, enums, constants, cross-package utils |

---

## What Not to Build

- ERP, operations, or workflow automation features
- CRM replacement functionality
- Proprietary foundation model training
- Consumer-facing product — strictly B2B
- Redis, Bull, or external job queues — node-cron only
- LLM reranking — deterministic scoring in v1
- Repositories, factories, DI containers, event buses, abstract base classes
- Graph traversal indexes, entity alias clusters, canonical cluster review queues (stripped from upstream open-source data model)
