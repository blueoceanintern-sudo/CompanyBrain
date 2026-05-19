# DESIGN.md — Company's Brain

This file is the design system source of truth. It defines how the product looks and feels. For how to build it, see `CLAUDE.md`.

Generated for use with Google Stitch + Claude Code. When implementing any frontend, apply these tokens, patterns, and component mappings exactly. Do not invent colours, spacing, or component structures outside this spec.

---

## Product Character

Company's Brain is a **B2B enterprise knowledge operating system** — not a consumer AI app, not a chatbot, not a SaaS marketing product. The design must reflect that.

- **Calm and precise** — a knowledge tool for staff and admins during operational work; it should feel like a well-organised workspace
- **Trust-first** — access control, compliance, and data sensitivity are core; the UI reinforces permission boundaries visually, not just functionally
- **Efficient** — users are querying a knowledge base and managing documents; reduce chrome, remove decoration, surface information fast
- **Operationally dense** — closer to Linear or Retool than ChatGPT or Notion; data tables, filters, and structured admin flows take priority over conversational aesthetics

Reference tone: **Linear, Raycast, Retool**. Not: Canva, Loom, ChatGPT, or consumer AI apps.

---

## Colour Tokens

Defined in `apps/web/src/app/globals.css` as CSS custom properties using `oklch`. All components use these variables — never hardcode hex or rgb values.

### Light mode

```css
:root {
  /* Brand */
  --color-brand:           oklch(52% 0.18 250);   /* deep blue — primary actions, active states */
  --color-brand-subtle:    oklch(95% 0.04 250);   /* brand tint — hover backgrounds, selected rows */
  --color-brand-fg:        oklch(100% 0 0);       /* white — text on brand backgrounds */

  /* Neutral surface */
  --color-bg:              oklch(99% 0 0);        /* page background */
  --color-surface:         oklch(97% 0 0);        /* cards, panels, sidebar */
  --color-surface-raised:  oklch(100% 0 0);       /* modals, popovers, inputs */
  --color-border:          oklch(90% 0 0);        /* dividers, input borders */
  --color-border-strong:   oklch(80% 0 0);        /* focused input borders */

  /* Text */
  --color-text:            oklch(15% 0 0);        /* primary text */
  --color-text-muted:      oklch(50% 0 0);        /* secondary labels, placeholders */
  --color-text-disabled:   oklch(70% 0 0);        /* disabled states */

  /* Semantic */
  --color-success:         oklch(55% 0.16 155);
  --color-success-subtle:  oklch(95% 0.05 155);
  --color-warning:         oklch(70% 0.16 70);
  --color-warning-subtle:  oklch(97% 0.04 70);
  --color-danger:          oklch(55% 0.20 25);
  --color-danger-subtle:   oklch(97% 0.04 25);

  /* Access tier — reinforce architecture in the UI */
  --color-internal:        oklch(55% 0.16 270);   /* purple — internal plane */
  --color-internal-subtle: oklch(96% 0.04 270);
  --color-external:        oklch(55% 0.16 155);   /* green — external plane */
  --color-external-subtle: oklch(96% 0.04 155);
}
```

