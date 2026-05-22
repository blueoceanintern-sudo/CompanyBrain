const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: { code: string; message: string } }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  return res.json() as Promise<{ success: true; data: T } | { success: false; error: { code: string; message: string } }>
}

async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<{ success: true; data: T } | { success: false; error: { code: string; message: string } }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData })
  return res.json() as Promise<{ success: true; data: T } | { success: false; error: { code: string; message: string } }>
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
  return apiFetch<unknown[]>(`/api/v1/orgs/${orgId}/documents`)
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
  return apiFetch<{
    answer: string
    citations: Array<{ index: number; chunkId: string; filename: string; compartment: string; excerpt: string }>
    confidence: number
    missing: string[]
  }>(`/api/v1/orgs/${orgId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query, accessTier }),
  })
}

export async function getQueryHistory(orgId: string) {
  return apiFetch<unknown[]>(`/api/v1/orgs/${orgId}/queries`)
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getCompartments(orgId: string) {
  return apiFetch<unknown[]>(`/api/v1/orgs/${orgId}/compartments`)
}

export async function createCompartment(orgId: string, data: { name: string; description?: string; mode?: string }) {
  return apiFetch<unknown>(`/api/v1/orgs/${orgId}/compartments`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getUsers(orgId: string) {
  return apiFetch<unknown[]>(`/api/v1/orgs/${orgId}/users`)
}

export async function inviteUser(orgId: string, data: { email: string; role: string; temporaryPassword: string }) {
  return apiFetch<unknown>(`/api/v1/orgs/${orgId}/users`, {
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
  const res = await fetch(`${API_URL}/api/v1/orgs/${orgId}/analytics/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Failed to export audit log')
  return res.blob()
}
