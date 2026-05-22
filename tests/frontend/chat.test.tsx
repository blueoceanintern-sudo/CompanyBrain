/**
 * Frontend blackbox tests for the Chat screen (/dashboard/chat).
 * Tests what the user sees and can do — not implementation details.
 *
 * Runtime: bun test with happy-dom environment (set in bunfig.toml)
 * Dependencies: @testing-library/react, @testing-library/user-event
 */

import { mock } from "bun:test"

// Mock Next.js router — not under test here
mock.module("next/navigation", () => ({
  useRouter:   mock(() => ({ push: mock(), replace: mock(), prefetch: mock() })),
  usePathname: mock(() => "/dashboard/chat"),
}))

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { render, screen, waitFor, within, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChatInterface } from "../../../apps/web/src/components/chat/chat-interface"

// ─── Mock fetch helpers ────────────────────────────────────────────────────────

type QueryResponse = {
  answer: string
  citations: Array<{ chunk_id: string; document_id: string; source_type: string; excerpt?: string }>
  confidence: number
  missing: string[]
}

function mockQueryResponse(data: Partial<QueryResponse>): void {
  global.fetch = mock(async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: {
          answer:     data.answer     ?? "The leave policy allows 20 days per year.",
          citations:  data.citations  ?? [],
          confidence: data.confidence ?? 0.85,
          missing:    data.missing    ?? [],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  ) as unknown as typeof fetch
}

function mockQueryError(status: number): void {
  global.fetch = mock(async () =>
    new Response(
      JSON.stringify({ success: false, error: { code: "QUERY_FAILED", message: "Server error" } }),
      { status, headers: { "Content-Type": "application/json" } }
    )
  ) as unknown as typeof fetch
}

const defaultProps = {
  orgId:  "test-org-a",
  userId: "user-a-staff",
  role:   "staff" as const,
}

beforeEach(() => { mockQueryResponse({}) })
afterEach(() => { (global.fetch as ReturnType<typeof mock>).mockReset?.() })

// ─── Query input ──────────────────────────────────────────────────────────────

describe("ChatInterface — query input", () => {
  test("renders a textarea for the query input", () => {
    render(<ChatInterface {...defaultProps} />)
    expect(screen.getByRole("textbox")).toBeTruthy()
  })

  test("renders a Send button", () => {
    render(<ChatInterface {...defaultProps} />)
    expect(screen.getByRole("button", { name: /send/i })).toBeTruthy()
  })

  test("Send button is disabled when query is empty", () => {
    render(<ChatInterface {...defaultProps} />)
    const button = screen.getByRole("button", { name: /send/i })
    expect(button).toHaveAttribute("disabled")
  })

  test("Send button becomes enabled once the user types a query", async () => {
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "What is the leave policy?")
    const button = screen.getByRole("button", { name: /send/i })
    expect(button).not.toHaveAttribute("disabled")
  })

  test("submitting an empty query via Enter does nothing", async () => {
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.keyboard("{Enter}")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test("Ctrl+Enter submits the query", async () => {
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "What is the leave policy?")
    await user.keyboard("{Control>}{Enter}{/Control}")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test("Cmd+Enter submits the query on Mac", async () => {
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "What is the leave policy?")
    await user.keyboard("{Meta>}{Enter}{/Meta}")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test("textarea is cleared after successful submission", async () => {
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    const textarea = screen.getByRole("textbox")
    await user.type(textarea, "What is the leave policy?")
    await user.keyboard("{Control>}{Enter}{/Control}")
    await waitFor(() => expect(textarea).toHaveValue(""))
  })
})

// ─── Loading state ─────────────────────────────────────────────────────────────

describe("ChatInterface — loading state", () => {
  test("shows a loading indicator while the query is in flight", async () => {
    // Delay the response so loading state is observable
    global.fetch = mock(
      () => new Promise(resolve =>
        setTimeout(() => resolve(new Response(
          JSON.stringify({ success: true, data: { answer: "x", citations: [], confidence: 0.9, missing: [] } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )), 100)
      )
    ) as unknown as typeof fetch

    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "test query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    // Loading indicator (three-dot pulse or spinner) should appear
    expect(screen.getByTestId("chat-loading") ?? screen.queryByRole("status")).toBeTruthy()
  })

  test("Send button is disabled while a query is in flight", async () => {
    global.fetch = mock(
      () => new Promise(resolve =>
        setTimeout(() => resolve(new Response(
          JSON.stringify({ success: true, data: { answer: "x", citations: [], confidence: 0.9, missing: [] } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )), 100)
      )
    ) as unknown as typeof fetch

    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "test")
    await user.keyboard("{Control>}{Enter}{/Control}")

    expect(screen.getByRole("button", { name: /send/i })).toHaveAttribute("disabled")
  })
})

// ─── Confidence state rendering ───────────────────────────────────────────────

describe("ChatInterface — confidence states (DESIGN.md spec)", () => {
  test("confidence ≥ 0.7: renders answer bubble with no confidence badge", async () => {
    mockQueryResponse({ answer: "High confidence answer.", confidence: 0.85, citations: [] })
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("High confidence answer."))
    expect(screen.queryByText(/low confidence/i)).toBeNull()
  })

  test("confidence 0.5–0.69: renders answer bubble and 'Low confidence' badge", async () => {
    mockQueryResponse({ answer: "Medium confidence answer.", confidence: 0.6, citations: [] })
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("Medium confidence answer."))
    expect(screen.getByText(/low confidence/i)).toBeTruthy()
  })

  test("confidence 0.5–0.69: answer bubble AND badge are both present", async () => {
    mockQueryResponse({ answer: "Borderline answer.", confidence: 0.5, citations: [] })
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("Borderline answer."))
    expect(screen.getByText(/low confidence/i)).toBeTruthy()
  })

  test("confidence < 0.5: no answer bubble — renders muted 'No answer found' text", async () => {
    mockQueryResponse({ answer: "I don't know, not in the knowledge base.", confidence: 0.3, citations: [] })
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText(/no answer found in the knowledge base/i))
    // Must not render an answer bubble for this state
    expect(screen.queryByTestId("answer-bubble")).toBeNull()
  })

  test("confidence < 0.5: 'Low confidence' badge is NOT shown", async () => {
    mockQueryResponse({ answer: "I don't know.", confidence: 0.2, citations: [] })
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText(/no answer found|don't know/i))
    expect(screen.queryByText(/low confidence/i)).toBeNull()
  })

  test("confidence boundary: 0.5 exactly shows the badge (gate passes at 0.5)", async () => {
    mockQueryResponse({ answer: "Boundary answer.", confidence: 0.5, citations: [] })
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("Boundary answer."))
    expect(screen.getByText(/low confidence/i)).toBeTruthy()
  })
})

// ─── Citations ─────────────────────────────────────────────────────────────────

describe("ChatInterface — citations", () => {
  const citedAnswer = {
    answer: "The policy applies to all staff. [1] Overtime rules vary by department. [2]",
    confidence: 0.88,
    citations: [
      { chunk_id: "c1", document_id: "doc-1", source_type: "hr_policy",   excerpt: "Policy applies to all staff..." },
      { chunk_id: "c2", document_id: "doc-2", source_type: "compliance",  excerpt: "Overtime rules..." },
    ],
  }

  test("citation markers [1] and [2] render as superscripts in the answer", async () => {
    mockQueryResponse(citedAnswer)
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "leave policy")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText(/The policy applies/))
    expect(screen.getByText("[1]")).toBeTruthy()
    expect(screen.getByText("[2]")).toBeTruthy()
  })

  test("hovering a citation shows a tooltip with the document name or excerpt", async () => {
    mockQueryResponse(citedAnswer)
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "leave policy")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("[1]"))
    await user.hover(screen.getByText("[1]"))

    await waitFor(() =>
      expect(screen.getByRole("tooltip") ?? screen.queryByText(/Policy applies to all staff/i)).toBeTruthy()
    )
  })

  test("answer without citations renders no superscript markers", async () => {
    mockQueryResponse({ answer: "General answer with no citations.", confidence: 0.9, citations: [] })
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("General answer with no citations."))
    expect(screen.queryByText("[1]")).toBeNull()
  })
})

