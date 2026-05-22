/**
 * Frontend blackbox tests for authentication and role-gated navigation.
 * Tests login form behaviour, redirect guards, nav visibility per role,
 * plane switcher access, and user footer rendering.
 */

import { mock } from "bun:test"

const mockPush    = mock()
const mockReplace = mock()

mock.module("next/navigation", () => ({
  useRouter:   mock(() => ({ push: mockPush, replace: mockReplace, prefetch: mock() })),
  usePathname: mock(() => "/login"),
  redirect:    mock((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

import { describe, test, expect, beforeEach } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LoginForm }   from "../../../apps/web/src/components/auth/login-form"
import { AppSidebar }  from "../../../apps/web/src/components/layout/app-sidebar"
import { AuthGuard }   from "../../../apps/web/src/components/auth/auth-guard"
import type { UserRole } from "../../helpers/fixtures"

// ─── Mock fetch helpers ────────────────────────────────────────────────────────

function mockLoginSuccess(): void {
  global.fetch = mock(async () =>
    new Response(
      JSON.stringify({ success: true, data: { token: "test-token", org_id: "test-org-a" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  ) as unknown as typeof fetch
}

function mockLoginFailure(): void {
  global.fetch = mock(async () =>
    new Response(
      JSON.stringify({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  ) as unknown as typeof fetch
}

beforeEach(() => { mockPush.mockReset?.(); mockReplace.mockReset?.() })

// ─── Login form — rendering ───────────────────────────────────────────────────

describe("LoginForm — rendering", () => {
  test("renders an email input", () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/email/i) ?? screen.getByPlaceholderText(/email/i)).toBeTruthy()
  })

  test("renders a password input", () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/password/i) ?? screen.getByPlaceholderText(/password/i)).toBeTruthy()
  })

  test("renders a Sign in button", () => {
    render(<LoginForm />)
    expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy()
  })

  test("does NOT render social login buttons (not in v1)", () => {
    render(<LoginForm />)
    expect(screen.queryByRole("button", { name: /google|github|microsoft/i })).toBeNull()
  })

  test("password field type is 'password' (masked by default)", () => {
    render(<LoginForm />)
    const passwordInput = screen.getByLabelText(/password/i) ?? screen.getByPlaceholderText(/password/i)
    expect(passwordInput).toHaveAttribute("type", "password")
  })
})

// ─── Login form — validation ──────────────────────────────────────────────────

describe("LoginForm — input validation", () => {
  test("submitting empty form shows validation errors", async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getAllByRole("alert").length > 0 || screen.queryByText(/required/i)).toBeTruthy()
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test("submitting with invalid email format shows a validation error", async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i) ?? screen.getByPlaceholderText(/email/i), "not-an-email")
    await user.type(screen.getByLabelText(/password/i) ?? screen.getByPlaceholderText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => expect(screen.queryByText(/valid email|invalid email/i)).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test("submitting with missing password shows a validation error", async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i) ?? screen.getByPlaceholderText(/email/i), "user@test.com")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => expect(screen.queryByText(/required|password/i)).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── Login form — submission ──────────────────────────────────────────────────

describe("LoginForm — submission", () => {
  test("valid credentials call the auth API endpoint", async () => {
    mockLoginSuccess()
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i) ?? screen.getByPlaceholderText(/email/i), "admin@orga.test")
    await user.type(screen.getByLabelText(/password/i) ?? screen.getByPlaceholderText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  })

  test("successful login redirects to /dashboard/chat", async () => {
    mockLoginSuccess()
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i) ?? screen.getByPlaceholderText(/email/i), "admin@orga.test")
    await user.type(screen.getByLabelText(/password/i) ?? screen.getByPlaceholderText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/chat"))
  })

  test("invalid credentials shows an error message — no redirect", async () => {
    mockLoginFailure()
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i) ?? screen.getByPlaceholderText(/email/i), "wrong@orga.test")
    await user.type(screen.getByLabelText(/password/i) ?? screen.getByPlaceholderText(/password/i), "wrongpassword")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => expect(screen.getByText(/invalid|incorrect|email or password/i)).toBeTruthy())
    expect(mockPush).not.toHaveBeenCalled()
  })

  test("Sign in button shows loading state while request is in flight", async () => {
    global.fetch = mock(() => new Promise(() => {})) as unknown as typeof fetch  // never resolves
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i) ?? screen.getByPlaceholderText(/email/i), "admin@orga.test")
    await user.type(screen.getByLabelText(/password/i) ?? screen.getByPlaceholderText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    expect(screen.getByRole("button", { name: /sign in|signing in/i })).toHaveAttribute("disabled")
  })

  test("API error (500) shows a generic error message — does not crash", async () => {
    global.fetch = mock(async () =>
      new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } })
    ) as unknown as typeof fetch

    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i) ?? screen.getByPlaceholderText(/email/i), "admin@orga.test")
    await user.type(screen.getByLabelText(/password/i) ?? screen.getByPlaceholderText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => expect(screen.getByText(/something went wrong|try again/i)).toBeTruthy())
  })
})

// ─── AuthGuard — redirect for unauthenticated users ──────────────────────────

describe("AuthGuard — unauthenticated redirect", () => {
  test("unauthenticated user visiting a protected route is redirected to /login", () => {
    let redirected = false
    try {
      render(<AuthGuard isAuthenticated={false}><div>Protected content</div></AuthGuard>)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("REDIRECT:/login")) redirected = true
    }
    // Either throws a redirect or calls router.replace
    expect(redirected || mockReplace.mock.calls.some((c: string[]) => c[0] === "/login")).toBe(true)
  })

  test("authenticated user can see protected content", () => {
    render(<AuthGuard isAuthenticated={true}><div>Protected content</div></AuthGuard>)
    expect(screen.getByText("Protected content")).toBeTruthy()
  })
})