### Dark mode

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-brand:           oklch(65% 0.18 250);
    --color-brand-subtle:    oklch(25% 0.06 250);
    --color-brand-fg:        oklch(100% 0 0);

    --color-bg:              oklch(10% 0 0);
    --color-surface:         oklch(14% 0 0);
    --color-surface-raised:  oklch(18% 0 0);
    --color-border:          oklch(22% 0 0);
    --color-border-strong:   oklch(35% 0 0);

    --color-text:            oklch(95% 0 0);
    --color-text-muted:      oklch(55% 0 0);
    --color-text-disabled:   oklch(35% 0 0);

    --color-success:         oklch(65% 0.16 155);
    --color-success-subtle:  oklch(20% 0.06 155);
    --color-warning:         oklch(75% 0.16 70);
    --color-warning-subtle:  oklch(20% 0.05 70);
    --color-danger:          oklch(65% 0.20 25);
    --color-danger-subtle:   oklch(20% 0.06 25);

    --color-internal:        oklch(65% 0.16 270);
    --color-internal-subtle: oklch(20% 0.05 270);
    --color-external:        oklch(65% 0.16 155);
    --color-external-subtle: oklch(20% 0.05 155);
  }
}
```

---

## Typography

Font: **Inter** via `next/font/google`. Monospace: **JetBrains Mono** for IDs, hashes, timestamps, audit log actions.

```css
:root {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Fluid scale — clamp(min, preferred, max) so text adapts between breakpoints */
  --text-xs:   clamp(0.6875rem, 0.65rem + 0.1vw, 0.75rem);    /* ~11–12px */
  --text-sm:   clamp(0.8125rem, 0.78rem + 0.15vw, 0.875rem);  /* ~13–14px */
  --text-base: clamp(0.9375rem, 0.9rem + 0.15vw, 1rem);       /* ~15–16px */
  --text-lg:   clamp(1rem, 0.95rem + 0.2vw, 1.125rem);        /* ~16–18px */
  --text-xl:   clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem);     /* ~18–20px */
  --text-2xl:  clamp(1.25rem, 1.1rem + 0.5vw, 1.5rem);        /* ~20–24px */

  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;

  --leading-tight:   1.25;
  --leading-normal:  1.5;
  --leading-relaxed: 1.625;  /* chat answer body text */
}
```

Typography scales continuously between breakpoints — no hard jumps.

---

## Spacing

8-point base grid. Uses fluid `clamp()` so padding and gaps compress gracefully on narrower viewports.

```css
:root {
  --space-1:  clamp(0.2rem,  0.2rem + 0.05vw, 0.25rem);   /* ~3–4px */
  --space-2:  clamp(0.4rem,  0.4rem + 0.1vw,  0.5rem);    /* ~6–8px */
  --space-3:  clamp(0.6rem,  0.6rem + 0.15vw, 0.75rem);   /* ~10–12px */
  --space-4:  clamp(0.8rem,  0.8rem + 0.2vw,  1rem);      /* ~13–16px */
  --space-5:  clamp(1rem,    1rem + 0.2vw,    1.25rem);   /* ~16–20px */
  --space-6:  clamp(1.125rem,1.1rem + 0.25vw, 1.5rem);    /* ~18–24px */
  --space-8:  clamp(1.5rem,  1.4rem + 0.4vw,  2rem);      /* ~24–32px */
  --space-10: clamp(1.75rem, 1.6rem + 0.6vw,  2.5rem);    /* ~28–40px */
  --space-12: clamp(2rem,    1.8rem + 0.8vw,  3rem);      /* ~32–48px */
  --space-16: clamp(2.5rem,  2.2rem + 1.2vw,  4rem);      /* ~40–64px */
}
```

---

## Density

This is an operational tool. Layouts must be dense enough that admins scan data without excessive scrolling.

```css
:root {
  --row-height-default: 40px;   /* all tables */
  --row-height-compact: 32px;   /* audit log, query history */
  --target-min:         32px;   /* minimum clickable/tappable target */
  --sidebar-item-h:     36px;
  --header-h:           56px;
  --input-h:            36px;   /* all inputs and buttons */
}
```

Rules:
- Default density everywhere unless specified
- Compact is opt-in per table — do not apply globally
- Never use card grids where a table works better

---

## Radii and Shadows

```css
:root {
  --radius-sm:   0.25rem;
  --radius-md:   0.5rem;
  --radius-lg:   0.75rem;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.06);
  --shadow-md: 0 4px 12px oklch(0% 0 0 / 0.08);
  --shadow-lg: 0 8px 24px oklch(0% 0 0 / 0.12);
}
```

---

## Breakpoints

Desktop-first. Three breakpoints. Tailwind class prefixes shown alongside CSS values — use both consistently.

```css
/* Tailwind equivalent: xl: */
@media (min-width: 1280px) { /* xl — full expanded layout */ }

/* Tailwind equivalent: lg: */
@media (min-width: 1024px) { /* lg — default desktop target */ }

/* Tailwind equivalent: md: */
@media (min-width: 768px)  { /* md — icon-only sidebar */ }

