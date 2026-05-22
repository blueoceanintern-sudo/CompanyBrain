/**
 * Frontend blackbox tests for the Analytics dashboard (/dashboard/analytics).
 * Tests stat card rendering, warning thresholds, date range toggle,
 * chart rendering, and unanswered queries table — per DESIGN.md spec.
 */

import { mock } from "bun:test"

mock.module("next/navigation", () => ({
  useRouter:   mock(() => ({ push: mock(), replace: mock() })),
  usePathname: mock(() => "/dashboard/analytics"),
}))

// Recharts uses ResizeObserver which is unavailable in happy-dom
global.ResizeObserver = class {
  observe()   {}
  unobserve() {}
  disconnect() {}
}

import { describe, test, expect, beforeEach } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AnalyticsDashboard } from "../../../apps/web/src/components/analytics/analytics-dashboard"

// ─── Mock data helpers ────────────────────────────────────────────────────────

type OverviewData = {
  kb_coverage:              number
  query_volume:             number
  citation_hit_rate:        number
  idk_rate:                 number
  kb_coverage_warning:      boolean
  citation_hit_rate_warning: boolean
  idk_rate_warning:         boolean
}

type UnansweredQuery = {
  query_text: string
  count:      number
  last_asked: string
}

const makeOverview = (overrides: Partial<OverviewData> = {}): OverviewData => ({
  kb_coverage:              overrides.kb_coverage              ?? 82,
  query_volume:             overrides.query_volume             ?? 145,
  citation_hit_rate:        overrides.citation_hit_rate        ?? 91,
  idk_rate:                 overrides.idk_rate                 ?? 8,
  kb_coverage_warning:      overrides.kb_coverage_warning      ?? false,
  citation_hit_rate_warning: overrides.citation_hit_rate_warning ?? false,
  idk_rate_warning:         overrides.idk_rate_warning         ?? false,
  ...overrides,
})

const sampleUnanswered: UnansweredQuery[] = [
  { query_text: "What is the maternity leave policy?",  count: 14, last_asked: "2026-05-18T09:00:00Z" },
  { query_text: "How do I request equipment?",           count: 9,  last_asked: "2026-05-17T14:00:00Z" },
  { query_text: "What is the expense reimbursement cap?", count: 6, last_asked: "2026-05-16T11:00:00Z" },
]

const sampleVolumeData = Array.from({ length: 30 }, (_, i) => ({
  date:  `2026-04-${String(i + 1).padStart(2, "0")}`,
  count: Math.floor(Math.random() * 20),
}))

