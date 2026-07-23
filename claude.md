# CLAUDE.md — Company's Brain

This file defines **how to build** this project. For **what to build**, refer to the PRD.

B2B SaaS knowledge platform: ingests documents → chunks + embeds → stores with row-level access control → answers plain-language queries with grounded, citation-backed responses. Two knowledge planes per org: internal (staff-only) and external (client-facing, monetised via Stripe). Multi-tenant, org-agnostic. v1 pilot: Equest school network.

---

## Current State

The repo shares a VPS and Postgres instance with the Automated Marketing Solution, but Company's Brain is its own monorepo and product. All core flows below are **built and working**:

| Area | Status |
|---|---|
| Repo layout | `apps/web`, `apps/api`, `services/*`, `workers/`, `db/`, `shared/`, `scripts/` |
| Backend routes | `/api/v1/*` — auth, orgs, documents, query, admin (compartments/users), access (groups/grants), payments, analytics, Stripe webhook |
| Auth | JWT (HS256, HttpOnly cookie) issued by `/api/v1/auth/login`; role-based permissions in `shared/constants.ts` |
| Document ingestion | PDF (`pdf-parse`) and Word (`mammoth`) → chunk (2000 chars, 200 overlap) → embed → store; retry via ingestion_jobs |
| Vector search | pgvector HNSW + tsvector parallel retrieval, RRF fusion, golden-set eval harness |
| Frontend | Login, chat, documents (upload/preview/archive/delete), users & groups, compartments (settings), audit log, analytics, orgs (super admin) |
| Payments | Stripe Connect: org subscription, connect onboarding, external client checkout with 15% platform fee, billing portal, webhook |
| Workers | ingestion-retry (03:00), query-log-purge (03:30), org-data-purge (04:00); re-embed runs manually |

**Known gaps** (documented, not yet built): `parent_chunk_id` is never set at ingest, so small-to-big expansion in `services/retrieval` is currently a no-op; chunking is context-free (heading/section-aware chunking planned — measure against the golden set before changing).

When adding features, build into this layout. Shared types go in `shared/`.

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
| Database | PostgreSQL 17 + pgvector + pg_trgm | `pgvector/pgvector:pg17` Docker image; pgvector for HNSW semantic search; pg_trgm for fuzzy text |
| Auth | Hand-rolled JWT (HS256) | `apps/api/src/lib/jwt.ts` via `node:crypto`; HttpOnly cookie; no auth library |
| Email | nodemailer over SMTP | Invite + welcome emails; templates in `apps/api/src/email-templates/` |
| ORM | Drizzle + postgres.js | Close to raw SQL; no heavy abstraction |
| Embeddings | OpenAI text-embedding-3-large | 1536 dimensions; computed once at ingest; cached in DB |
| AI — query synthesis | Claude Haiku 4.5 | RAG-style answer synthesis; called only after confidence gate passes |
| Payments | Stripe Connect | Org subscriptions + automatic 15% platform fee split |
| Background jobs | node-cron | No Redis, Bull, or external queue |
| Hosting | AWS Lightsail | 2 GB RAM, 2 vCPUs, 60 GB SSD — shared with Marketing Tool |

---

## Folder Structure

```
/
├── apps/
│   ├── web/                  # Next.js frontend (+ /api proxy routes to the Hono API)
│   └── api/                  # Hono backend (routes, auth middleware, jwt/email libs)
├── services/
│   ├── ingestion/            # Parse, chunk, tag, embed documents
│   ├── retrieval/            # pgvector + tsvector parallel search + RRF fusion
│   ├── synthesis/            # Claude Haiku RAG answer generation + follow-up query rewriting
│   ├── access-control/       # Visibility JSONB + compartment grant evaluation at query time
│   └── payments/             # Stripe Connect subscriptions + fee logic
├── workers/                  # node-cron jobs (ingestion-retry, retention purges, manual re-embed)
├── db/
│   ├── schema/               # Drizzle schema (one file per table)
│   ├── migrations/
│   ├── init.sql              # extensions (vector, pg_trgm) — auto-applied by docker-compose
│   └── post-migrate.sql      # HNSW/GIN/perf indexes — run manually after migrations
├── scripts/                  # setup.ts (seed org + admin), eval-retrieval.ts, golden-set.json
├── shared/                   # Shared types, constants, utils
├── docker-compose.yml        # db + api + web containers
└── CLAUDE.md
```

