# Company's Brain — Operations, Access & Compliance

> **Audience:** the successor and their manager **only**. Contains credential locations and operational access details — do not circulate.
> **Rule for this document: record where secrets live and who owns accounts. Never paste secret values here.**
> **Last verified:** 2026-07-20, commit `d18e218`.

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

**Production** runs on an AWS Lightsail VPS (2 GB RAM, 2 vCPUs, 60 GB SSD), **shared with the Automated Marketing Solution** — mind the memory headroom; batch sizes in ingestion/re-embedding are tuned for this box.

Three containers via `docker-compose.yml`:

| Container | Image/build | Port | Notes |
|---|---|---|---|
| `db` | `pgvector/pgvector:pg17` | 5432 (internal) | Volume `pgdata`; `db/init.sql` auto-applied on first boot (extensions) |
| `api` | `apps/api/Dockerfile` | 3002 | Hono API; env injected from compose |
| `web` | `apps/web/Dockerfile` | 3000 | Next.js; proxies API calls server-side to `http://api:3002` |

- `TODO(Tori): VPS IP / hostname, SSH access method (key location, user), and the domain(s) pointing at it + how TLS is terminated (Caddy? nginx? Lightsail LB? none?)`
- `TODO(Tori): where the production .env file lives on the VPS and who else has a copy`
- ⚠️ **Workers:** the cron workers (`bun run workers`) are **not** part of docker-compose. `TODO(Tori): document how workers run in production (systemd? tmux? not running?!). If they are not running, the 90-day/30-day retention guarantees in §7 are currently not being met — flag this to your manager.`

> 📊 **[DIAGRAM: deployment topology — one box per container + workers process, ports, what is public vs internal. Base it on the mermaid diagram in 02_Technical_Handover.md Part I.]**

## 2. Deploy procedure

The deployed branch is **`Production`**; development happens on `main` (PRs target `main`, then `main` is merged into `Production`).

`TODO(Tori): replace this block with the exact commands you actually run, in order. Presumed shape:`

```bash
ssh <vps>
cd <repo path>
git pull origin Production
docker compose build api web
docker compose up -d
# workers: <however they are restarted>
```

- Database migrations in production: `TODO(Tori): how are bun db:migrate and db/post-migrate.sql run against the prod DB?`
- Rollback: `TODO(Tori): what you'd do if a deploy breaks (git checkout previous commit + rebuild?)`
- Known deploy gotchas already hit: compose needs `PORT`/`NODE_ENV` hardcoded (commit `c13addc`); all API env vars must be passed through compose (commit `0606e54`); auth cookies on plain HTTP needed a fix (commit `3ccc06b`) — if TLS is added later, revisit cookie `Secure` flags.

## 3. Credentials & accounts inventory

**Locations and owners only — no values.**

| Service | Used for | Account owner / email | Where the secret lives | Notes |
|---|---|---|---|---|
| GitHub (`blueoceanintern-sudo/CompanyBrain`) | Source code | `TODO(Tori)` | — | Transfer repo ownership or add successor as admin |
| AWS Lightsail | VPS hosting | `TODO(Tori)` | `TODO: SSH key location` | Shared with Marketing Tool — coordinate before resizing/rebooting |
| OpenAI | Embeddings (`text-embedding-3-large`) | `TODO(Tori)` | prod `.env` → `OPENAI_API_KEY` | `TODO: billing limit / who pays` |
| Anthropic | Claude Haiku 4.5 synthesis | `TODO(Tori)` | prod `.env` → `ANTHROPIC_API_KEY` | `TODO: billing limit / who pays` |
| Stripe (platform account) | Subscriptions + Connect + 15% fee | `TODO(Tori)` | prod `.env` → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | See §4 |
| SMTP provider | Invite/welcome emails | `TODO(Tori): which provider?` | prod `.env` → `SMTP_*` | See §5 |
| Postgres (prod) | Data | — | compose env → `POSTGRES_USER` / `POSTGRES_PASSWORD` | DB name `blueocean` |
| `JWT_SECRET` | Signs auth cookies | — | prod `.env` | ⚠️ Rotating it logs every user out (sessions invalidate) — acceptable, but do it deliberately |
| `TODO(Tori): domain registrar / DNS` | — | `TODO` | — | — |

**Off-boarding note:** the repo's git history and the seeded admin account use `blueoceanintern@gmail.com`. Before departure: transfer GitHub ownership, move any accounts registered to that address, and hand over or rotate every key above.

## 4. Stripe configuration