function mockAnalyticsApi(overrides: { overview?: Partial<OverviewData>; unanswered?: UnansweredQuery[] } = {}): void {
  const overview   = makeOverview(overrides.overview)
  const unanswered = overrides.unanswered ?? sampleUnanswered

  global.fetch = mock(async (input: RequestInfo | URL) => {
    const url = input.toString()
    if (url.includes("/analytics/overview")) {
      return new Response(JSON.stringify({ success: true, data: overview }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (url.includes("/analytics/queries")) {
      return new Response(
        JSON.stringify({ success: true, data: unanswered }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })
  }) as unknown as typeof fetch
}

const defaultProps = { orgId: "test-org-a" }

beforeEach(() => { mockAnalyticsApi() })

// ─── Stat cards ───────────────────────────────────────────────────────────────

describe("AnalyticsDashboard — stat cards", () => {
  test("renders all four stat cards with correct labels", async () => {
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/kb coverage/i)).toBeTruthy()
      expect(screen.getByText(/query volume/i)).toBeTruthy()
      expect(screen.getByText(/citation hit rate/i)).toBeTruthy()
      expect(screen.getByText(/i don.t know rate|idk rate|unanswered rate/i)).toBeTruthy()
    })
  })

  test("KB Coverage card displays the correct percentage value", async () => {
    mockAnalyticsApi({ overview: { kb_coverage: 82 } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => expect(screen.getByText(/82%?/)).toBeTruthy())
  })

  test("Query Volume card displays the correct integer count", async () => {
    mockAnalyticsApi({ overview: { query_volume: 145 } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => expect(screen.getByText("145")).toBeTruthy())
  })

  test("Citation Hit Rate card displays the correct percentage", async () => {
    mockAnalyticsApi({ overview: { citation_hit_rate: 91 } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => expect(screen.getByText(/91%?/)).toBeTruthy())
  })

  test("IDK Rate card displays the correct percentage", async () => {
    mockAnalyticsApi({ overview: { idk_rate: 8 } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => expect(screen.getByText(/8%?/)).toBeTruthy())
  })
})

// ─── Warning thresholds (DESIGN.md spec) ─────────────────────────────────────

describe("AnalyticsDashboard — warning thresholds", () => {
  test("KB Coverage < 70%: card shows warning colour", async () => {
    mockAnalyticsApi({ overview: { kb_coverage: 65, kb_coverage_warning: true } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/65%?/))
    const card = screen.getByTestId("stat-card-kb-coverage")
    expect(card.className ?? "").toMatch(/warning/i)
  })

  test("KB Coverage ≥ 70%: card does NOT show warning colour", async () => {
    mockAnalyticsApi({ overview: { kb_coverage: 75, kb_coverage_warning: false } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/75%?/))
    const card = screen.getByTestId("stat-card-kb-coverage")
    expect(card.className ?? "").not.toMatch(/warning/i)
  })

  test("IDK Rate > 15%: card shows warning colour", async () => {
    mockAnalyticsApi({ overview: { idk_rate: 18, idk_rate_warning: true } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/18%?/))
    const card = screen.getByTestId("stat-card-idk-rate")
    expect(card.className ?? "").toMatch(/warning/i)
  })

  test("IDK Rate ≤ 15%: card does NOT show warning colour", async () => {
    mockAnalyticsApi({ overview: { idk_rate: 12, idk_rate_warning: false } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/12%?/))
    const card = screen.getByTestId("stat-card-idk-rate")
    expect(card.className ?? "").not.toMatch(/warning/i)
  })

  test("Citation Hit Rate < 85%: card shows warning colour", async () => {
    mockAnalyticsApi({ overview: { citation_hit_rate: 80, citation_hit_rate_warning: true } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/80%?/))
    const card = screen.getByTestId("stat-card-citation-hit-rate")
    expect(card.className ?? "").toMatch(/warning/i)
  })

  test("Citation Hit Rate ≥ 85%: card does NOT show warning colour", async () => {
    mockAnalyticsApi({ overview: { citation_hit_rate: 92, citation_hit_rate_warning: false } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/92%?/))
    const card = screen.getByTestId("stat-card-citation-hit-rate")
    expect(card.className ?? "").not.toMatch(/warning/i)
  })

  test("all three warnings active simultaneously — all three cards show warning colour", async () => {
    mockAnalyticsApi({
      overview: {
        kb_coverage: 60, kb_coverage_warning: true,
        idk_rate: 20,    idk_rate_warning: true,
        citation_hit_rate: 70, citation_hit_rate_warning: true,
      },
    })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/60%?/))

    expect(screen.getByTestId("stat-card-kb-coverage").className).toMatch(/warning/i)
    expect(screen.getByTestId("stat-card-idk-rate").className).toMatch(/warning/i)
    expect(screen.getByTestId("stat-card-citation-hit-rate").className).toMatch(/warning/i)
  })
})

// ─── Date range toggle ─────────────────────────────────────────────────────────

describe("AnalyticsDashboard — date range toggle", () => {
  test("renders the three date range options: 7d, 30d, 90d", async () => {
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /7.?day|7d/i }) ??
             screen.getByText(/last 7/i)).toBeTruthy()
      expect(screen.getByRole("button", { name: /30.?day|30d/i }) ??
             screen.getByText(/last 30/i)).toBeTruthy()
      expect(screen.getByRole("button", { name: /90.?day|90d/i }) ??
             screen.getByText(/last 90/i)).toBeTruthy()
    })
  })

  test("clicking a date range option re-fetches analytics data", async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/last 7|7d/i))

    const initialCallCount = (global.fetch as ReturnType<typeof mock>).mock.calls.length
    await user.click(screen.getByRole("button", { name: /90.?day|90d/i }) ??
                     screen.getByText(/last 90/i))
    await waitFor(() =>
      expect((global.fetch as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThan(initialCallCount)
    )
  })

  test("the active date range option has a visually distinct selected state", async () => {
    const user = userEvent.setup()
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/last 30|30d/i))

    const btn30 = screen.getByRole("button", { name: /30.?day|30d/i }) ??
                  screen.getByText(/last 30/i)
    await user.click(btn30)

    await waitFor(() => {
      const el = screen.getByRole("button", { name: /30.?day|30d/i }) ??
                 screen.getByText(/last 30/i)
      expect(
        el.getAttribute("aria-pressed") === "true" ||
        el.getAttribute("data-state") === "active" ||
        (el.className ?? "").match(/active|selected|pressed/)
      ).toBeTruthy()
    })
  })
})