---

## Commands

### Dev

```bash
bun install                                    # install dependencies (root monorepo)
bun run dev                                    # start api (3002) + web (3000)
bun run --filter '@company-brain/api' dev      # api only
bun run --filter '@company-brain/web' dev      # web only
```

Workspace packages are named `@company-brain/*` — use those names with `--filter`, not paths.

### Database

```bash
docker compose up -d db                        # local Postgres 17 + pgvector (applies db/init.sql on first run)
bun db:generate                                # generate migration from schema
bun db:migrate                                 # apply migrations
bun db:studio                                  # Drizzle Studio
psql $DATABASE_URL -f db/post-migrate.sql      # HNSW + FTS + perf indexes (one-time, after first migrate)
```

### Seed

```bash
SETUP_ORG_NAME="..." SETUP_ADMIN_EMAIL="..." SETUP_ADMIN_PASSWORD="..." bun run scripts/setup.ts
```

### Workers

```bash
bun run workers                      # start all cron jobs
```

| Worker | Schedule | What it does |
|---|---|---|
| `ingestion-retry` | Daily 03:00 | Retry failed ingestion jobs under `max_retries` |
| `query-log-purge` (`retention.ts`) | Daily 03:30 | Delete query logs older than 90 days |
| `org-data-purge` (`retention.ts`) | Daily 04:00 | Permanently delete org data 30 days after cancellation |
| `re-embed-worker` | Manual (not scheduled) | Re-embeds all active chunks after an embedding model change |

### Tests

```bash
bun test
bun test --watch
bun test services/retrieval
bun scripts/eval-retrieval.ts        # retrieval quality eval vs scripts/golden-set.json (needs local DB + OPENAI_API_KEY)
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
│   ├── (auth)/
│   │   └── login/            # login page
│   ├── (dashboard)/          # authenticated staff/admin routes
│   │   ├── chat/             # query interface
│   │   ├── documents/        # document management (upload, preview, archive, delete)
│   │   ├── users/            # user + group management
│   │   ├── settings/         # compartments, grants, billing
│   │   ├── audit/            # audit log viewer
│   │   ├── analytics/        # analytics dashboard
│   │   └── orgs/             # org management (super_admin only)
│   ├── api/
│   │   ├── auth/             # login/logout proxy routes (set/clear the JWT cookie)
│   │   └── v1/[...path]/     # catch-all proxy → Hono API via API_INTERNAL_URL
│   └── layout.tsx
├── components/
│   ├── ui/                   # shadcn components (do not edit manually)
│   └── [feature]/            # feature-specific components
├── lib/
│   └── utils.ts              # cn() and shared utilities
└── app/globals.css           # design tokens
```

All browser API calls go through the Next.js proxy routes (`/api/v1/...`) — the Hono API on port 3002 is never called directly from the browser.

---

## Ingestion Pipeline

```
1. Ingest       Upload / parse PDF or Word doc
2. Chunk + Tag  org_id, compartment, access_tier, source_type, visibility JSONB
3. Embed        OpenAI text-embedding-3-large (1536d) → HNSW index
4. Store        Immutable chunk in Postgres + content hash dedup
5. Retrieve     pgvector + tsvector in parallel
6. Rerank       Deterministic RRF fusion + confidence gate → "I don't know" if low
7. Synthesise   Agent → grounded answer + citations only
```

**Small-to-big retrieval:** When a matching chunk is found, retrieve surrounding chunks (parent section) before synthesis. Prevents answers losing the caveat, the heading, or the action item that follows a decision. ⚠️ **Currently inactive:** the expansion query exists in `services/retrieval`, but ingestion never sets `parent_chunk_id`, so it is a no-op (known gap).

**Follow-up questions:** When the client sends conversation `history`, the question is first rewritten into a standalone search query (`contextualizeQuery` in `services/synthesis`) before retrieval, and the confidence gate is skipped so conversational requests ("summarise that") reach synthesis.

**Response shape:** `{ answer, citations, confidence, missing }`

### Retrieval scoring

Reranking is deterministic — no LLM reranking in v1. The two ranked lists
(pgvector cosine, tsvector `ts_rank`) are fused with Reciprocal Rank Fusion:

```
final_score = Σ over lists containing the chunk of  1 / (60 + rank)
```

