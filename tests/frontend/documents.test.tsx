/**
 * Frontend blackbox tests for the Document Manager screen (/dashboard/documents).
 * Tests table rendering, filters, upload flow, soft-delete, badges, and pagination.
 */

import { mock } from "bun:test"

mock.module("next/navigation", () => ({
  useRouter:   mock(() => ({ push: mock(), replace: mock() })),
  usePathname: mock(() => "/dashboard/documents"),
}))

import { describe, test, expect, beforeEach } from "bun:test"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DocumentManager } from "../../../apps/web/src/components/documents/document-manager"
import type { AccessTier, ChunkStatus, SourceType } from "../../helpers/fixtures"

// ─── Mock data ─────────────────────────────────────────────────────────────────

type DocumentRow = {
  id: string
  filename: string
  source_type: SourceType
  access_tier: AccessTier
  compartment_id: string
  status: ChunkStatus
  uploaded_by: string
  created_at: string
  org_id: string
}

const makeDoc = (overrides: Partial<DocumentRow> = {}): DocumentRow => ({
  id:            overrides.id            ?? "doc-test-1",
  filename:      overrides.filename      ?? "test-policy.pdf",
  source_type:   overrides.source_type   ?? "hr_policy",
  access_tier:   overrides.access_tier   ?? "internal",
  compartment_id: overrides.compartment_id ?? "comp-a-hr",
  status:        overrides.status        ?? "active",
  uploaded_by:   overrides.uploaded_by   ?? "user-a-admin",
  created_at:    overrides.created_at    ?? "2026-05-01T10:00:00Z",
  org_id:        overrides.org_id        ?? "test-org-a",
  ...overrides,
})

const sampleDocs: DocumentRow[] = [
  makeDoc({ id: "doc-1", filename: "hr-policy.pdf",    access_tier: "internal", status: "active",     source_type: "hr_policy"  }),
  makeDoc({ id: "doc-2", filename: "client-faq.pdf",   access_tier: "external", status: "active",     source_type: "faq"        }),
  makeDoc({ id: "doc-3", filename: "processing.pdf",   access_tier: "internal", status: "processing", source_type: "sop"        }),
  makeDoc({ id: "doc-4", filename: "error-doc.pdf",    access_tier: "internal", status: "error",      source_type: "compliance" }),
  makeDoc({ id: "doc-5", filename: "archived-doc.pdf", access_tier: "internal", status: "archived",   source_type: "other"      }),
]

function mockDocumentList(docs: DocumentRow[] = sampleDocs, page = 1): void {
  global.fetch = mock(async (input: RequestInfo | URL) => {
    const url = input.toString()
    if (url.includes("/documents") && !url.includes("archived")) {
      const active = docs.filter(d => d.status !== "archived")
      return new Response(
        JSON.stringify({
          success: true,
          data: active,
          pagination: { page, per_page: 25, total: active.length, total_pages: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(JSON.stringify({ success: true, data: [], pagination: { page: 1, per_page: 25, total: 0, total_pages: 0 } }), { status: 200 })
  }) as unknown as typeof fetch
}

function mockUploadSuccess(): void {
  global.fetch = mock(async (input: RequestInfo | URL) => {
    const url = input.toString()
    if (url.includes("/documents")) {
      return new Response(
        JSON.stringify({ success: true, data: { ...makeDoc(), id: "doc-new", status: "processing", job_id: "job-1" } }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(JSON.stringify({ success: true, data: sampleDocs, pagination: { page: 1, per_page: 25, total: 4, total_pages: 1 } }), { status: 200 })
  }) as unknown as typeof fetch
}

function mockDeleteSuccess(docId: string): void {
  global.fetch = mock(async (input: RequestInfo | URL) => {
    const url = input.toString()
    if (url.includes(`/documents/${docId}`)) {
      return new Response(JSON.stringify({ success: true, data: { id: docId, status: "archived" } }), { status: 200 })
    }
    const remaining = sampleDocs.filter(d => d.id !== docId && d.status !== "archived")
    return new Response(
      JSON.stringify({ success: true, data: remaining, pagination: { page: 1, per_page: 25, total: remaining.length, total_pages: 1 } }),
      { status: 200 }
    )
  }) as unknown as typeof fetch
}

const adminProps = { orgId: "test-org-a", userRole: "org_admin" as const }

beforeEach(() => { mockDocumentList() })

// ─── Page header ──────────────────────────────────────────────────────────────

describe("DocumentManager — page header", () => {
  test("renders the page title 'Documents'", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => expect(screen.getByRole("heading", { name: /documents/i })).toBeTruthy())
  })

  test("renders an Upload button", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => expect(screen.getByRole("button", { name: /upload/i })).toBeTruthy())
  })
})

// ─── Filter bar ────────────────────────────────────────────────────────────────

describe("DocumentManager — filter bar", () => {
  test("renders a source type filter", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /source type/i }) ??
             screen.queryByTestId("filter-source-type")).toBeTruthy()
    )
  })

  test("renders an access tier filter", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /access tier/i }) ??
             screen.queryByTestId("filter-access-tier")).toBeTruthy()
    )
  })

  test("renders a status filter", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /status/i }) ??
             screen.queryByTestId("filter-status")).toBeTruthy()
    )
  })

  test("renders a search input", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() =>
      expect(screen.getByRole("searchbox") ?? screen.getByPlaceholderText(/search/i)).toBeTruthy()
    )
  })
})