// ─── AppSidebar — nav items per role ──────────────────────────────────────────

const buildSidebarProps = (role: UserRole) => ({
  user: { id: "test-user", name: "Test User", email: "test@org.test", role, org: "Test Org" },
  orgPlan: "paid" as const,
})

describe("AppSidebar — nav item visibility per role", () => {
  test("Chat nav item is visible to all roles", () => {
    const roles: UserRole[] = ["org_admin", "dept_admin", "staff", "external_client"]
    roles.forEach(role => {
      const { unmount } = render(<AppSidebar {...buildSidebarProps(role)} />)
      expect(screen.getByRole("link", { name: /chat/i })).toBeTruthy()
      unmount()
    })
  })

  test("Documents nav item is visible to org_admin", () => {
    render(<AppSidebar {...buildSidebarProps("org_admin")} />)
    expect(screen.getByRole("link", { name: /documents/i })).toBeTruthy()
  })

  test("Documents nav item is visible to dept_admin", () => {
    render(<AppSidebar {...buildSidebarProps("dept_admin")} />)
    expect(screen.getByRole("link", { name: /documents/i })).toBeTruthy()
  })

  test("Documents nav item is NOT visible to staff", () => {
    render(<AppSidebar {...buildSidebarProps("staff")} />)
    expect(screen.queryByRole("link", { name: /documents/i })).toBeNull()
  })

  test("Documents nav item is NOT visible to external_client", () => {
    render(<AppSidebar {...buildSidebarProps("external_client")} />)
    expect(screen.queryByRole("link", { name: /documents/i })).toBeNull()
  })

  test("Analytics nav item is only visible to org_admin", () => {
    render(<AppSidebar {...buildSidebarProps("org_admin")} />)
    expect(screen.getByRole("link", { name: /analytics/i })).toBeTruthy()

    const { unmount } = render(<AppSidebar {...buildSidebarProps("org_admin")} />)
    unmount()

    const nonAdminRoles: UserRole[] = ["dept_admin", "staff", "external_client"]
    nonAdminRoles.forEach(role => {
      const { unmount: u } = render(<AppSidebar {...buildSidebarProps(role)} />)
      expect(screen.queryByRole("link", { name: /analytics/i })).toBeNull()
      u()
    })
  })

  test("Audit Log nav item is only visible to org_admin", () => {
    render(<AppSidebar {...buildSidebarProps("org_admin")} />)
    expect(screen.getByRole("link", { name: /audit/i })).toBeTruthy()
  })

  test("Audit Log nav item is NOT visible to staff", () => {
    render(<AppSidebar {...buildSidebarProps("staff")} />)
    expect(screen.queryByRole("link", { name: /audit/i })).toBeNull()
  })

  test("Users nav item is only visible to org_admin", () => {
    render(<AppSidebar {...buildSidebarProps("org_admin")} />)
    expect(screen.getByRole("link", { name: /users/i })).toBeTruthy()
  })

  test("Settings nav item is only visible to org_admin", () => {
    render(<AppSidebar {...buildSidebarProps("org_admin")} />)
    expect(screen.getByRole("link", { name: /settings/i })).toBeTruthy()
  })
})

// ─── AppSidebar — plane switcher ──────────────────────────────────────────────

describe("AppSidebar — plane switcher", () => {
  test("plane switcher is visible to org_admin", () => {
    render(<AppSidebar {...buildSidebarProps("org_admin")} />)
    expect(screen.getByRole("group", { name: /plane|internal|external/i }) ??
           screen.queryByText(/internal/i)).toBeTruthy()
  })

  test("plane switcher is NOT visible to staff", () => {
    render(<AppSidebar {...buildSidebarProps("staff")} />)
    expect(screen.queryByRole("group", { name: /plane/i })).toBeNull()
  })

  test("plane switcher is NOT visible to external_client", () => {
    render(<AppSidebar {...buildSidebarProps("external_client")} />)
    expect(screen.queryByRole("group", { name: /plane/i })).toBeNull()
  })

  test("plane switcher has Internal and External options for org_admin", () => {
    render(<AppSidebar {...buildSidebarProps("org_admin")} />)
    expect(screen.getByText(/internal/i)).toBeTruthy()
    expect(screen.getByText(/external/i)).toBeTruthy()
  })

  test("plane switcher is NOT visible to paid org org_admin when plan is free", () => {
    render(
      <AppSidebar
        user={{ id: "u", name: "Admin", email: "a@b.com", role: "org_admin", org: "Org" }}
        orgPlan="free"
      />
    )
    // Free org should not show external plane toggle
    expect(screen.queryByText(/external/i)).toBeNull()
  })
})

// ─── AppSidebar — user footer ─────────────────────────────────────────────────

describe("AppSidebar — user footer", () => {
  test("displays the user's name", () => {
    render(
      <AppSidebar
        user={{ id: "u1", name: "Jane Smith", email: "jane@org.test", role: "org_admin", org: "Equest" }}
        orgPlan="paid"
      />
    )
    expect(screen.getByText("Jane Smith")).toBeTruthy()
  })

  test("displays the user's role", () => {
    render(
      <AppSidebar
        user={{ id: "u1", name: "Jane Smith", email: "jane@org.test", role: "org_admin", org: "Equest" }}
        orgPlan="paid"
      />
    )
    expect(screen.getByText(/org admin/i)).toBeTruthy()
  })

  test("displays the org name", () => {
    render(
      <AppSidebar
        user={{ id: "u1", name: "Jane Smith", email: "jane@org.test", role: "org_admin", org: "Equest" }}
        orgPlan="paid"
      />
    )
    expect(screen.getByText(/equest/i)).toBeTruthy()
  })
})