- RRF fuses by rank, not raw score, so cosine similarity and `ts_rank` never need a common scale
- Full-text side uses `websearch_to_tsquery` with terms OR-ed, so natural-language questions match on partial term overlap and `ts_rank` rewards chunks matching more terms
- Confidence = best cosine similarity among the top-k candidates (RRF scores are rank-based and carry no relevance signal across queries)
- Confidence gate threshold: `confidence < 0.25` → return `"I don't know"`, skip synthesis. On text-embedding-3-large, on-topic paraphrases score ~0.28–0.55; clearly off-topic queries < 0.25. Borderline queries pass through to synthesis, which is RAG-only and refuses when the chunks lack the answer
- Results merged and deduplicated before scoring; top-k = 5 chunks passed to synthesis

Do not change this formula without updating this doc. Measure changes against
the golden set first: `bun scripts/eval-retrieval.ts` (requires local DB +
`OPENAI_API_KEY`; golden set in `scripts/golden-set.json`).

---

## Database Schema

All tables in `db/schema/` (one file per table). Drizzle only — never raw `pg` client. **JSONB columns must use the custom `jsonb` type from `db/schema/jsonb.ts`, never the one from `drizzle-orm/pg-core`** (the pg-core one double-encodes with postgres.js).

### Enums

```ts
access_tier:        internal | external
chunk_status:       active | processing | error | archived
org_plan:           free | paid
source_type:        hr_policy | sop | faq | case_note | compliance | product_doc | other
ingestion_status:   queued | running | complete | failed | archived
user_role:          super_admin | org_admin | dept_admin | staff | external_client
```

### Tables

```ts
// orgs
id, name, plan (org_plan), stripe_customer_id, stripe_subscription_id,
stripe_connect_account_id, stripe_connect_charges_enabled, external_price_cents,
cancelled_at,                           # set on cancellation; starts 30-day quarantine
created_at, updated_at

// users
id, org_id (FK), name (nullable),        # collected on invite; null for users predating this field
email (UNIQUE), password_hash, role (user_role),
stripe_customer_id, stripe_subscription_id, subscription_status,   # external-client billing
created_at, updated_at

// compartments
id, org_id (FK), name, description,
restricted (BOOL),                      # restricted compartments need a grant to access
parent_compartment_id (FK → compartments),  # sub-compartments; one level of nesting only
created_at, updated_at

// groups                               # named user groups for access grants
id, org_id (FK), name (UNIQUE per org), description, created_at, updated_at

// group_members
id, org_id (FK), group_id (FK), user_id (FK), created_at   # UNIQUE (group_id, user_id)

// compartment_grants                   # grants restricted-compartment access to one user OR one group
id, org_id (FK), compartment_id (FK), user_id (FK, nullable), group_id (FK, nullable),
granted_by (FK → users), created_at    # one-of user/group enforced by SQL CHECK

// documents
id, org_id (FK), compartment_id (FK), filename, access_tier, source_type,
content_hash (UNIQUE per org), status (ingestion_status), uploaded_by (FK → users), version,
previous_version_id, created_at, updated_at

// chunks
id, org_id (FK), document_id (FK), compartment_id (FK),
content (TEXT),                         # raw immutable chunk text
embedding (vector(1536)),               # HNSW-indexed via pgvector
content_hash (TEXT),                    # SHA hash; unchanged re-upload is a no-op
visibility (JSONB),                     # { allowedRoles, deniedRoles, allowedPrincipals, classification }
access_tier (access_tier),              # enforced at SQL level
source_type (source_type),
chunk_index (INT),                      # position within document
parent_chunk_id,                        # for small-to-big retrieval (currently never set — known gap)
status (chunk_status),
created_at

// queries
id, org_id (FK), user_id (FK), query_text, answer, citations (JSONB),
confidence (REAL), missing (JSONB), access_tier, created_at

// audit_logs
id, org_id (FK), user_id (FK), action, resource_type, resource_id,
metadata (JSONB), created_at

// ingestion_jobs
id, org_id (FK), document_id (FK), status (ingestion_status),
error_message, retry_count, max_retries, started_at, completed_at, created_at

// stripe_events
id, org_id (FK), stripe_event_id (UNIQUE), event_type, payload (JSONB), processed_at

// password_reset_tokens
id, user_id (FK), token_hash,               # SHA-256 hash; raw token only ever exists in the emailed link
expires_at, used_at, created_at
```

### Key relationships