// ─── Table ────────────────────────────────────────────────────────────────────

describe("DocumentManager — table", () => {
  test("renders the table column headers", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: /filename/i })).toBeTruthy()
      expect(screen.getByRole("columnheader", { name: /status/i })).toBeTruthy()
      expect(screen.getByRole("columnheader", { name: /access tier/i })).toBeTruthy()
    })
  })

  test("renders a row for each active document", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => {
      expect(screen.getByText("hr-policy.pdf")).toBeTruthy()
      expect(screen.getByText("client-faq.pdf")).toBeTruthy()
    })
  })

  test("archived document does NOT appear in the default (active) table view", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("hr-policy.pdf"))
    expect(screen.queryByText("archived-doc.pdf")).toBeNull()
  })

  test("clicking on a filename opens the document detail Sheet", async () => {
    const user = userEvent.setup()
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("hr-policy.pdf"))
    await user.click(screen.getByText("hr-policy.pdf"))
    await waitFor(() =>
      expect(screen.getByRole("dialog") ?? screen.queryByTestId("document-detail-sheet")).toBeTruthy()
    )
  })
})

// ─── Badges ───────────────────────────────────────────────────────────────────

describe("DocumentManager — badge colours (DESIGN.md spec)", () => {
  test("internal access tier badge has the 'internal' colour class", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("hr-policy.pdf"))
    const internalBadge = screen.getByTestId("badge-access-tier-doc-1") ??
                          screen.getAllByText(/internal/i)[0]
    expect(internalBadge.className ?? "").toMatch(/internal/i)
  })

  test("external access tier badge has the 'external' colour class", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("client-faq.pdf"))
    const externalBadge = screen.getByTestId("badge-access-tier-doc-2") ??
                          screen.getAllByText(/external/i)[0]
    expect(externalBadge.className ?? "").toMatch(/external/i)
  })

  test("active status badge has the success colour class", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("hr-policy.pdf"))
    const activeBadge = screen.getByTestId("badge-status-doc-1") ??
                        screen.getAllByText(/^active$/i)[0]
    expect(activeBadge.className ?? "").toMatch(/success/i)
  })

  test("processing status badge has the warning colour class", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("processing.pdf"))
    const processingBadge = screen.getByTestId("badge-status-doc-3") ??
                            screen.getAllByText(/processing/i)[0]
    expect(processingBadge.className ?? "").toMatch(/warning/i)
  })

  test("error status badge has the danger colour class", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("error-doc.pdf"))
    const errorBadge = screen.getByTestId("badge-status-doc-4") ??
                       screen.getAllByText(/^error$/i)[0]
    expect(errorBadge.className ?? "").toMatch(/danger/i)
  })
})

// ─── Upload flow ──────────────────────────────────────────────────────────────

describe("DocumentManager — upload flow", () => {
  test("clicking Upload opens the upload dialog", async () => {
    const user = userEvent.setup()
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByRole("button", { name: /upload/i }))
    await user.click(screen.getByRole("button", { name: /upload/i }))
    await waitFor(() =>
      expect(screen.getByRole("dialog") ?? screen.queryByTestId("upload-dialog")).toBeTruthy()
    )
  })

  test("upload dialog has a file input", async () => {
    const user = userEvent.setup()
    render(<DocumentManager {...adminProps} />)
    await user.click(screen.getByRole("button", { name: /upload/i }))
    await waitFor(() =>
      expect(screen.getByLabelText(/file|document/i) ??
             screen.queryByTestId("file-input")).toBeTruthy()
    )
  })

  test("upload dialog has source_type and access_tier selects", async () => {
    const user = userEvent.setup()
    render(<DocumentManager {...adminProps} />)
    await user.click(screen.getByRole("button", { name: /upload/i }))
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /source type/i }) ??
             screen.queryByTestId("upload-source-type")).toBeTruthy()
      expect(screen.getByRole("combobox", { name: /access tier/i }) ??
             screen.queryByTestId("upload-access-tier")).toBeTruthy()
    })
  })

  test("successful upload shows a success toast and closes the dialog", async () => {
    mockUploadSuccess()
    const user = userEvent.setup()
    render(<DocumentManager {...adminProps} />)
    await user.click(screen.getByRole("button", { name: /upload/i }))
    await waitFor(() => screen.getByRole("dialog"))

    const file = new File(["%PDF-1.4 content"], "new-doc.pdf", { type: "application/pdf" })
    const fileInput = screen.getByLabelText(/file/i) ?? screen.getByTestId("file-input")
    await user.upload(fileInput, file)
    await user.click(screen.getByRole("button", { name: /upload|submit/i }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull() ||
      expect(screen.getByText(/ingested|uploaded|success/i)).toBeTruthy()
    )
  })
})