/* Tailwind equivalent: sm: (limited support) */
@media (max-width: 767px)  { /* sm — sheet nav, single column */ }
```

Minimum supported viewport: **1024px**. Layouts below this are best-effort — the product is not designed for mobile.

---

## Layout

### Shell

The shell is a dynamic flex container. The sidebar and main content fill the full viewport height.

```
┌──────────────────────────────────────────────────────────────┐
│  Sidebar (dynamic width)  │  Main (flex-1, min-width: 0)    │
│                           │                                  │
│  Logo                     │  Page header (var(--header-h))   │
│  ─────────                │  ──────────────────────────────  │
│  Nav items                │  Content container               │
│                           │    (width: 100%, max-width set   │
│  ─────────                │     per screen — see below)      │
│  Plane switcher           │                                  │
│  ─────────                │                                  │
│  Org / user               │                                  │
└──────────────────────────────────────────────────────────────┘
```

### Sidebar — responsive width

The sidebar has three states driven by viewport width. All transitions use `transition: width 200ms ease`.

| Breakpoint | State | Width | Behaviour |
|---|---|---|---|
| ≥ 1280px (xl) | Expanded | 260px | Full labels + icons |
| 1024px–1279px (lg) | Expanded | 240px | Full labels + icons |
| 768px–1023px (md) | Icon-only | 48px | Icons only; label appears in `Tooltip` on hover |
| < 768px (sm) | Sheet | 0px (hidden) | Hamburger in top bar; sidebar slides in as shadcn `Sheet` |

CSS variables for layout math:

```css
:root {
  --sidebar-w:         240px;   /* lg default */
  --sidebar-w-xl:      260px;
  --sidebar-w-icon:    48px;
  --sidebar-w-closed:  0px;
}

@media (min-width: 1280px) {
  --sidebar-w: var(--sidebar-w-xl);
}
@media (max-width: 1023px) and (min-width: 768px) {
  --sidebar-w: var(--sidebar-w-icon);
}
@media (max-width: 767px) {
  --sidebar-w: var(--sidebar-w-closed);
}
```

Main content always uses `flex: 1; min-width: 0` — never a fixed width.

### Content containers — per-screen max-width

Different screens have different optimal reading/data widths. Always `width: 100%; margin: 0 auto`.

| Screen | Max width | Rationale |
|---|---|---|
| Chat | `min(800px, 100%)` | Optimal answer reading width |
| Document manager | `100%` | Full-width table needs all available space |
| Analytics | `min(1200px, 100%)` | Charts + stat cards benefit from width |
| Audit log | `100%` | Dense data table, needs full width |
| Users | `min(900px, 100%)` | Moderate density |
| Settings | `min(680px, 100%)` | Form-heavy; narrow is better |
| Login | `min(400px, 100%)` | Centred auth form |

### Sticky elements

| Element | Sticky behaviour |
|---|---|
| Sidebar | `position: fixed; left: 0; top: 0; height: 100vh` |
| Page header | `position: sticky; top: 0; z-index: 10` |
| Table header row | `position: sticky; top: var(--header-h)` within scrollable container |
| Chat input | `position: sticky; bottom: 0` within chat scroll container |
| Filter bar (tables) | `position: sticky; top: var(--header-h)` — below page header |

---

## Sidebar

### Nav items

```
[Icon]  Label text               ← default: text-muted, transparent bg
[Icon]  Label text               ← hover: brand-subtle bg (200ms ease)
[Icon]  Label text    ▌          ← active: brand-subtle bg, brand text, 2px left border brand
```

In icon-only mode (md breakpoint), labels are hidden and icons are centred. Active state shows the left border only — no background label.

Nav items by role:

| Item | Icon (lucide) | Roles |
|---|---|---|
| Chat | `MessageSquare` | All |
| Documents | `FileText` | org_admin, dept_admin |
| Analytics | `BarChart2` | org_admin |
| Audit Log | `Shield` | org_admin |
| Users | `Users` | org_admin |
| Settings | `Settings` | org_admin |

### Plane switcher (admin only)

Below nav items, above user footer. Visible when user role is `org_admin` or above.

```
● Internal   ○ External
```

Segmented toggle — not a dropdown. Selected segment uses the corresponding `--color-internal` / `--color-external` token. In icon-only mode, collapses to a single coloured dot indicating active plane.

### User footer

```
[Avatar]  John Smith          ← full sidebar
          Org Admin · Equest