- `users` → `orgs`: many-to-one
- `documents` → `orgs`, `compartments`: many-to-one each
- `chunks` → `documents`, `compartments`: many-to-one each
- `chunks` → `chunks` (self): `parent_chunk_id` for small-to-big retrieval
- `compartments` → `compartments` (self): `parent_compartment_id`; one level only, access to a sub-compartment always requires access to its parent
- `groups` ↔ `users`: many-to-many via `group_members`
- `compartment_grants` → `compartments` + exactly one of `users` / `groups`
- `queries` → `orgs`, `users`: many-to-one each
- `audit_logs` → `orgs`, `users`: many-to-one each
- `ingestion_jobs` → `documents`: one-to-one
- `password_reset_tokens` → `users`: many-to-one

### Content hash dedup

- On upload: compute SHA hash of raw content
- If hash matches existing chunk for same `org_id` → no-op (no re-ingest, no re-embed)
- If hash differs → create new version, archive previous (`status = archived`)

### Tenant isolation enforcement

- Every table scoped by `org_id`; every query filters `org_id` first
- `visibility` JSONB evaluated at query time against requesting user's role
- `access_tier` enforced at SQL level — external pipeline cannot touch `access_tier = internal` chunks
- Isolation is covered by unit tests (`bun test` — access-control, auth middleware); there is **no CI pipeline yet**, so run tests locally before pushing

---

## API Routes

Prefix: `/api/v1`. All routes except `/auth/*` and `/webhooks/stripe` require the JWT cookie (`authMiddleware`); org-scoped routes additionally enforce that the token's `orgId` matches `:id` (`orgIsolationMiddleware`).

### Auth (public)

```
POST   /auth/login                          # email + password (+ optional rememberMe) → sets HttpOnly JWT cookie
POST   /auth/logout                         # clears cookie
POST   /auth/forgot-password                # { email } → always returns a generic response; emails a reset link if the account exists
POST   /auth/reset-password                 # { token, newPassword } → consumes a single-use password_reset_tokens row
```

### Orgs (super_admin)

```
GET    /orgs                                # list orgs
POST   /orgs                                # create org + first org_admin
```

### Knowledge base

```
GET    /orgs/:id/documents                  # list documents (paginated; filtered by caller's access)
POST   /orgs/:id/documents                  # upload document (multipart form: file, compartmentId, accessTier, sourceType)
GET    /orgs/:id/documents/:docId/content   # stitched document text for preview
PATCH  /orgs/:id/documents/:docId           # update compartment / access tier / source type
POST   /orgs/:id/documents/:docId/archive   # archive (chunks excluded from retrieval)
POST   /orgs/:id/documents/:docId/unarchive
DELETE /orgs/:id/documents/:docId           # hard delete (typed confirmation in UI)
```

### Query

```
POST   /orgs/:id/query                      # { query, accessTier?, sourceTypes?, history? } → { answer, citations, confidence, missing }
GET    /orgs/:id/query                      # query history
```

### Admin (compartments + users)

```
GET    /orgs/:id/compartments               # list compartments (with grant counts)
POST   /orgs/:id/compartments               # create compartment / sub-compartment
PATCH  /orgs/:id/compartments/:cId          # update name / description / restricted
DELETE /orgs/:id/compartments/:cId          # delete compartment + its documents/chunks (typed confirmation)
GET    /orgs/:id/users                      # list users
POST   /orgs/:id/users                      # invite user (sends email)
PATCH  /orgs/:id/users/:userId/role         # update role
DELETE /orgs/:id/users/:userId              # remove user
```

### Account (self-service, any authenticated role)

```
PATCH  /orgs/:id/account/password           # { currentPassword, newPassword } — operates on the caller's own userId; no permission check needed
```

### Access (groups + grants) — `users:manage` permission

```
GET    /orgs/:id/groups                     # list groups
POST   /orgs/:id/groups                     # create group
PATCH  /orgs/:id/groups/:gId
DELETE /orgs/:id/groups/:gId
GET    /orgs/:id/groups/:gId/members
PUT    /orgs/:id/groups/:gId/members        # replace member list
PUT    /orgs/:id/users/:userId/groups       # replace a user's group memberships
GET    /orgs/:id/compartments/:cId/grants
PUT    /orgs/:id/compartments/:cId/grants   # replace grant list (users and/or groups)
```

### Payments

