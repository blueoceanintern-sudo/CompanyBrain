import type {
  QueryResponse,
  DocumentSummary,
  CompartmentSummary,
  GroupSummary,
  CompartmentGrantSet,
  UserSummary,
  QueryHistoryItem,
  UserRole,
  ConversationTurn,
} from '@company-brain/shared'

const API_URL = ''

type ApiResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } }

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.success) throw new ApiError(result.error.code, result.error.message)
  return result.data
}

function networkError(message: string): { success: false; error: { code: string; message: string } } {
  return { success: false, error: { code: 'NETWORK_ERROR', message } }
}

async function parseResult<T>(res: Response): Promise<ApiResult<T>> {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return networkError(`Unexpected server response (${res.status})`)
  }
  try {
    return await res.json() as ApiResult<T>
  } catch {
    return networkError('Failed to parse server response')
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' })
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
        localStorage.removeItem('auth_user')
        window.location.replace('/login')
      }
    }
    return parseResult<T>(res)
  } catch {
    return networkError('Could not reach the server. Check your connection.')
  }
}

async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: formData, credentials: 'include' })
    return parseResult<T>(res)
  } catch {
    return networkError('Could not reach the server. Check your connection.')
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  orgId: string
}

export async function login(email: string, password: string) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })
    return parseResult<{ user: AuthUser }>(res)
  } catch {
    return networkError('Could not reach the server. Check your connection.')
  }
}

export async function logout() {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    return parseResult<null>(res)
  } catch {
    return networkError('Could not reach the server.')
  }
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocuments(orgId: string) {
  return apiFetch<DocumentSummary[]>(`/api/v1/orgs/${orgId}/documents`)
}

export async function uploadDocument(orgId: string, formData: FormData) {
  return apiUpload<{ documentId: string; chunksCreated: number }>(
    `/api/v1/orgs/${orgId}/documents`,
    formData
  )
}

export async function deleteDocument(orgId: string, docId: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/documents/${docId}`, { method: 'DELETE' })
}

export async function archiveDocument(orgId: string, docId: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/documents/${docId}/archive`, { method: 'POST' })
}

export async function unarchiveDocument(orgId: string, docId: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/documents/${docId}/unarchive`, { method: 'POST' })
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function submitQuery(
  orgId: string,
  query: string,
  accessTier: 'internal' | 'external' = 'internal',
  history?: ConversationTurn[]
) {
  return apiFetch<QueryResponse>(`/api/v1/orgs/${orgId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query, accessTier, ...(history?.length ? { history } : {}) }),
  })
}

export async function getQueryHistory(orgId: string) {
  return apiFetch<QueryHistoryItem[]>(`/api/v1/orgs/${orgId}/queries`)
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getCompartments(orgId: string) {
  return apiFetch<CompartmentSummary[]>(`/api/v1/orgs/${orgId}/compartments`)
}

export async function createCompartment(
  orgId: string,
  data: { name: string; description?: string; restricted?: boolean; parentId?: string }
) {
  return apiFetch<CompartmentSummary>(`/api/v1/orgs/${orgId}/compartments`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCompartment(
  orgId: string,
  cId: string,
  data: { name?: string; description?: string; restricted?: boolean }
) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/compartments/${cId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function getCompartmentGrants(orgId: string, cId: string) {
  return apiFetch<CompartmentGrantSet>(`/api/v1/orgs/${orgId}/compartments/${cId}/grants`)
}

export async function setCompartmentGrants(orgId: string, cId: string, grants: CompartmentGrantSet) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/compartments/${cId}/grants`, {
    method: 'PUT',
    body: JSON.stringify(grants),
  })
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function getGroups(orgId: string) {
  return apiFetch<GroupSummary[]>(`/api/v1/orgs/${orgId}/groups`)
}

export async function createGroup(orgId: string, data: { name: string; description?: string }) {
  return apiFetch<{ id: string }>(`/api/v1/orgs/${orgId}/groups`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateGroup(orgId: string, gId: string, data: { name?: string; description?: string }) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/groups/${gId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteGroup(orgId: string, gId: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/groups/${gId}`, { method: 'DELETE' })
}

export async function getGroupMembers(orgId: string, gId: string) {
  return apiFetch<Array<{ id: string; email: string; role: UserRole }>>(
    `/api/v1/orgs/${orgId}/groups/${gId}/members`
  )
}

export async function setGroupMembers(orgId: string, gId: string, userIds: string[]) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/groups/${gId}/members`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  })
}

export async function setUserGroups(orgId: string, userId: string, groupIds: string[]) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/users/${userId}/groups`, {
    method: 'PUT',
    body: JSON.stringify({ groupIds }),
  })
}

