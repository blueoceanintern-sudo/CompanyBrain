# Company's Brain — Operations, Access & Compliance

> **Audience:** the successor and their manager **only**. Contains credential locations and operational access details — do not circulate.
> **Rule for this document:** record where secrets live and who owns accounts. Never paste secret values here.

## Contents

- [1. Environments & topology](#1-environments--topology)
- [2. Deploy procedure](#2-deploy-procedure)
- [3. Credentials & accounts inventory](#3-credentials--accounts-inventory)
- [4. Stripe configuration](#4-stripe-configuration)
- [5. Email (SMTP)](#5-email-smtp)
- [6. Database, backups & data](#6-database-backups--data)
- [7. Compliance obligations](#7-compliance-obligations)
- [8. Support & escalation](#8-support--escalation)
- [9. Handover checklist](#9-handover-checklist)

---

## 1. Environments & topology

**Production** runs on an AWS Lightsail VPS (2 GB RAM, 2 vCPUs, 60 GB SSD), **shared with the Automated Marketing Solution** — mind the memory headroom; batch sizes in ingestion and re-embedding are tuned for this box.

Production is **deployed via Coolify, as two separate application resources (`web` and `api`) — not as a single `docker-compose.yml` stack.** `docker-compose.yml` still exists and is used for local dev (`docker compose up -d db`), but in production each Coolify app builds from its own Dockerfile and gets its own env vars configured directly in the Coolify UI. The `environment:` blocks in `docker-compose.yml` do not apply in production — don't use them as a reference for what a prod app actually has; check each app's Coolify config individually.

| Resource | Build | Port | Notes |
|---|---|---|---|
| `db` | `pgvector/pgvector:pg16` | 5432 (internal) | Postgres + pgvector + pg_trgm. Whether the DB runs as a Coolify resource or separately is **not verifiable from the current codebase**. |
| `api` | `apps/api/Dockerfile` | 3002 | Hono API. On container start it runs migrations, the setup/seed scripts, then boots the server. Env vars are set in Coolify's app config, not compose. |
| `web` | `apps/web/Dockerfile` | 3000 | Next.js; proxies API calls server-side via `API_INTERNAL_URL` (must be set — see §2 gotchas). |

- VPS IP / hostname, SSH access method (key location, user), the domain(s) pointing at it, and how TLS is terminated are **not verifiable from the current codebase** — record them here at handover. Production may be served over plain HTTP; if so, adding TLS is the real fix for the cookie-`Secure` and `crypto.randomUUID` issues noted in §2.
- Whether a production `.env` file is still used (now that env vars live per-app in Coolify) is **not verifiable from the current codebase** — record it here.
- **No GitHub webhook is configured** (missing repo permissions) — deploys are triggered manually via Coolify's "Redeploy" button per app, not automatically on push to `Production`.
- 🔴 **Workers are NOT running in production.** The cron workers (`bun run workers`) are not part of either Coolify app, and only `web`/`api` Dockerfiles exist — nothing runs the process. **Consequence: the 90-day query-log purge and 30-day org-data purge in §7 are not executing — a live compliance gap.** Fix: run `bun run workers` as a real prod process — a third Coolify app, or a systemd unit / cron on the VPS (mind the shared 2 GB box). After deploying, confirm in logs that the retention jobs fire. **Flag this to your manager now**, before the fix lands.
  - Related: `bun run re-embed` (manual embedding rebuild) runs from the same `workers/` package but is a one-shot command, not a long-running process. Run it on demand after an embedding-model change. See `02_Technical_Handover.md` → "Workers".

> 📊 **[DIAGRAM: deployment topology — one box per container plus the workers process, ports, what is public vs internal. Base it on the mermaid diagram in 02_Technical_Handover.md Part I.]**

## 2. Deploy procedure

The deployed branch is **`Production`**; development happens on `main` (PRs target `main`, then `main` is merged into `Production`). Deploy = merge to `Production`, then manually hit **Redeploy** on each Coolify app (`web`, `api`) — there is no webhook, so pushing alone does nothing.

- **Database migrations in production** run automatically: the `api` container's start command executes `drizzle-kit migrate` before booting. The HNSW/GIN indexes in `db/post-migrate.sql` are **not** part of migrations and must be applied manually once against the prod DB (and again after any restore into a fresh database — see §6).
- **Rollback** if a deploy breaks: revert the offending commit on `Production` and redeploy both apps. A tested rollback procedure is **not verifiable from the current codebase** — validate and document one during the first supervised deploy.

**Coolify two-app gotchas (these have all bitten before):**

- `API_INTERNAL_URL` (web app) must point somewhere the web container can actually reach the api app. `http://api:3002` only resolves inside a shared `docker-compose` network and does **not** work across two independent Coolify apps — use the api app's actual Coolify-assigned URL.
- `NEXT_PUBLIC_API_URL` (web app **build arg**, not runtime env) must stay **empty**. It's baked into the client bundle; if set, the browser calls the API's origin directly instead of going through the Next.js proxy, which breaks auth — the `auth_token` cookie is scoped to the web app's host and never gets attached to a cross-origin request. Symptom: a login loop with a `204` (CORS preflight) then `401` on every API call.
- `JWT_SECRET` must be byte-identical on both apps, **and both must be redeployed** after any edit — Coolify only applies env-var changes on the next container start, so the value shown in its UI can silently diverge from what a running container actually has. Any `auth_token` cookie issued under an old secret is permanently stale; log out and back in after rotating.
- Production over plain HTTP: `crypto.randomUUID()` is only available in secure contexts (HTTPS/localhost), so client code calling it directly throws in the browser. The code guards against this with a fallback (`apps/web/src/lib/utils.ts` → `generateId()`), but adding TLS in Coolify is the real fix and also lets the auth cookie be marked `Secure`.
- Login fails over plain HTTP because a `Secure` cookie is silently dropped by the browser: login returns `200` but the `auth_token` never stores, so every request is unauthenticated and you bounce back to the login page. **Real fix: serve over HTTPS** (the Coolify-assigned `*.sslip.io` domain is a real domain Let's Encrypt can issue for — set the app's domain to `https://…` and redeploy; port 80 is already open, 443 must be too). **Temporary unblock without TLS:** set `COOKIE_SECURE=false` on **both** the `web` and `api` apps (web sets the login cookie, api sets the password-change cookie) and redeploy both. This is a security downgrade — the session token then travels in cleartext and can be sniffed — so remove it once TLS is in place. The auth-cookie `Secure` flag is set at `apps/web/src/app/api/auth/login/route.ts`, `apps/api/src/routes/auth.ts`, and `apps/api/src/routes/account.ts`.

## 3. Credentials & accounts inventory

**Locations and owners only — no values.** Account owners and secret storage locations are operational facts **not verifiable from the current codebase**; fill them in at handover.

| Service | Used for | Account owner | Where the secret lives | Notes |
|---|---|---|---|---|
| GitHub (`blueoceanintern-sudo/CompanyBrain`) | Source code | *fill in* | — | Transfer repo ownership or add successor as admin |
| AWS Lightsail | VPS hosting | *fill in* | SSH key location: *fill in* | Shared with Marketing Tool — coordinate before resizing/rebooting |
| OpenAI | Embeddings (`text-embedding-3-large`) | *fill in* | `OPENAI_API_KEY` | Billing limit / who pays: *fill in* |
| Anthropic | Chat synthesis (Claude Haiku 4.5 default) | *fill in* | `ANTHROPIC_API_KEY` | Billing limit / who pays: *fill in* |
| Stripe (platform account) | Subscriptions + Connect + 15% fee | *fill in* | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | See §4 |
| SMTP provider | Invite/welcome/reset emails | *fill in* | `SMTP_*` | See §5 |
| Postgres (prod) | Data | — | `POSTGRES_USER` / `POSTGRES_PASSWORD` | DB name `blueocean` |
| `JWT_SECRET` | Signs auth cookies | — | Coolify app config | ⚠️ Rotating it logs every user out — acceptable, but do it deliberately (§2) |
| `COOKIE_SECURE` | Overrides the auth-cookie `Secure` flag | — | Coolify app config (both `web` and `api`) | Optional. Unset → `Secure` in production. `false` = allow login over plain HTTP (security downgrade — remove once on TLS); see §2 |
| Domain registrar / DNS | — | *fill in* | — | — |

**AI provider configuration:** the chat and embedding providers are env-driven (`AI_*` variables — see `CLAUDE.md` → "Environment Variables"). Defaults use Anthropic for chat and OpenAI for embeddings, so both API keys above are required as configured. If a provider is pointed at a local/OpenAI-compatible endpoint via `AI_CHAT_BASE_URL` / `AI_EMBEDDING_BASE_URL`, that provider's cloud key is no longer needed.

**Off-boarding note:** the repo's git history and the seeded admin account use `blueoceanintern@gmail.com`. Before departure: transfer GitHub ownership, move any accounts registered to that address, and hand over or rotate every key above.

## 4. Stripe configuration

- Model: **Stripe Connect**. Orgs onboard as connected accounts; external-client payments carry `application_fee_percent` = `STRIPE_PLATFORM_FEE_PERCENT` (15) routed to the BlueOcean platform account. No manual payout logic exists anywhere — do not add any.
- `STRIPE_ORG_PRICE_ID` is the Price ID for the org subscription plan. Which product/price this maps to in the Stripe dashboard, and whether it's live- or test-mode, is **not verifiable from the current codebase** — record it here.
- Webhook: Stripe must point at `POST /api/v1/webhooks/stripe` on the production host. It is signature-verified with `STRIPE_WEBHOOK_SECRET` and made idempotent via the `stripe_events` table. Whether the endpoint is registered in the Stripe dashboard, and which events it subscribes to, is **not verifiable from the current codebase** — confirm and record it here.
- Test cards / test mode: use Stripe test mode against local dev; never point local dev at live keys.

## 5. Email (SMTP)

Invite, welcome, and password-reset emails are sent via nodemailer (`apps/api/src/lib/email.ts`); templates in `apps/api/src/email-templates/` (`user-invite.html`, `org-admin-welcome.html`, `password-reset.html`). The sender address comes from `SMTP_FROM`; links in emails are built from `NEXT_PUBLIC_WEB_URL` — if the domain changes, update that env var or invite and reset links will point at the old host.

Provider name, dashboard login owner, sending domain / SPF status, and any sending limits are **not verifiable from the current codebase** — record them here.

## 6. Database, backups & data

- A single Postgres instance (docker volume `pgdata`) holds all orgs' data. DB name: `blueocean`. The compose image is `pgvector/pgvector:pg16`.
- **Backups:** whether any exist (Lightsail snapshots, `pg_dump` cron, etc.) is **not verifiable from the current codebase**. Confirm and record the honest answer here. If the answer is "none", list it as the top operational risk — a lost volume would be unrecoverable customer data.
- **Restore procedure:** **not verifiable from the current codebase.** If backups exist, document one tested restore. An untested backup is not a backup.
- The HNSW/GIN indexes come from `db/post-migrate.sql` and are **not** created by migrations — after any restore into a fresh database, run it again.

## 7. Compliance obligations

These are commitments, not aspirations — they're in the product's hard constraints (`CLAUDE.md` → "Hard Constraints"):

| Obligation | Mechanism | Status |
|---|---|---|
| Query logs purged after **90 days** | `workers/retention.ts` → `query-log-purge`, daily 03:30 | Code works, but 🔴 **NOT running in prod** — workers process undeployed (§1). Obligation currently unmet. |
| Org data quarantined **30 days** after cancellation, then permanently deleted | `orgs.cancelled_at` + `org-data-purge`, daily 04:00 | Code works, but 🔴 **NOT running in prod** — same cause (§1). Obligation currently unmet. |
| Audit log of all admin actions, exportable | `audit_logs` table + Audit page + CSV export | Implemented |
| No cross-org access; internal plane isolation | `org_id` scoping + `access_tier` at SQL level + isolation middleware | Implemented; covered by unit tests (no CI — run `bun test`) |
| Data processing agreement (DPA) **per org before pilot** | Process, not code | Whether Equest's DPA is signed and where it's stored is **not verifiable from the current codebase** — record it here. |
| PDPA (SG) / GDPR / Australia Privacy Act | Above mechanisms + DPA | Legal review notes and open items are **not verifiable from the current codebase** — record them here. |

## 8. Support & escalation

- Who Equest users contact when something breaks, and who at BlueOcean owns this product after the current maintainer leaves, is **not verifiable from the current codebase** — record it here.
- Any existing support channel (email inbox, WhatsApp group, etc.) is **not verifiable from the current codebase** — record it here.
- First-response playbook for "the app is down":
  1. `ssh` to the VPS → `docker ps` (are `db`/`api`/`web` up?) → check the `api` container logs.
  2. Check disk space (`df -h`) — a 60 GB shared box fills up.
  3. Restart the affected containers (state is in the `pgdata` volume; containers are safe to recreate). In Coolify, redeploy the app.
  4. If only AI answers fail: check the OpenAI/Anthropic status pages and API-key billing before touching the server.

## 9. Handover checklist

For the final handover session — check off together with the successor:

- [ ] Successor has GitHub access (admin) and has cloned and run the app locally per `README.md`
- [ ] Successor has SSH access to the VPS and has performed **one supervised deploy**
- [ ] Successor has logins (or ownership transfer) for every service in §3
- [ ] Production secrets transferred securely (password manager — not email/chat)
- [ ] Workers confirmed running in production; retention jobs verified in logs (§1, §7)
- [ ] Backup status confirmed and §6 filled in truthfully
- [ ] Stripe webhook verified firing against production (Stripe dashboard → recent deliveries)
- [ ] Walkthrough of `02_Technical_Handover.md` Part III (known issues) done
- [ ] `blueoceanintern@gmail.com`-owned accounts transferred or rotated
- [ ] All three handover docs re-read once and every "not verifiable" / "fill in" item resolved