// ─── Query history ─────────────────────────────────────────────────────────────

describe("ChatInterface — query history", () => {
  test("submitted query text appears in the history list", async () => {
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "What is the leave policy?")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("What is the leave policy?"))
  })

  test("history items are collapsed by default — only question text visible", async () => {
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "Collapsed query test")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("Collapsed query test"))
    // Answer not visible by default in history
    expect(screen.queryByTestId("answer-expanded")).toBeNull()
  })

  test("clicking a history item expands it to show the answer", async () => {
    mockQueryResponse({ answer: "Expanded answer content.", confidence: 0.9, citations: [] })
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "Click to expand")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("Click to expand"))
    await user.click(screen.getByText("Click to expand"))
    await waitFor(() => screen.getByText("Expanded answer content."))
  })

  test("multiple queries stack in history with newest at top", async () => {
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)

    mockQueryResponse({ answer: "First answer" })
    await user.type(screen.getByRole("textbox"), "First query")
    await user.keyboard("{Control>}{Enter}{/Control}")
    await waitFor(() => screen.getByText("First query"))

    mockQueryResponse({ answer: "Second answer" })
    await user.type(screen.getByRole("textbox"), "Second query")
    await user.keyboard("{Control>}{Enter}{/Control}")
    await waitFor(() => screen.getByText("Second query"))

    const items = screen.getAllByTestId("history-item")
    expect(items[0]).toHaveTextContent("Second query")
    expect(items[1]).toHaveTextContent("First query")
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe("ChatInterface — error state", () => {
  test("API error does not crash the component — shows an error message", async () => {
    mockQueryError(500)
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "failing query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() =>
      expect(screen.getByText(/something went wrong|try again|error/i)).toBeTruthy()
    )
  })

  test("after an error, the user can submit another query", async () => {
    mockQueryError(500)
    const user = userEvent.setup()
    render(<ChatInterface {...defaultProps} />)
    await user.type(screen.getByRole("textbox"), "first failing query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText(/something went wrong|try again|error/i))

    mockQueryResponse({ answer: "Recovery answer." })
    await user.type(screen.getByRole("textbox"), "recovery query")
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => screen.getByText("Recovery answer."))
  })
})