```
POST   /orgs/:id/subscriptions              # create org Stripe subscription
GET    /orgs/:id/subscriptions              # current subscription status
DELETE /orgs/:id/subscriptions              # cancel (starts 30-day quarantine)
POST   /orgs/:id/connect-account            # start Stripe Connect onboarding → link
GET    /orgs/:id/connect-account            # Connect account status
GET    /orgs/:id/external-pricing           # external plane price
PATCH  /orgs/:id/external-pricing           # set external plane price (paid orgs)
POST   /orgs/:id/upgrade                    # org upgrade checkout session
POST   /orgs/:id/checkout                   # external client checkout (15% platform fee)
POST   /orgs/:id/billing-portal             # Stripe billing portal session
POST   /webhooks/stripe                     # Stripe webhook (public; signature-verified; idempotent via stripe_events)
```

### Analytics

```
GET    /orgs/:id/analytics/overview         # KB coverage, query volume, citation hit rate
GET    /orgs/:id/analytics/queries          # top unanswered, low-confidence queries
GET    /orgs/:id/analytics/audit-logs       # paginated audit log
GET    /orgs/:id/analytics/export           # export audit log (CSV)
```

---

## Environment Variables

Never hardcode. Never commit `.env`.

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/blueocean
POSTGRES_USER=                       # docker-compose only
POSTGRES_PASSWORD=                   # docker-compose only

JWT_SECRET=                          # signs auth cookies (HS256)

OPENAI_API_KEY=
ANTHROPIC_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ORG_PRICE_ID=                 # price ID for the org subscription plan
STRIPE_PLATFORM_FEE_PERCENT=15

SMTP_HOST=                           # invite/welcome emails (nodemailer)
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

NODE_ENV=development | production
PORT=3002
NEXT_PUBLIC_WEB_URL=http://localhost:3000   # CORS origin + links in emails
API_INTERNAL_URL=http://localhost:3002      # Next.js proxy → Hono API (defaults to http://api:3002 for Docker)
NEXT_PUBLIC_API_URL=http://localhost:3002   # docker build arg only; browser traffic goes through the Next.js proxy
NEXT_PUBLIC_SUPPORT_EMAIL=                  # mailto: target for "Contact Administrator" on the login page
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
- **Confidence gate:** best cosine similarity `< 0.25` → return `{ answer: "I don't know, not in the knowledge base" }` — do not call synthesis. Exception: skipped when conversation `history` is present, so follow-ups ("summarise that") reach synthesis — synthesis is still RAG-only and refuses when chunks lack the answer
- **Follow-up rewriting:** with `history`, `contextualizeQuery` (also Claude Haiku, in `services/synthesis`) rewrites the question into a standalone search query before retrieval
- **Small-to-big context:** expand matched chunk to parent section before synthesis call (currently a no-op — `parent_chunk_id` never set at ingest; known gap)
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
services/retrieval (pgvector + tsvector parallel → deterministic RRF fusion)
        ↓
Confidence gate: best cosine similarity < 0.25 → "I don't know"
        ↓
services/retrieval (small-to-big: expand to parent chunks — currently no-op, see Known gaps)
        ↓
services/synthesis (Claude Haiku → grounded answer + citations)
        ↓
Response: { answer, citations, confidence, missing }
```

### Layer responsibilities

| Layer | Role |
|---|---|
| `apps/api` | HTTP routes (`/api/v1/*`); validates input with Zod; enforces `org_id` scoping; orchestrates services; no inline AI or direct vector calls |
| `apps/web` | Chat, documents, users/groups, settings, audit, analytics, orgs; browser calls go through Next.js proxy routes (`/api/v1/[...path]` → `API_INTERNAL_URL`) |
| `services/ingestion` | Parse PDF/Word → chunk → tag with org_id, compartment, access_tier, visibility → embed via OpenAI → store |
| `services/retrieval` | pgvector semantic + tsvector full-text in parallel; deterministic RRF fusion; confidence gate; small-to-big expansion |
| `services/synthesis` | Claude Haiku RAG generation; citation assembly; enforces no-freeform rule |
| `services/access-control` | Visibility JSONB evaluation; restricted-compartment grant checks (user/group); role-to-chunk permission resolution at query time |
| `services/payments` | Stripe Connect subscription management; platform fee routing |
| `workers/` | node-cron only — ingestion retry, query-log purge (90d), org-data purge (30d quarantine); manual re-embed script |
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
