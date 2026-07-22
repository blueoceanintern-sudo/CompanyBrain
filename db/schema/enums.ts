import { pgEnum } from 'drizzle-orm/pg-core'

export const accessTierEnum = pgEnum('access_tier', ['internal', 'external'])
export const chunkStatusEnum = pgEnum('chunk_status', ['active', 'processing', 'error', 'archived'])
export const orgPlanEnum = pgEnum('org_plan', ['free', 'paid'])
export const sourceTypeEnum = pgEnum('source_type', [
  'hr_policy',
  'sop',
  'faq',
  'case_note',
  'compliance',
  'product_doc',
  'other',
])
export const ingestionStatusEnum = pgEnum('ingestion_status', ['queued', 'running', 'complete', 'failed', 'archived'])
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'org_admin',
  'dept_admin',
  'staff',
  'external_client',
])
