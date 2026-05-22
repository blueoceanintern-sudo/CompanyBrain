// ─── Enums ────────────────────────────────────────────────────────────────────

export type AccessTier        = "internal" | "external"
export type VisibilityClass   = "public" | "restricted" | "confidential"
export type CompartmentMode   = "autonomous" | "schema_driven"
export type ChunkStatus       = "active" | "processing" | "error" | "archived"
export type OrgPlan           = "free" | "paid"
export type SourceType        = "hr_policy" | "sop" | "faq" | "case_note" | "compliance" | "product_doc" | "other"
export type IngestionStatus   = "queued" | "running" | "complete" | "failed"
export type UserRole          = "super_admin" | "org_admin" | "dept_admin" | "staff" | "external_client"

// ─── Visibility ───────────────────────────────────────────────────────────────

export interface VisibilityPolicy {
  allowedGroups:     string[]
  deniedGroups:      string[]
  allowedPrincipals: string[]
  classification:    VisibilityClass
}

// ─── Response contract ────────────────────────────────────────────────────────

export type ServiceSuccess<T> = { success: true;  data: T }
export type ServiceError      = { success: false; error: { code: string; message: string } }
export type ServiceResult<T>  = ServiceSuccess<T> | ServiceError

export function ok<T>(data: T): ServiceSuccess<T> {
  return { success: true, data }
}

export function err(code: string, message: string): ServiceError {
  return { success: false, error: { code, message } }
}

// ─── Query synthesis response ─────────────────────────────────────────────────

export interface Citation {
  chunk_id:    string
  document_id: string
  source_type: string
}

export interface QueryAnswer {
  answer:     string
  citations:  Citation[]
  confidence: number
  missing:    string[]
}

export const IDK_ANSWER: QueryAnswer = {
  answer:     "I don't know, not in the knowledge base.",
  citations:  [],
  confidence: 0,
  missing:    [],
}