// ─── Charts ───────────────────────────────────────────────────────────────────

describe("AnalyticsDashboard — charts", () => {
  test("query volume line chart is rendered", async () => {
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() =>
      expect(screen.getByTestId("chart-query-volume") ?? screen.queryByRole("img", { name: /query volume/i })).toBeTruthy()
    )
  })

  test("top unanswered bar chart is rendered", async () => {
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() =>
      expect(screen.getByTestId("chart-unanswered") ?? screen.queryByRole("img", { name: /unanswered/i })).toBeTruthy()
    )
  })

  test("charts render without crashing when data is empty", async () => {
    global.fetch = mock(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes("/analytics/overview")) {
        return new Response(
          JSON.stringify({ success: true, data: makeOverview({ query_volume: 0, kb_coverage: 0, citation_hit_rate: 0, idk_rate: 0 }) }),
          { status: 200 }
        )
      }
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })
    }) as unknown as typeof fetch

    let threw = false
    try {
      render(<AnalyticsDashboard {...defaultProps} />)
      await waitFor(() => screen.getByText(/0%?/))
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })
})

// ─── Top unanswered queries table ─────────────────────────────────────────────

describe("AnalyticsDashboard — top unanswered queries table", () => {
  test("renders the unanswered queries table with query text, count, last asked columns", async () => {
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: /query/i })).toBeTruthy()
      expect(screen.getByRole("columnheader", { name: /count/i })).toBeTruthy()
      expect(screen.getByRole("columnheader", { name: /last asked/i })).toBeTruthy()
    })
  })

  test("renders a row for each unanswered query", async () => {
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText("What is the maternity leave policy?")).toBeTruthy()
      expect(screen.getByText("How do I request equipment?")).toBeTruthy()
    })
  })

  test("queries are ordered by count descending (highest count first)", async () => {
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText("What is the maternity leave policy?"))

    const rows = screen.getAllByRole("row").slice(1)  // skip header
    const counts = rows.map(row => {
      const countCell = row.querySelector("[data-column='count']") ??
                        row.querySelectorAll("td")[1]
      return parseInt(countCell?.textContent ?? "0", 10)
    })
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i])
    }
  })

  test("empty unanswered queries list shows empty state — not a crash", async () => {
    mockAnalyticsApi({ unanswered: [] })
    let threw = false
    try {
      render(<AnalyticsDashboard {...defaultProps} />)
      await waitFor(() => screen.getByText(/no unanswered|all queries answered|empty/i))
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })
})

// ─── Loading states ────────────────────────────────────────────────────────────

describe("AnalyticsDashboard — loading states", () => {
  test("skeleton placeholders render while data is loading", () => {
    // Delay fetch so skeleton is visible
    global.fetch = mock(() => new Promise(() => {})) as unknown as typeof fetch

    render(<AnalyticsDashboard {...defaultProps} />)
    // Skeleton components should be in the DOM before data arrives
    expect(
      screen.getAllByRole("presentation").length > 0 ||
      document.querySelectorAll("[data-testid*='skeleton'], .animate-pulse").length > 0
    ).toBeTruthy()
  })

  test("skeletons are replaced by real data after fetch completes", async () => {
    mockAnalyticsApi({ overview: { kb_coverage: 82 } })
    render(<AnalyticsDashboard {...defaultProps} />)
    await waitFor(() => screen.getByText(/82%?/))
    // No skeleton should remain once data is rendered
    expect(document.querySelectorAll("[data-testid*='skeleton']").length).toBe(0)
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe("AnalyticsDashboard — error state", () => {
  test("API error shows an error message — does not crash", async () => {
    global.fetch = mock(async () =>
      new Response(
        JSON.stringify({ success: false, error: { code: "SERVER_ERROR", message: "Unavailable" } }),
        { status: 500 }
      )
    ) as unknown as typeof fetch

    let threw = false
    try {
      render(<AnalyticsDashboard {...defaultProps} />)
      await waitFor(() => screen.getByText(/something went wrong|unavailable|error/i))
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })
})
