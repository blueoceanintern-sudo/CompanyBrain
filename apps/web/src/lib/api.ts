import type {
  QueryResponse,
  DocumentSummary,
  CompartmentSummary,
  UserSummary,
  QueryHistoryItem,
  UserRole,
} from '@company-brain/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'

type ApiResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } }

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
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers })
    return parseResult<T>(res)
  } catch {
    return networkError('Could not reach the server. Check your connection.')
  }
}

async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<ApiResult<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData })
    return parseResult<T>(res)
  } catch {
    return networkError('Could not reach the server. Check your connection.')
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  role: string
  orgId: string
}

export async function login(email: string, password: string) {
  return apiFetch<{ token: string; user: AuthUser }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
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

// ─── Query ────────────────────────────────────────────────────────────────────

export async function submitQuery(orgId: string, query: string, accessTier: 'internal' | 'external' = 'internal') {
  return apiFetch<QueryResponse>(`/api/v1/orgs/${orgId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query, accessTier }),
  })
}

export async function getQueryHistory(orgId: string) {
  return apiFetch<QueryHistoryItem[]>(`/api/v1/orgs/${orgId}/queries`)
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getCompartments(orgId: string) {
  return apiFetch<CompartmentSummary[]>(`/api/v1/orgs/${orgId}/compartments`)
}

export async function createCompartment(orgId: string, data: { name: string; description?: string; mode?: string }) {
  return apiFetch<CompartmentSummary>(`/api/v1/orgs/${orgId}/compartments`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getUsers(orgId: string) {
  return apiFetch<UserSummary[]>(`/api/v1/orgs/${orgId}/users`)
}

export async function inviteUser(orgId: string, data: { email: string; role: string; temporaryPassword: string }) {
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
  return apiFetch<{ plan: string; subscriptionId: string | null; status: string | null }>(
    `/api/v1/orgs/${orgId}/subscriptions`
  )
}

export async function cancelSubscription(orgId: string) {
  return apiFetch<null>(`/api/v1/orgs/${orgId}/subscriptions`, { method: 'DELETE' })
}

export async function exportAuditLog(orgId: string): Promise<Blob> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  try {
    const res = await fetch(`${API_URL}/api/v1/orgs/${orgId}/analytics/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`Server error: ${res.status}`)
    return res.blob()
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to export audit log')
  }
}
