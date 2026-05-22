// Shared test data aligned with db/schema enums and table shapes from CLAUDE.md
// These are pure data objects — no DB calls, no side effects

export type OrgPlan = "free" | "paid"
export type CompartmentMode = "autonomous" | "schema_driven"
export type AccessTier = "internal" | "external"
export type VisibilityClass = "public" | "restricted" | "confidential"
export type UserRole = "super_admin" | "org_admin" | "dept_admin" | "staff" | "external_client"
export type SourceType = "hr_policy" | "sop" | "faq" | "case_note" | "compliance" | "product_doc" | "other"
export type ChunkStatus = "active" | "processing" | "error" | "archived"
export type IngestionStatus = "queued" | "running" | "complete" | "failed"

export interface VisibilityPolicy {
  allowedGroups: string[]
  deniedGroups: string[]
  allowedPrincipals: string[]
  classification: VisibilityClass
}

export interface OrgFixture {
  id: string
  name: string
  plan: OrgPlan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  compartment_mode: CompartmentMode
}

export interface UserFixture {
  id: string
  org_id: string
  email: string
  role: UserRole
}

export interface CompartmentFixture {
  id: string
  org_id: string
  name: string
  description: string
  mode: CompartmentMode
}

export interface DocumentFixture {
  id: string
  org_id: string
  compartment_id: string
  filename: string
  access_tier: AccessTier
  source_type: SourceType
  content_hash: string
  status: ChunkStatus
  uploaded_by: string
  version: number
  previous_version_id: string | null
}

export interface ChunkFixture {
  id: string
  org_id: string
  document_id: string
  compartment_id: string
  content: string
  content_hash: string
  visibility: VisibilityPolicy | null
  access_tier: AccessTier
  source_type: SourceType
  chunk_index: number
  parent_chunk_id: string | null
  status: ChunkStatus
}

// ─── Org IDs ─────────────────────────────────────────────────────────────────

export const ORG_A_ID = "test-org-a"
export const ORG_B_ID = "test-org-b"
export const ORG_FREE_ID = "test-org-free"

// ─── Orgs ─────────────────────────────────────────────────────────────────────

export const orgA: OrgFixture = {
  id: ORG_A_ID,
  name: "Test Org A",
  plan: "paid",
  stripe_customer_id: "cus_test_a",
  stripe_subscription_id: "sub_test_a",
  compartment_mode: "schema_driven",
}

export const orgB: OrgFixture = {
  id: ORG_B_ID,
  name: "Test Org B",
  plan: "paid",
  stripe_customer_id: "cus_test_b",
  stripe_subscription_id: "sub_test_b",
  compartment_mode: "schema_driven",
}