export async function deleteCompartment(orgId: string, cId: string, targetCompartmentId?: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/compartments/${cId}`, {
    method: 'DELETE',
    body: JSON.stringify(targetCompartmentId ? { targetCompartmentId } : {}),
  })
}

export async function getUsers(orgId: string) {
  return apiFetch<UserSummary[]>(`/api/v1/orgs/${orgId}/users`)
}

export async function inviteUser(
  orgId: string,
  data: { email: string; role: string; temporaryPassword: string; groupIds?: string[] }
) {
  return apiFetch<{ id: string; email: string; role: UserRole }>(`/api/v1/orgs/${orgId}/users`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateUserRole(orgId: string, userId: string, role: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export async function deleteUser(orgId: string, userId: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/users/${userId}`, { method: 'DELETE' })
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalyticsOverview(orgId: string, days: number = 30) {
  return apiFetch<{
    kbCoverage: number
    queryVolume: number
    citationHitRate: number
    iDontKnowRate: number
  }>(`/api/v1/orgs/${orgId}/analytics/overview?days=${days}`)
}

export async function getTopUnanswered(orgId: string, days: number = 30) {
  return apiFetch<Array<{ queryText: string; count: number; lastAsked: string }>>(
    `/api/v1/orgs/${orgId}/analytics/queries?days=${days}`
  )
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscription(orgId: string) {
  return apiFetch<{
    plan: string
    subscriptionId: string | null
    status: string | null
    externalPriceCents: number | null
  }>(`/api/v1/orgs/${orgId}/subscriptions`)
}

export async function cancelSubscription(orgId: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/subscriptions`, { method: 'DELETE' })
}

// ─── Orgs (platform-level) ─────────────────────────────────────────────────────

export interface OrgSummary {
  id: string
  name: string
  plan: string
  createdAt: string
}

export async function listOrgs() {
  return apiFetch<OrgSummary[]>('/api/v1/orgs')
}

export async function createOrg(data: { orgName: string; adminEmail: string; adminTemporaryPassword: string }) {
  return apiFetch<{ orgId: string; orgName: string; admin: { id: string; email: string; role: UserRole } }>(
    '/api/v1/orgs',
    { method: 'POST', body: JSON.stringify(data) }
  )
}

// ─── Stripe Connect (org's own connected account) ──────────────────────────────

export async function getConnectStatus(orgId: string) {
  return apiFetch<{ connected: boolean; chargesEnabled: boolean }>(`/api/v1/orgs/${orgId}/connect-account`)
}

export async function startConnectOnboarding(orgId: string) {
  return apiFetch<{ url: string }>(`/api/v1/orgs/${orgId}/connect-account`, { method: 'POST' })
}

// ─── External pricing (org admin sets; any org member can read) ───────────────

export async function getExternalPricing(orgId: string) {
  return apiFetch<{ priceCents: number | null }>(`/api/v1/orgs/${orgId}/external-pricing`)
}

export async function setExternalPricing(orgId: string, priceCents: number) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/external-pricing`, {
    method: 'PATCH',
    body: JSON.stringify({ priceCents }),
  })
}

// ─── Org self-service upgrade + billing portal ────────────────────────────────

export async function startOrgUpgrade(orgId: string) {
  return apiFetch<{ url: string }>(`/api/v1/orgs/${orgId}/upgrade`, { method: 'POST' })
}

export async function openBillingPortal(orgId: string) {
  return apiFetch<{ url: string }>(`/api/v1/orgs/${orgId}/billing-portal`, { method: 'POST' })
}

// ─── External client checkout ──────────────────────────────────────────────────

export async function startCheckout(orgId: string) {
  return apiFetch<{ url: string }>(`/api/v1/orgs/${orgId}/checkout`, { method: 'POST' })
}

export async function exportAuditLog(orgId: string): Promise<Blob> {
  try {
    const res = await fetch(`/api/v1/orgs/${orgId}/analytics/export`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`Server error: ${res.status}`)
    return res.blob()
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to export audit log')
  }
}
