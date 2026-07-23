import type { UserRole, Permission } from './types'

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin:     ['orgs:manage', 'documents:manage', 'documents:view', 'analytics:view', 'users:manage', 'billing:manage', 'queries:submit'],
  org_admin:       ['documents:manage', 'documents:view', 'analytics:view', 'users:manage', 'billing:manage', 'queries:submit'],
  dept_admin:      ['documents:manage', 'documents:view', 'queries:submit'],
  staff:           ['documents:view', 'queries:submit'],
  external_client: ['queries:submit', 'external-access:subscribe'],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

// Confidence = best cosine similarity among top-k candidates. On
// text-embedding-3-large, on-topic paraphrases score ~0.28–0.55 and clearly
// off-topic queries < 0.25. Borderline queries pass through to synthesis,
// which is RAG-only and refuses when the chunks lack the answer.
export const CONFIDENCE_GATE_THRESHOLD = 0.25
// Reciprocal Rank Fusion constant (standard value from the RRF paper).
export const RRF_K = 60
export const TOP_K_CHUNKS = 5
export const CHUNK_SIZE_CHARS = 2000
export const CHUNK_OVERLAP_CHARS = 200
export const EMBEDDING_DIMENSIONS = 1536
export const EMBEDDING_MODEL = 'text-embedding-3-large'
export const SYNTHESIS_MODEL = 'claude-haiku-4-5-20251001'
export const QUERY_LOG_RETENTION_DAYS = 90
export const ORG_QUARANTINE_DAYS = 30
export const STRIPE_PLATFORM_FEE_PERCENT = 15
export const DOCUMENTS_PAGE_SIZE = 25
export const AUDIT_LOAD_MORE_SIZE = 100
export const CITATION_EXCERPT_LENGTH = 120