// ─── Delete (soft-delete) ─────────────────────────────────────────────────────

describe("DocumentManager — delete flow", () => {
  test("clicking delete action shows a confirmation before proceeding", async () => {
    const user = userEvent.setup()
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("hr-policy.pdf"))

    const row = screen.getByRole("row", { name: /hr-policy/i }) ??
                screen.getByTestId("doc-row-doc-1")
    const deleteBtn = within(row).getByRole("button", { name: /delete|archive/i })
    await user.click(deleteBtn)

    await waitFor(() =>
      expect(screen.getByRole("alertdialog") ?? screen.queryByText(/are you sure|confirm/i)).toBeTruthy()
    )
  })

  test("confirming delete removes the document from the table", async () => {
    mockDeleteSuccess("doc-1")
    const user = userEvent.setup()
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("hr-policy.pdf"))

    const row = screen.getByRole("row", { name: /hr-policy/i }) ??
                screen.getByTestId("doc-row-doc-1")
    await user.click(within(row).getByRole("button", { name: /delete|archive/i }))
    await waitFor(() => screen.getByRole("alertdialog") ?? screen.queryByText(/confirm/i))
    await user.click(screen.getByRole("button", { name: /confirm|yes|archive/i }))

    await waitFor(() => expect(screen.queryByText("hr-policy.pdf")).toBeNull())
  })

  test("cancelling the delete confirmation keeps the document in the table", async () => {
    const user = userEvent.setup()
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("hr-policy.pdf"))

    const row = screen.getByRole("row", { name: /hr-policy/i }) ??
                screen.getByTestId("doc-row-doc-1")
    await user.click(within(row).getByRole("button", { name: /delete|archive/i }))
    await waitFor(() => screen.getByRole("alertdialog") ?? screen.queryByText(/confirm/i))
    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(screen.getByText("hr-policy.pdf")).toBeTruthy()
  })
})

// ─── Pagination ────────────────────────────────────────────────────────────────

describe("DocumentManager — pagination", () => {
  test("pagination controls render when there is more than one page", async () => {
    global.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: sampleDocs.filter(d => d.status !== "archived"),
          pagination: { page: 1, per_page: 25, total: 60, total_pages: 3 },
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch

    render(<DocumentManager {...adminProps} />)
    await waitFor(() =>
      expect(screen.getByRole("navigation", { name: /pagination/i }) ??
             screen.queryByTestId("pagination")).toBeTruthy()
    )
  })

  test("pagination does not render when there is only one page", async () => {
    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText("hr-policy.pdf"))
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull()
  })
})

// ─── Empty state ──────────────────────────────────────────────────────────────

describe("DocumentManager — empty state", () => {
  test("shows an empty state when no documents exist", async () => {
    global.fetch = mock(async () =>
      new Response(
        JSON.stringify({ success: true, data: [], pagination: { page: 1, per_page: 25, total: 0, total_pages: 0 } }),
        { status: 200 }
      )
    ) as unknown as typeof fetch

    render(<DocumentManager {...adminProps} />)
    await waitFor(() =>
      expect(screen.getByText(/no documents|upload your first/i)).toBeTruthy()
    )
  })

  test("empty state includes an Upload CTA button", async () => {
    global.fetch = mock(async () =>
      new Response(
        JSON.stringify({ success: true, data: [], pagination: { page: 1, per_page: 25, total: 0, total_pages: 0 } }),
        { status: 200 }
      )
    ) as unknown as typeof fetch

    render(<DocumentManager {...adminProps} />)
    await waitFor(() => screen.getByText(/no documents|upload your first/i))
    expect(screen.getByRole("button", { name: /upload/i })).toBeTruthy()
  })
})
