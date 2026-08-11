import type { AccessTier, Permission, UserRole, VisibilityPolicy } from './types'

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin:     ['orgs:manage', 'documents:manage', 'documents:upload', 'documents:view', 'analytics:view', 'audit:view', 'users:manage', 'access:manage', 'roles:manage', 'billing:manage', 'queries:submit'],
  org_admin:       ['documents:manage', 'documents:upload', 'documents:view', 'analytics:view', 'audit:view', 'users:manage', 'access:manage', 'roles:manage', 'billing:manage', 'queries:submit'],
  // dept_admin is a contributor by default: upload + view + ask, but not full
  // document/folder management (which now includes controlling folder access).
  dept_admin:      ['documents:upload', 'documents:view', 'queries:submit'],
  staff:           ['documents:view', 'queries:submit'],
  external_client: ['queries:submit', 'external-access:subscribe'],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

// Every permission the system knows about.
export const ALL_PERMISSIONS: Permission[] = [
  'orgs:manage',
  'documents:manage',
  'documents:upload',
  'documents:view',
  'analytics:view',
  'audit:view',
  'users:manage',
  'access:manage',
  'roles:manage',
  'billing:manage',
  'queries:submit',
  'external-access:subscribe',
]

// Locked permissions are never toggleable per role and are not stored as
// editable rows — the resolver pins them by fixed policy (see buildMatrix).
//  - `orgs:manage`: platform-operator capability (create/list orgs across
//    tenants); stays bound to super_admin only.
//  - `roles:manage`: edits the role→permission matrix itself; bound to
//    super_admin + org_admin so a lower role can never be granted the ability
//    to rewrite the matrix (and thereby grant itself anything).
export const LOCKED_PERMISSIONS: Permission[] = ['orgs:manage', 'roles:manage']

// Permissions an org admin may toggle per role. Locked permissions are excluded
// — granting them to a tenant role would be privilege escalation.
export const EDITABLE_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => !LOCKED_PERMISSIONS.includes(p)
)

// Roles whose permission set is editable. super_admin is a platform operator,
// not a tenant role, so its permissions are fixed to the defaults.
export const EDITABLE_ROLES: UserRole[] = ['org_admin', 'dept_admin', 'staff', 'external_client']

// Privilege ordering used to bound role assignment. An actor may only assign or
// modify roles *strictly below* their own — this is what stops a user who holds
// `users:manage` (a permission the matrix now lets org admins grant to lower
// roles) from promoting themselves or anyone else up to or past their own
// level. A single rank comparison is deliberately used instead of scattered
// role-name special-casing, which is how the role-change route's guard came to
// be missing in the first place.
export const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 4,
  org_admin: 3,
  dept_admin: 2,
  staff: 1,
  external_client: 0,
}

interface RoleAssignment {
  actorRole: UserRole
  // The role being assigned (on invite) or changed to (on a role update).
  newRole: UserRole
  // The target's existing role. Omitted when inviting a brand-new user.
  targetCurrentRole?: UserRole
  // True when the actor is acting on their own account.
  isSelf?: boolean
}

// Guards role assignment on both invite and role-change. Pure so it can be
// tested without a DB and reused across both routes. Returns an error to
// surface, or null when the assignment is allowed. Enforces:
//  (c) an actor can never change their own role
//  (d) super_admin accounts cannot be modified through tenant routes
//  (a) an actor can only modify a target ranked strictly below them
//  (a)/(b) an actor can only assign a role ranked strictly below them
//          (so only super_admin — the sole role above org_admin — may
//           create or modify an org_admin)
export function validateRoleAssignment({
  actorRole,
  newRole,
  targetCurrentRole,
  isSelf = false,
}: RoleAssignment): { code: string; message: string } | null {
  if (isSelf) {
    return { code: 'SELF_ROLE_CHANGE', message: 'You cannot change your own role' }
  }

  if (targetCurrentRole === 'super_admin') {
    return { code: 'TARGET_PROTECTED', message: 'Super admin accounts cannot be modified' }
  }

  const actorRank = ROLE_RANK[actorRole]

  if (targetCurrentRole !== undefined && ROLE_RANK[targetCurrentRole] >= actorRank) {
    return {
      code: 'FORBIDDEN_TARGET',
      message: 'You cannot modify a user whose role is equal to or above your own',
    }
  }

  if (ROLE_RANK[newRole] >= actorRank) {
    return {
      code: 'FORBIDDEN_ASSIGN',
      message: 'You cannot assign a role equal to or above your own',
    }
  }

  return null
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
// Auth session lifetime. All tokens expire within 8 hours regardless of role —
// short-lived sessions bound the blast radius of a stolen token, and combined
// with per-request session-invalidation checks (users.session_invalidated_at)
// give timely deprovisioning without a stateful session store.
export const SESSION_TTL_SECONDS = 8 * 60 * 60
export const EMBEDDING_DIMENSIONS = 1536
export const EMBEDDING_MODEL = 'text-embedding-3-large'
export const SYNTHESIS_MODEL = 'claude-haiku-4-5-20251001'
export const QUERY_LOG_RETENTION_DAYS = 90
export const ORG_QUARANTINE_DAYS = 30
export const STRIPE_PLATFORM_FEE_PERCENT = 15
export const DOCUMENTS_PAGE_SIZE = 25
export const AUDIT_LOAD_MORE_SIZE = 100
export const CITATION_EXCERPT_LENGTH = 120

// A document's chunks always carry the visibility policy of its access tier —
// the tier itself comes from the document's compartment and is never chosen
// independently. Used at ingest, on retry, and when a document moves folders.
export function visibilityForTier(accessTier: AccessTier): VisibilityPolicy {
  return accessTier === 'external'
    ? {
        allowedRoles: ['super_admin', 'org_admin', 'dept_admin', 'staff', 'external_client'],
        deniedRoles: [],
        allowedPrincipals: [],
        classification: 'public',
      }
    : {
        allowedRoles: ['super_admin', 'org_admin', 'dept_admin', 'staff'],
        deniedRoles: [],
        allowedPrincipals: [],
        classification: 'restricted',
      }
}

// ─── Uploads ──────────────────────────────────────────────────────────────────

// Uploads are buffered whole in memory before parsing, on a 2 GB box shared
// with another product — the cap bounds what a single request can allocate.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

// The only extensions accepted at upload, and the Content-Type each is served
// back as. The stored MIME type is never echoed from the client: a browser can
// be told to render an uploaded file, so the type it renders under has to come
// from this fixed table, keyed by an extension we validated.
export const UPLOAD_MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
}

// Formats that may be served with `Content-Disposition: inline`. Only PDF —
// browsers render it in their own sandboxed viewer. Everything else downloads,
// so uploaded markup can never execute against the app origin and the session
// cookie it carries.
export const INLINE_VIEWABLE_MIME_TYPES = ['application/pdf']