- Model: **Stripe Connect**. Orgs onboard as connected accounts; external-client payments carry `application_fee_percent` = `STRIPE_PLATFORM_FEE_PERCENT` (15) routed to the BlueOcean platform account. No manual payout logic exists anywhere — do not add any.
- `STRIPE_ORG_PRICE_ID` is the Price ID for the org subscription plan. `TODO(Tori): note which product/price this is in the Stripe dashboard, and whether it's live-mode or test-mode`.
- Webhook: Stripe must point at `POST /api/v1/webhooks/stripe` on the production host. Signature-verified with `STRIPE_WEBHOOK_SECRET`; idempotent via the `stripe_events` table. `TODO(Tori): confirm the webhook endpoint is registered in the Stripe dashboard and list which events it subscribes to`.
- Test cards / test mode: use Stripe test mode against local dev; never point local dev at live keys.

## 5. Email (SMTP)

Invite and welcome emails are sent via nodemailer (`apps/api/src/lib/email.ts`); templates in `apps/api/src/email-templates/`. Sender address comes from `SMTP_FROM`; links in emails are built from `NEXT_PUBLIC_WEB_URL` — if the domain changes, update that env var or invite links will point at the old host.

`TODO(Tori): provider name, dashboard login owner, sending domain/SPF status, and any sending limits.`

## 6. Database, backups & data

- Single Postgres 17 instance (docker volume `pgdata`) holding all orgs' data. DB name: `blueocean`.
- **Backups: `TODO(Tori): do any exist?** Lightsail snapshots? pg_dump cron? If the honest answer is "none", write that here and list it as the top operational risk — a lost volume is currently unrecoverable customer data.`
- Restore procedure: `TODO(Tori): if backups exist, document one tested restore. An untested backup is not a backup.`
- The HNSW/GIN indexes come from `db/post-migrate.sql` and are **not** created by migrations — after any restore into a fresh database, run it again.

## 7. Compliance obligations

These are commitments, not aspirations — they're in the product's hard constraints (`CLAUDE.md` → "Hard Constraints"):

| Obligation | Mechanism | Status |
|---|---|---|
| Query logs purged after **90 days** | `workers/retention.ts` → `query-log-purge`, daily 03:30 | Implemented — **verify workers run in prod (§1)** |
| Org data quarantined **30 days** after cancellation, then permanently deleted | `orgs.cancelled_at` + `org-data-purge`, daily 04:00 | Implemented — same caveat |
| Audit log of all admin actions, exportable | `audit_logs` table + Audit page + CSV export | Implemented |
| Data processing agreement (DPA) **per org before pilot** | Process, not code | `TODO(Tori): is Equest's DPA signed? Where is it stored?` |
| PDPA (SG) / GDPR / Australia Privacy Act | Above mechanisms + DPA | `TODO(Tori): any legal review notes or open items` |
| No cross-org access; internal plane isolation | `org_id` scoping + `access_tier` at SQL level + isolation middleware | Implemented; covered by unit tests (no CI — run `bun test`) |

## 8. Support & escalation

- `TODO(Tori): who do Equest users contact when something breaks? Who at BlueOcean owns this product after you leave?`
- `TODO(Tori): any existing support channel (email inbox, WhatsApp group, etc.)`
- First-response playbook for "the app is down":
  1. `ssh` to the VPS → `docker ps` (are `db`/`api`/`web` up?) → `docker compose logs --tail 100 api`
  2. Check disk space (`df -h`) — a 60 GB shared box fills up
  3. Restart: `docker compose up -d` (state is in the `pgdata` volume; containers are safe to recreate)
  4. If only AI answers fail: check OpenAI/Anthropic status pages and API key billing before touching the server

## 9. Handover checklist

For the final handover session — check off together with the successor:

- [ ] Successor has GitHub access (admin) and has cloned + run the app locally per `README.md`
- [ ] Successor has SSH access to the VPS and has performed **one supervised deploy**
- [ ] Successor has logins (or ownership transfer) for: AWS, Stripe, OpenAI, Anthropic, SMTP, DNS `TODO: adjust list to match §3`
- [ ] Production `.env` contents transferred securely (password manager — not email/chat)
- [ ] Workers confirmed running in production; retention jobs verified in logs
- [ ] Backup status confirmed and §6 filled in truthfully
- [ ] Stripe webhook verified firing against production (Stripe dashboard → recent deliveries)
- [ ] Walkthrough of `02_Technical_Handover.md` Part III (known issues) done
- [ ] `blueoceanintern@gmail.com`-owned accounts transferred or rotated
- [ ] All three handover docs re-read once, `TODO(Tori)` markers resolved, "last verified" dates bumped