```

In icon-only mode: avatar only, with name + role in a `Tooltip`.

- Avatar: 32px circle, `--color-brand-subtle` bg, `--color-brand` initials, `--font-medium`
- Name: `--text-sm --font-medium`
- Role · Org: `--text-xs --color-text-muted`

---

## Component Patterns

All components use shadcn/ui. Map Stitch designs to the shadcn primitives — do not build custom components when a shadcn equivalent exists.

### Buttons

| Variant | Use case | Token mapping |
|---|---|---|
| `default` | Primary actions — Ask, Upload, Save | `--color-brand` bg, `--color-brand-fg` text |
| `outline` | Secondary — Cancel, Edit | `--color-border` border, `--color-text` text |
| `ghost` | Icon-only, tertiary actions | transparent, `--color-text-muted` |
| `destructive` | Delete, remove | `--color-danger` bg |

Sizes: `sm` for table row actions, `default` for page-level. Never `lg` in data-dense views. All buttons `min-height: var(--input-h)`.

### Inputs

- Height: `var(--input-h)` (36px)
- Border: `--color-border`; focused: `--color-border-strong`; error: `--color-danger`
- Background: `--color-surface-raised`
- Error message: `--text-xs --color-danger`, displayed below the input
- All inputs wired to react-hook-form + Zod — never uncontrolled

---

## Screens

### Chat (`/dashboard/chat`)

Full-height flex column. No fixed inner heights — everything flows.

```
┌─────────────────────────────────┐
│  Query history                  │  ← flex-1, overflow-y: auto
│    Q&A pair (collapsed)         │
│    Q&A pair (expanded)          │
│      Answer bubble              │
│      Citations                  │
│      Confidence badge           │
├─────────────────────────────────┤
│  Query input                    │  ← sticky bottom, auto-resize
└─────────────────────────────────┘
```

**Query input**
- Full-width `Textarea`; auto-resize from 1 row up to 5 rows then scroll
- `--radius-lg`; Send button inline right; `Cmd/Ctrl + Enter` to submit
- `min-height: var(--input-h)`; grows with content

**Answer bubble**
- `--color-surface` bg, `--radius-lg`, `--shadow-sm`, `--space-6` padding
- Width: `100%` up to content container max (`min(800px, 100%)`)
- Body: `--text-base --leading-relaxed --color-text`

**Citations**
- `[1]` superscript links inline in answer text
- On hover: `Tooltip` shows document name + compartment + chunk excerpt (truncated to 120 chars)

**Confidence states**

| `confidence` value | Rendered as |
|---|---|
| ≥ 0.7 | Answer bubble, no badge |
| 0.5–0.69 | Answer bubble + `warning-subtle` badge: "Low confidence" |
| < 0.5 | No bubble — muted italic text: "No answer found in the knowledge base." |

**Loading:** three-dot pulse in answer area; no `Skeleton`

**Query history:** collapsed to question text; click to expand. No pagination — scroll.

---

### Document Manager (`/dashboard/documents`)

Full-width table. Content container: `width: 100%`.

**Page header:** "Documents" title + Upload button right-aligned.

**Filter bar** (sticky below page header):
- `Select` filters: source type, access tier, compartment, status
- `Input` search (server-side tsvector)
- All filters inline, wrapping to second row only if viewport forces it

**Table** — default density (40px rows), horizontal scroll below 1200px, sticky header:

| Column | Width | Responsive |
|---|---|---|
| Filename | flex-1, min 200px | Sticky at sm breakpoint |
| Source type | 120px | Hidden at md |
| Access tier | 100px | Always visible |
| Compartment | 140px | Hidden at md |
| Status | 100px | Always visible |
| Uploaded | 120px | Hidden at md |
| Actions | 80px | Always visible |

Hidden columns at `md` collapse — do not stack vertically. Horizontal scroll handles the rest.

Row hover: `--color-brand-subtle` bg. Row click (on filename): opens detail `Sheet` from right.

**Pagination:** shadcn `Pagination`, 25 rows per page default.

---

### Analytics (`/dashboard/analytics`)

Content container: `min(1200px, 100%)`. Full-width preferred at xl.

**Date range control:** segmented — Last 7 days / 30 days / 90 days — in page header, right-aligned.

**Stat cards** — 4-column grid at lg+; 2-column at md; 1-column at sm:

```css
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}
```

| Card | Metric | Alert threshold |
|---|---|---|
| KB Coverage | % answered | < 70% → warning |
| Query Volume | total this period | — |
| Citation Hit Rate | % with citations | < 85% → warning |
| "I Don't Know" Rate | % unanswered | > 15% → warning colour |

Card layout: stat number (`--text-2xl --font-semibold`) + label (`--text-sm --color-text-muted`) + delta (`--text-xs`, green up / red down).

**Charts** (shadcn Recharts) — no gradients, no decorative fills:
- Line chart: query volume over time — `width: 100%; height: 240px`
- Bar chart: top unanswered queries — `width: 100%; height: 200px`
- Both charts are `ResponsiveContainer` — they fill their parent width automatically

**Top unanswered queries table:** compact (32px rows). Columns: Query text (flex-1), Count (80px), Last asked (120px). Read-only.

---

### Audit Log (`/dashboard/audit`)

Content container: `width: 100%`. Compact density (32px rows). This screen prioritises information density and exportability.

**Page header:** "Audit Log" + Export CSV button right-aligned (calls `GET /orgs/:id/analytics/export`).

**Filter bar:** actor `Input`, action type `Select`, date range `Select` — same sticky behaviour as documents.

**Table** — horizontal scroll, sticky header, sticky timestamp column:

| Column | Width | Notes |
|---|---|---|
| Timestamp | 170px | `YYYY-MM-DD HH:mm:ss`; `--font-mono --text-xs`; sticky |
| Actor | 160px | Name + role `Badge` |
| Action | 180px | Dot-notation string e.g. `document.upload`; `--font-mono --text-xs` |
| Resource | flex-1 | Resource type + name/ID |
| Details | 72px | Ghost "View" → `Sheet` with full JSONB metadata |

No row hover actions beyond "View". No pagination — infinite scroll or load-more at 100 rows.

---

### Settings (`/dashboard/settings`)

Content container: `min(680px, 100%)`. Form-heavy — narrow is better.

`Tabs` for sections: General, Compartments, Subscription, Danger Zone.

- **General:** org name `Input`, save `Button`
- **Compartments:** list of compartments + Create button → `Dialog`; each row has Edit + Delete
- **Subscription:** current plan badge + "Manage billing" button → Stripe portal (external link)
- **Danger Zone:** "Cancel subscription" button — `destructive` variant; confirmation `Dialog` before action

---

### Users (`/dashboard/users`)

Content container: `min(900px, 100%)`.

**Table** — 40px rows:

| Column | Width | Responsive |
|---|---|---|
| Name | flex-1 | Always |
| Email | 200px | Hidden at md |
| Role | 140px | Always |
| Joined | 120px | Hidden at md |
| Actions | 80px | Always |

**Invite** button → `Dialog`: email `Input` + role `Select` + Send invite `Button`.

Role badge colours:
- `super_admin` → danger
- `org_admin` → brand
- `dept_admin` → internal (purple)
- `staff` → default (slate)
- `external_client` → external (green)

---

### Login (`/login`)

Content container: `min(400px, 100%)`. Vertically centred in viewport.

Logo centred above form. Email + password `Input` fields. Sign in `Button` (full width). No social login in v1.

---

## Badges and Pills

All badges: `--radius-sm`, `--text-xs`, `--font-medium`, `--space-1` vertical / `--space-2` horizontal padding.

```
source_type:
  hr_policy     → slate bg/text
  sop           → blue
  faq           → green
  case_note     → purple
  compliance    → orange
  product_doc   → teal
  other         → gray

