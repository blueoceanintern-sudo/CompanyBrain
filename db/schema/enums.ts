import { pgEnum } from 'drizzle-orm/pg-core'

export const accessTierEnum = pgEnum('access_tier', ['internal', 'external'])
export const chunkStatusEnum = pgEnum('chunk_status', ['active', 'processing', 'error', 'archived'])
export const orgPlanEnum = pgEnum('org_plan', ['free', 'paid'])
// `no_text` = stored fine, but nothing could be extracted (a scanned or
// image-only file). Distinct from `failed`: nothing went wrong and retrying the
// same parser cannot help — it just contributes nothing to answers until OCR.
export const ingestionStatusEnum = pgEnum('ingestion_status', ['queued', 'running', 'complete', 'failed', 'archived', 'no_text'])
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'org_admin',
  'dept_admin',
  'staff',
  'external_client',
])