export const orgFree: OrgFixture = {
  id: ORG_FREE_ID,
  name: "Free Tier Org",
  plan: "free",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  compartment_mode: "autonomous",
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const userOrgAAdmin: UserFixture = {
  id: "user-a-admin",
  org_id: ORG_A_ID,
  email: "admin@orga.test",
  role: "org_admin",
}

export const userOrgADeptAdmin: UserFixture = {
  id: "user-a-dept-admin",
  org_id: ORG_A_ID,
  email: "deptadmin@orga.test",
  role: "dept_admin",
}

export const userOrgAStaff: UserFixture = {
  id: "user-a-staff",
  org_id: ORG_A_ID,
  email: "staff@orga.test",
  role: "staff",
}

export const userOrgAExternal: UserFixture = {
  id: "user-a-external",
  org_id: ORG_A_ID,
  email: "client@orga.test",
  role: "external_client",
}

export const userOrgBAdmin: UserFixture = {
  id: "user-b-admin",
  org_id: ORG_B_ID,
  email: "admin@orgb.test",
  role: "org_admin",
}

export const userOrgBStaff: UserFixture = {
  id: "user-b-staff",
  org_id: ORG_B_ID,
  email: "staff@orgb.test",
  role: "staff",
}

export const userOrgFreeAdmin: UserFixture = {
  id: "user-free-admin",
  org_id: ORG_FREE_ID,
  email: "admin@orgfree.test",
  role: "org_admin",
}

// ─── Compartments ─────────────────────────────────────────────────────────────

export const compartmentAHr: CompartmentFixture = {
  id: "comp-a-hr",
  org_id: ORG_A_ID,
  name: "HR",
  description: "HR documents",
  mode: "schema_driven",
}

export const compartmentALegal: CompartmentFixture = {
  id: "comp-a-legal",
  org_id: ORG_A_ID,
  name: "Legal",
  description: "Legal and compliance documents",
  mode: "schema_driven",
}

export const compartmentB: CompartmentFixture = {
  id: "comp-b-ops",
  org_id: ORG_B_ID,
  name: "Operations",
  description: "Org B operations",
  mode: "schema_driven",
}

// ─── Documents ────────────────────────────────────────────────────────────────

export const documentOrgAInternal: DocumentFixture = {
  id: "doc-a-internal-1",
  org_id: ORG_A_ID,
  compartment_id: compartmentAHr.id,
  filename: "hr-policy.pdf",
  access_tier: "internal",
  source_type: "hr_policy",
  content_hash: "sha256-doc-a-internal-1",
  status: "active",
  uploaded_by: userOrgAAdmin.id,
  version: 1,
  previous_version_id: null,
}

export const documentOrgAExternal: DocumentFixture = {
  id: "doc-a-external-1",
  org_id: ORG_A_ID,
  compartment_id: compartmentAHr.id,
  filename: "client-faq.pdf",
  access_tier: "external",
  source_type: "faq",
  content_hash: "sha256-doc-a-external-1",
  status: "active",
  uploaded_by: userOrgAAdmin.id,
  version: 1,
  previous_version_id: null,
}

export const documentOrgB: DocumentFixture = {
  id: "doc-b-internal-1",
  org_id: ORG_B_ID,
  compartment_id: compartmentB.id,
  filename: "org-b-sop.pdf",
  access_tier: "internal",
  source_type: "sop",
  content_hash: "sha256-doc-b-internal-1",
  status: "active",
  uploaded_by: userOrgBAdmin.id,
  version: 1,
  previous_version_id: null,
}

// ─── Chunks ───────────────────────────────────────────────────────────────────

export const chunkOrgAInternal: ChunkFixture = {
  id: "chunk-a-internal-1",
  org_id: ORG_A_ID,
  document_id: documentOrgAInternal.id,
  compartment_id: compartmentAHr.id,
  content: "Confidential internal HR policy content for Org A staff only.",
  content_hash: "sha256-chunk-a-internal-1",
  visibility: {
    allowedGroups: ["hr", "org_admin"],
    deniedGroups: [],
    allowedPrincipals: [],
    classification: "confidential",
  },
  access_tier: "internal",
  source_type: "hr_policy",
  chunk_index: 0,
  parent_chunk_id: null,
  status: "active",
}

export const chunkOrgAExternal: ChunkFixture = {
  id: "chunk-a-external-1",
  org_id: ORG_A_ID,
  document_id: documentOrgAExternal.id,
  compartment_id: compartmentAHr.id,
  content: "Public-facing FAQ content available to external clients of Org A.",
  content_hash: "sha256-chunk-a-external-1",
  visibility: {
    allowedGroups: ["external_client", "staff", "org_admin"],
    deniedGroups: [],
    allowedPrincipals: [],
    classification: "public",
  },
  access_tier: "external",
  source_type: "faq",
  chunk_index: 0,
  parent_chunk_id: null,
  status: "active",
}

// Restricted: only org_admin; staff explicitly denied
export const chunkOrgARestricted: ChunkFixture = {
  id: "chunk-a-restricted-1",
  org_id: ORG_A_ID,
  document_id: documentOrgAInternal.id,
  compartment_id: compartmentALegal.id,
  content: "Legal compliance restricted information. Org admin only.",
  content_hash: "sha256-chunk-a-restricted-1",
  visibility: {
    allowedGroups: ["org_admin"],
    deniedGroups: ["staff", "external_client"],
    allowedPrincipals: [],
    classification: "restricted",
  },
  access_tier: "internal",
  source_type: "compliance",
  chunk_index: 0,
  parent_chunk_id: null,
  status: "active",
}

// Edge case: null visibility — should default to deny for all non-admin
export const chunkNullVisibility: ChunkFixture = {
  id: "chunk-a-null-visibility",
  org_id: ORG_A_ID,
  document_id: documentOrgAInternal.id,
  compartment_id: compartmentAHr.id,
  content: "Chunk with no visibility policy set.",
  content_hash: "sha256-chunk-a-null-vis",
  visibility: null,
  access_tier: "internal",
  source_type: "other",
  chunk_index: 1,
  parent_chunk_id: null,
  status: "active",
}

// Edge case: empty allowedGroups — should deny everyone
export const chunkEmptyAllowedGroups: ChunkFixture = {
  id: "chunk-a-empty-allowed",
  org_id: ORG_A_ID,
  document_id: documentOrgAInternal.id,
  compartment_id: compartmentAHr.id,
  content: "Chunk with empty allowedGroups and no allowedPrincipals.",
  content_hash: "sha256-chunk-a-empty-allowed",
  visibility: {
    allowedGroups: [],
    deniedGroups: [],
    allowedPrincipals: [],
    classification: "confidential",
  },
  access_tier: "internal",
  source_type: "other",
  chunk_index: 2,
  parent_chunk_id: null,
  status: "active",
}

export const chunkOrgB: ChunkFixture = {
  id: "chunk-b-internal-1",
  org_id: ORG_B_ID,
  document_id: documentOrgB.id,
  compartment_id: compartmentB.id,
  content: "Internal SOP content belonging exclusively to Org B.",
  content_hash: "sha256-chunk-b-internal-1",
  visibility: {
    allowedGroups: ["org_admin", "staff"],
    deniedGroups: [],
    allowedPrincipals: [],
    classification: "confidential",
  },
  access_tier: "internal",
  source_type: "sop",
  chunk_index: 0,
  parent_chunk_id: null,
  status: "active",
}

// Content hash dedup test pair — same hash, same org
export const DEDUP_CONTENT_HASH = "sha256-dedup-content-identical"

export const chunkDedupOriginal: ChunkFixture = {
  id: "chunk-dedup-original",
  org_id: ORG_A_ID,
  document_id: documentOrgAInternal.id,
  compartment_id: compartmentAHr.id,
  content: "This content will be re-uploaded to test deduplication.",
  content_hash: DEDUP_CONTENT_HASH,
  visibility: {
    allowedGroups: ["org_admin"],
    deniedGroups: [],
    allowedPrincipals: [],
    classification: "restricted",
  },
  access_tier: "internal",
  source_type: "sop",
  chunk_index: 0,
  parent_chunk_id: null,
  status: "active",
}

// All fixtures grouped for bulk seeding
export const ALL_ORGS = [orgA, orgB, orgFree]
export const ALL_USERS = [
  userOrgAAdmin,
  userOrgADeptAdmin,
  userOrgAStaff,
  userOrgAExternal,
  userOrgBAdmin,
  userOrgBStaff,
  userOrgFreeAdmin,
]
export const ALL_COMPARTMENTS = [compartmentAHr, compartmentALegal, compartmentB]
export const ALL_DOCUMENTS = [documentOrgAInternal, documentOrgAExternal, documentOrgB]
export const ALL_CHUNKS = [
  chunkOrgAInternal,
  chunkOrgAExternal,
  chunkOrgARestricted,
  chunkNullVisibility,
  chunkEmptyAllowedGroups,
  chunkOrgB,
  chunkDedupOriginal,
]