status:
  active        → success-subtle bg, success text
  processing    → warning-subtle bg, warning text
  error         → danger-subtle bg, danger text
  archived      → surface bg, text-muted

access tier pills:
  internal      → internal-subtle bg, internal text
  external      → external-subtle bg, external text
```

---

## States and Feedback

### Loading

| Context | Pattern |
|---|---|
| Full page | `Skeleton` blocks matching layout shape |
| Table rows | `Skeleton` rows at correct row height |
| Stat cards | `Skeleton` at stat number + label positions |
| Charts | `Skeleton` at full chart height |
| Chat answer | Three-dot pulse animation — no `Skeleton` |
| Button submitting | Disabled + `Loader2` spinning (lucide) |

All `Skeleton` elements respect `prefers-reduced-motion` — fade instead of pulse when set.

### Empty states

Every list, table, and data view needs one:

- Centred vertically and horizontally in the content area
- Headline: `--text-lg --font-medium`
- Description: `--text-sm --color-text-muted`
- CTA button if there's an obvious next action

### Toasts

shadcn `Sonner`, bottom-right.

| Event | Variant | Message |
|---|---|---|
| Document ingested | success | "Document ingested successfully" |
| Ingestion failed | error | "Ingestion failed: [reason]" |
| Role updated | success | "Role updated" |
| Document deleted | default | "Document archived" + Undo |
| Invite sent | success | "Invite sent to [email]" |
| Query no answer | — | No toast — handled inline in chat |

### Error pages

- **404:** "Page not found" + back to chat link
- **403:** "You don't have access to this" + current role shown
- **500:** "Something went wrong" + retry button

---

## Accessibility

WCAG AA minimum. Non-negotiable for compliance-oriented organisations.

- **Contrast:** 4.5:1 body text; 3:1 large text and UI components
- **Keyboard navigation:** every interactive element tab-reachable; tab order follows visual layout
- **Focus rings:** `outline: 2px solid var(--color-brand); outline-offset: 2px` on all focusable elements; never `outline: none` without a custom replacement
- **ARIA:** icon-only buttons have `aria-label`; dialogs have `aria-labelledby`; tables have `aria-label` or `<caption>`
- **Motion:** `prefers-reduced-motion` respected — disable pulse animations; use instant or fade transitions instead
- **Minimum target:** `var(--target-min)` (32px) on all clickable/tappable elements

---

## Stitch → shadcn Mapping

When importing Stitch-generated designs: use Stitch output as a **layout and visual reference only**. Do not copy its HTML/CSS. Implement using the shadcn components below with tokens from this file.

| Stitch element | shadcn component | Notes |
|---|---|---|
| Text input | `Input` | |
| Multi-line input | `Textarea` | Chat query; auto-resize |
| Dropdown / select | `Select` | |
| Modal / dialog | `Dialog` | Upload, invite, confirm |
| Slide-over / drawer | `Sheet` | Mobile nav, document detail, audit detail |
| Tooltip | `Tooltip` | Citations, truncated text, icon-only nav labels |
| Toast / notification | `Sonner` | |
| Data table | `Table` | Documents, users, audit log |
| Tabs | `Tabs` | Settings sections |
| Progress bar | `Progress` | Upload ingestion |
| Badge / chip | `Badge` | Source type, status, access tier, role |
| Toggle / switch | `Switch` | Settings toggles |
| Stat card | `Card` | Analytics summary |
| Charts | shadcn charts (Recharts `ResponsiveContainer`) | Always full-width responsive |
| Pagination | `Pagination` | |
| Avatar | `Avatar` | User initials |
| Skeleton | `Skeleton` | All loading states except chat |
| Alert / banner | `Alert` | Compliance warnings, plan upgrade nudges |
| Segmented control | `ToggleGroup` | Date range picker, plane switcher |

---

## What Not to Design

- No gradients — flat fills only
- No decorative illustrations beyond simple empty-state placeholders
- No animations beyond loading states and toast transitions (`prefers-reduced-motion` respected)
- No fixed inner heights — let content and containers flex naturally; only the shell, header, and sidebar use fixed/sticky positioning
- No hardcoded pixel widths on main content areas — always `min(Xpx, 100%)`
- No dark patterns — no hidden upsells, no confusing permission flows
- No consumer-style onboarding — B2B; users are set up by an admin
- No mobile-optimised layouts — desktop-first; below 1024px is best-effort only
