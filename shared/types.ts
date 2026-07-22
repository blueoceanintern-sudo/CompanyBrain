// ─── Enums ────────────────────────────────────────────────────────────────────

export type AccessTier = 'internal' | 'external'
export type VisibilityClass = 'public' | 'restricted' | 'confidential'
export type ChunkStatus = 'active' | 'processing' | 'error' | 'archived'
export type OrgPlan = 'free' | 'paid'
export type SourceType =
  | 'hr_policy'
  | 'sop'
  | 'faq'
  | 'case_note'
  | 'compliance'
  | 'product_doc'
  | 'other'
export type IngestionStatus = 'queued' | 'running' | 'complete' | 'failed' | 'archived'
export type UserRole =
  | 'super_admin'
  | 'org_admin'
  | 'dept_admin'
  | 'staff'
  | 'external_client'

export type Permission =
  | 'orgs:manage'
  | 'documents:manage'
  | 'documents:view'
  | 'analytics:view'
  | 'users:manage'
  | 'billing:manage'
  | 'queries:submit'
  | 'external-access:subscribe'

// ─── Visibility policy (JSONB) ────────────────────────────────────────────────

export interface VisibilityPolicy {
  allowedRoles: UserRole[]
  deniedRoles: UserRole[]
  allowedPrincipals: string[]
  classification: VisibilityClass
}

// ─── Service result pattern ───────────────────────────────────────────────────

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

// ─── API response ─────────────────────────────────────────────────────────────

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

// ─── Auth context (extracted from JWT) ───────────────────────────────────────

export interface AuthContext {
  userId: string
  orgId: string
  role: UserRole
}

// ─── Retrieval types ──────────────────────────────────────────────────────────

export interface Citation {
  chunkId: string
  documentId: string
  filename: string
  compartment: string
  excerpt: string
  index: number
}

export interface ChunkContext {
  chunkId: string
  documentId: string
  compartmentId: string
  filename: string
  content: string
  semanticScore: number
  bm25Score: number
  finalScore: number
  chunkIndex: number
}

export interface QueryResponse {
  answer: string
  citations: Citation[]
  confidence: number
  missing: string[]
}

// ─── API view types (JSON-serialised rows returned to the web client) ─────────
// Timestamps arrive as ISO strings over JSON, not Date objects.

export interface DocumentSummary {
  id: string
  orgId: string
  compartmentId: string
  filename: string
  accessTier: AccessTier
  sourceType: SourceType
  contentHash: string
  status: IngestionStatus
  uploadedBy: string
  version: number
  previousVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface CompartmentSummary {
  id: string
  orgId: string
  name: string
  description: string | null
  restricted: boolean
  accessTier: AccessTier
  parentCompartmentId: string | null
  grantCount: number
  createdAt: string
  updatedAt: string
}

export interface GroupSummary {
  id: string
  orgId: string
  name: string
  description: string | null
  memberCount: number
  createdAt: string
  updatedAt: string
}

// Grant subjects for one restricted compartment
export interface CompartmentGrantSet {
  userIds: string[]
  groupIds: string[]
}

export interface UserSummary {
  id: string
  email: string
  role: UserRole
  groups: string[]
  createdAt: string
  updatedAt: string
}

export interface QueryHistoryItem {
  id: string
  orgId: string
  userId: string
  queryText: string
  answer: string | null
  citations: Citation[] | null
  confidence: number | null
  missing: string[] | null
  accessTier: AccessTier
  createdAt: string
}

// ─── Ingestion types ──────────────────────────────────────────────────────────

export interface IngestParams {
  orgId: string
  documentId: string
  compartmentId: string
  accessTier: AccessTier
  sourceType: SourceType
  visibility: VisibilityPolicy
  fileBuffer: Buffer
  filename: string
  uploadedBy: string
}

export interface RetrieveParams {
  orgId: string
  userId: string
  query: string
  accessTier: AccessTier
  userRole: UserRole
  topK?: number
  sourceTypes?: SourceType[]
}

export interface SynthesisParams {
  query: string
  chunks: ChunkContext[]
  conversationHistory?: ConversationTurn[]
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

// ─── Analytics types ──────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  kbCoverage: number
  queryVolume: number
  citationHitRate: number
  iDontKnowRate: number
  documentsBySourceType: Partial<Record<SourceType, number>>
  queryVolumeByDay: QueryVolumePoint[]
}

export interface QueryVolumePoint {
  date: string
  count: number
}

export interface UnansweredQuery {
  queryText: string
  count: number
  lastAsked: string
}
