# Company's Brain — Product & Usage Guide

> **Audience:** anyone — BlueOcean staff, Equest admins, end users.
> **Last verified:** 2026-07-20, commit `d18e218`.
> Companion documents: `02_Technical_Handover.md` (developers), `03_Operations_and_Access.md` (successor + manager only).

## Contents

- [Part I — Executive Summary](#part-i--executive-summary)
- [Part II — Product Overview](#part-ii--product-overview)
- [Part III — User Guide](#part-iii--user-guide)
- [Part IV — Administrator Guide](#part-iv--administrator-guide)

---

# Part I — Executive Summary

Company's Brain is a **B2B knowledge platform** built by BlueOcean. An organisation uploads its documents (policies, SOPs, FAQs, case notes); staff then ask questions in plain language and get **grounded, citation-backed answers** drawn only from those documents. When the knowledge base doesn't contain the answer, the system says *"I don't know"* rather than guessing.

**Business model:** each organisation pays a subscription to use the platform. A paid organisation can additionally publish an **external knowledge plane** — a client-facing subset of its knowledge — and charge its own clients for access. BlueOcean automatically takes a **15% platform fee** on those external-client payments via Stripe Connect.

**Current status:**

- All core flows are built and working: document ingestion, retrieval + AI answers, access control (roles, compartments, groups, grants), payments, audit logging, analytics, and automated data-retention purges.
- v1 pilot customer: **Equest school network**. 
- The platform is multi-tenant and org-agnostic — nothing is Equest-specific in the code.
- Known limitations are tracked in `02_Technical_Handover.md`, Part III.

**Where everything lives:**

| What | Where |
|---|---|
| Source code | https://github.com/blueoceanintern-sudo/CompanyBrain |
| Hosting | AWS Lightsail VPS (shared with the Automated Marketing Solution) — see `03_Operations_and_Access.md` |
| Developer docs | `CLAUDE.md` and `README.md` in the repo root (verified accurate as of the commit above) |
| Design system | `DESIGN.md` in the repo root |

> 📸 **[SCREENSHOT: the chat page answering a real question, with citations visible — the one image that explains the product]**

---

# Part II — Product Overview

## The two knowledge planes

Every organisation's knowledge is split into two planes:

- **Internal** — staff-only. HR policies, SOPs, internal case notes. Never visible to clients.
- **External** — client-facing. A curated subset the org chooses to publish and (optionally) monetise.

The separation is enforced at the database level: the external query pipeline *cannot* touch internal content, even by bug or misconfiguration. This is a hard product guarantee, not just a UI filter.

## Multi-tenancy

Many organisations share one deployment. Every piece of data is tagged with its organisation, and every query is scoped to the requesting user's organisation first. Cross-org access is impossible by design.

## Roles

| Role | Can do |
|---|---|
| `super_admin` | Everything below, plus create/manage organisations (BlueOcean staff) |
| `org_admin` | Manage documents, users, groups, compartments, billing, analytics for their org |
| `dept_admin` | Manage documents + ask questions |
| `staff` | Ask questions |
| `external_client` | Ask questions on the external plane; subscribe/pay for access |

## Compartments, groups, and grants

Documents live in **compartments** (e.g. "HR", "Operations", "Client FAQs"). Compartments can have **sub-compartments** (one level deep only). A compartment can be marked **restricted**, in which case only users or **groups** with an explicit **grant** can see its documents — including in search results and AI answers. Access narrows down the tree: reaching a sub-compartment always requires access to its parent.

> 📊 **[DIAGRAM: org → compartments (+ one restricted, with a grant arrow from a group) → documents → "who sees what". This is the concept people struggle with most — draw it, don't describe it.]**

## Plans and monetisation

- **Free plan:** internal knowledge plane only. Cannot publish external content.
- **Paid plan:** unlocks the external plane. The org sets its own external access price, onboards to Stripe Connect, and its clients pay through the platform. BlueOcean's 15% fee is taken automatically on each payment — there is no manual payout process.

## How answers are produced (plain-language version)

1. Your question is compared against every document chunk two ways at once — by meaning and by keywords — and the best matches are combined.
2. If nothing in the knowledge base is a confident match, you get *"I don't know, not in the knowledge base."* The AI is never asked to guess.
3. Otherwise, an AI model (Claude) writes an answer **using only the retrieved passages**, and every answer carries citations back to the source documents.

---

# Part III — User Guide

> 📸 This part should be mostly screenshots — one per flow.

## Logging in

Go to the app URL and sign in with your email and password. Accounts are created by your administrator — there is no self-signup. If you've been invited, you'll have received an email with your login details.

> 📸 **[SCREENSHOT: login page]**

## Asking a question

Open **Chat** from the sidebar. Type a question the way you'd ask a colleague — full natural sentences work better than keywords ("How many days of annual leave do new employees get?" rather than "annual leave policy").

- The **Internal / External** switcher (top of page) controls which knowledge plane you're querying. Most staff will stay on Internal.
- Answers stream in with **numbered citations**. Click a citation to see the source document and the exact passage the answer came from.
- **Always check citations for consequential decisions.** The AI can only use what's in the knowledge base, but the underlying document may be outdated.

> 📸 **[SCREENSHOT: a query with the answer and citation panel expanded]**

## When it says "I don't know"

*"I don't know, not in the knowledge base"* means no document matched your question confidently. This is deliberate — the system refuses to guess. Try rephrasing with different words, or tell your admin the topic is missing (admins can see unanswered queries in Analytics and fill the gaps).

> 📸 **[SCREENSHOT: an "I don't know" response]**

## Follow-up questions

You can ask follow-ups in the same conversation ("summarise that", "what about part-time staff?"). The system rewrites your follow-up into a full question behind the scenes, so context carries over.

## Not yet available

The **Attach file**, **Web search**, and **AI settings** buttons in the chat toolbar are placeholders — clicking them shows a "coming soon" notice. Answers come from your organisation's uploaded documents only.

## For external clients

External clients see only the external plane. If your organisation charges for access, you'll be prompted to subscribe (card payment via Stripe) before you can ask questions.

> 📸 **[SCREENSHOT: external client paywall / checkout prompt]**

---

# Part IV — Administrator Guide

## Documents

**Uploading.** Documents → Upload. Choose the file (PDF, Word `.docx`/`.doc`, or plain text), a **compartment**, an **access tier** (Internal or External), and a **source type** (HR policy, SOP, FAQ, case note, compliance, product doc, other). The document is parsed, split into passages, and indexed — status moves `queued → processing → complete`. Large documents take longer; the upload waits until processing finishes.

- Re-uploading an unchanged file is a no-op (the system detects identical content and skips it).
- If a document shows **failed**, a nightly job retries it automatically (up to 3 attempts); you can also delete and re-upload.

> 📊 **[DIAGRAM: small flowchart — uploaded → queued → processing → complete / failed → "what to do if failed"]**
> 📸 **[SCREENSHOT: upload dialog with compartment/tier/source-type fields]**

**Preview.** Each document row has a preview action showing the extracted text — useful to confirm a PDF parsed correctly.

**Archive / unarchive.** Archiving removes a document's content from search and AI answers without deleting it. Unarchive restores it.

**Delete.** Permanent, requires typing a confirmation. There is no undo — prefer archiving unless you're certain.

> 📸 **[SCREENSHOT: documents list showing status, tier and compartment badges; delete confirmation dialog]**

## Users and groups

**Inviting users.** Users → Invite. Enter an email and role; the person receives an invitation email with login details. You can change roles or remove users later.

**Groups.** Create groups ("Leadership", "HR team") on the Users page and assign members. Groups exist to make compartment grants manageable — grant a compartment to a group once instead of to ten individuals.

> 📸 **[SCREENSHOT: users page with roles; group membership editor]**

## Compartments and restricted access (Settings)

Create compartments and one level of sub-compartments in **Settings**. Mark a compartment **Restricted** to hide its documents from everyone except granted users/groups. Manage grants from the compartment's grant editor — grants can target individual users or groups.

Deleting a compartment **deletes all its documents and indexed content** and requires typed confirmation. Sub-compartments must be deleted before their parent.

> 📸 **[SCREENSHOT: compartment list with a restricted badge; the grants editor]**

## Audit log

The **Audit** page records every admin action — uploads, deletions, role changes, grant changes, billing events — with actor, action, and timestamp. **Export** downloads the full log as CSV for compliance reviews.

> 📸 **[SCREENSHOT: audit page]**

## Analytics

The **Analytics** page shows knowledge-base coverage, query volume, citation hit rate, and — most importantly — **top unanswered and low-confidence queries**. Review these regularly: they are a direct to-do list of what documentation to add next.

> 📸 **[SCREENSHOT: analytics overview]**

## Billing (org admins)

In Settings → Billing:

- **Subscription** — subscribe the org (unlocks the paid plan and external publishing), view status, cancel. On cancellation, org data is quarantined for 30 days and then permanently deleted (see compliance notes in `03_Operations_and_Access.md`).
- **Stripe Connect onboarding** — required before charging external clients; follow the onboarding link to Stripe.
- **External pricing** — set the price external clients pay. BlueOcean's 15% platform fee is deducted automatically.
- **Billing portal** — opens Stripe's self-serve portal for invoices and payment methods.

> 📸 **[SCREENSHOT: billing section]**

## Organisation management (super admins only)

The **Orgs** page (visible only to `super_admin`) lists all organisations and creates new ones. Creating an org also creates its first `org_admin` user, who receives a welcome email.

> 📸 **[SCREENSHOT: orgs page]**
