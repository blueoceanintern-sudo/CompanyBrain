import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createHash } from 'crypto'
import { db } from '@company-brain/db'
import { documents, ingestionJobs, chunks, orgs, compartments, auditLogs } from '@company-brain/db'
import { eq, and, desc, sql } from 'drizzle-orm'
import { ingestDocument } from '@company-brain/ingestion'
import { hasPermission } from '@company-brain/shared'
import type { VisibilityPolicy } from '@company-brain/shared'
import { canPublishExternal, canUseCompartment } from '@company-brain/access-control'
import type { AuthVars } from '../middleware/auth'

const documentsRoute = new Hono<AuthVars>()

const updateDocSchema = z.object({
  compartmentId: z.string().uuid().optional(),
  accessTier: z.enum(['internal', 'external']).optional(),
  sourceType: z
    .enum(['hr_policy', 'sop', 'faq', 'case_note', 'compliance', 'product_doc', 'other'])
    .optional(),
})

const BAD_ORG = { success: false, error: { code: 'BAD_REQUEST', message: 'Missing org ID' } } as const

// GET /orgs/:id/documents
documentsRoute.get('/', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const role = c.get('role')

  // Non-admins only see documents in unrestricted compartments or ones they
  // hold a grant for (directly or via a group). Sub-compartments also require
  // access to the parent — access only narrows down the hierarchy.
  const isAdmin = role === 'super_admin' || role === 'org_admin'
  const grantFilter = isAdmin
    ? undefined
    : sql`EXISTS (
        SELECT 1 FROM compartments cp
        LEFT JOIN compartments pp ON pp.id = cp.parent_compartment_id
        WHERE cp.id = ${documents.compartmentId}
          AND (
            NOT cp.restricted
            OR EXISTS (
              SELECT 1 FROM compartment_grants g
              WHERE g.compartment_id = cp.id
                AND (
                  g.user_id = ${userId}
                  OR g.group_id IN (
                    SELECT gm.group_id FROM group_members gm WHERE gm.user_id = ${userId}
                  )
                )
            )
          )
          AND (
            pp.id IS NULL
            OR NOT pp.restricted
            OR EXISTS (
              SELECT 1 FROM compartment_grants g
              WHERE g.compartment_id = pp.id
                AND (
                  g.user_id = ${userId}
                  OR g.group_id IN (
                    SELECT gm.group_id FROM group_members gm WHERE gm.user_id = ${userId}
                  )
                )
            )
          )
      )`

  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), grantFilter))
    .orderBy(desc(documents.createdAt))

  return c.json({ success: true, data: rows })
})

// POST /orgs/:id/documents
documentsRoute.post('/', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const role = c.get('role')

  if (!hasPermission(role, 'documents:manage')) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient role to upload documents' } },
      403
    )
  }

  const formData = await c.req.formData()
  const file = formData.get('file')
  const compartmentId = formData.get('compartmentId')?.toString()
  const accessTier = (formData.get('accessTier')?.toString() ?? 'internal') as 'internal' | 'external'
  const sourceType = (formData.get('sourceType')?.toString() ?? 'other') as Parameters<typeof ingestDocument>[0]['sourceType']

  if (!(file instanceof File) || !compartmentId) {
    return c.json(
      { success: false, error: { code: 'MISSING_FIELDS', message: 'file and compartmentId are required' } },
      400
    )
  }

  if (accessTier === 'external') {
    const orgRow = await db.select({ plan: orgs.plan }).from(orgs).where(eq(orgs.id, orgId)).limit(1)
    if (!canPublishExternal(orgRow[0]?.plan ?? 'free')) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'External publishing requires a paid plan' } },
        403
      )
    }
  }

  const compartmentRow = await db
    .select({ id: compartments.id })
    .from(compartments)
    .where(and(eq(compartments.id, compartmentId), eq(compartments.orgId, orgId)))
    .limit(1)

  if (!compartmentRow[0]) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Compartment not found' } },
      404
    )
  }

  if (!(await canUseCompartment({ orgId, compartmentId, userId, userRole: role }))) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this compartment' } },
      403
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const contentHash = createHash('sha256').update(buffer).digest('hex')

  // Exact duplicate: same content already exists for this org
  const exactDupe = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.contentHash, contentHash), eq(documents.orgId, orgId)))
    .limit(1)

  if (exactDupe.length > 0) {
    return c.json(
      { success: false, error: { code: 'DUPLICATE_DOCUMENT', message: 'This document has already been uploaded' } },
      409
    )
  }

  // Check for a previous version: same filename in same org + compartment
  const previousDoc = await db
    .select({ id: documents.id, version: documents.version })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.compartmentId, compartmentId),
        eq(documents.filename, file.name),
        eq(documents.status, 'complete')
      )
    )
    .limit(1)

  const visibilityPolicy: VisibilityPolicy = accessTier === 'external'
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

  // Archive previous version's chunks before creating the new record
  if (previousDoc[0]) {
    await db.update(chunks).set({ status: 'archived' }).where(eq(chunks.documentId, previousDoc[0].id))
    await db.update(documents).set({ status: 'archived', updatedAt: new Date() }).where(eq(documents.id, previousDoc[0].id))
  }

  // Create document record
  const [doc] = await db
    .insert(documents)
    .values({
      orgId,
      compartmentId,
      filename: file.name,
      accessTier,
      sourceType,
      contentHash,
      status: 'running',
      uploadedBy: userId,
      version: previousDoc[0] ? previousDoc[0].version + 1 : 1,
      previousVersionId: previousDoc[0]?.id ?? null,
    })
    .returning()

  if (!doc) {
    return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to create document' } }, 500)
  }

  // Create ingestion job
  await db.insert(ingestionJobs).values({
    orgId,
    documentId: doc.id,
    status: 'running',
    startedAt: new Date(),
  })

  // Run ingestion inline (v1 — synchronous)
  const result = await ingestDocument({
    orgId,
    documentId: doc.id,
    compartmentId,
    accessTier,
    sourceType,
    visibility: visibilityPolicy,
    fileBuffer: buffer,
    filename: file.name,
    uploadedBy: userId,
  })

  if (!result.success) {
    await db
      .update(ingestionJobs)
      .set({ status: 'failed', errorMessage: result.error.message, completedAt: new Date() })
      .where(eq(ingestionJobs.documentId, doc.id))

    return c.json(
      { success: false, error: { code: 'INGESTION_FAILED', message: result.error.message } },
      500
    )
  }

  await db
    .update(ingestionJobs)
    .set({ status: 'complete', completedAt: new Date() })
    .where(eq(ingestionJobs.documentId, doc.id))

  return c.json({ success: true, data: { documentId: doc.id, chunksCreated: result.data.chunksCreated } }, 201)
})

// PATCH /orgs/:id/documents/:docId
documentsRoute.patch('/:docId', zValidator('json', updateDocSchema), async (c) => {
  const orgId = c.req.param('id')
  const docId = c.req.param('docId')
  if (!orgId || !docId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  const updates = c.req.valid('json')

  if (!hasPermission(role, 'documents:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  if (updates.accessTier === 'external') {
    const orgRow = await db.select({ plan: orgs.plan }).from(orgs).where(eq(orgs.id, orgId)).limit(1)
    if (!canPublishExternal(orgRow[0]?.plan ?? 'free')) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'External publishing requires a paid plan' } },
        403
      )
    }
  }

  if (updates.compartmentId !== undefined) {
    const userId = c.get('userId')
    const allowed = await canUseCompartment({
      orgId,
      compartmentId: updates.compartmentId,
      userId,
      userRole: role,
    })
    if (!allowed) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to the target compartment' } },
        403
      )
    }
  }

  await db
    .update(documents)
    .set({
      updatedAt: new Date(),
      ...(updates.compartmentId !== undefined ? { compartmentId: updates.compartmentId } : {}),
      ...(updates.accessTier !== undefined ? { accessTier: updates.accessTier } : {}),
      ...(updates.sourceType !== undefined ? { sourceType: updates.sourceType } : {}),
    })
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))

  // When access tier changes, propagate matching visibility to the document's active chunks
  if (updates.accessTier !== undefined) {
    const updatedVisibility: VisibilityPolicy = updates.accessTier === 'external'
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

    await db
      .update(chunks)
      .set({ visibility: updatedVisibility })
      .where(and(eq(chunks.documentId, docId), eq(chunks.status, 'active')))
  }

  return c.json({ success: true, data: null })
})

// Verify org ownership before any mutation — acting on a document ID alone
// would let a cross-org docId mutate another tenant's data.
async function findOrgDocument(orgId: string, docId: string) {
  const rows = await db
    .select({ filename: documents.filename, status: documents.status })
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))
    .limit(1)
  return rows[0]
}

const NOT_FOUND = { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } } as const

// POST /orgs/:id/documents/:docId/archive (removes from retrieval, reversible)
documentsRoute.post('/:docId/archive', async (c) => {
  const orgId = c.req.param('id')
  const docId = c.req.param('docId')
  if (!orgId || !docId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const role = c.get('role')

  if (!hasPermission(role, 'documents:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const doc = await findOrgDocument(orgId, docId)
  if (!doc) return c.json(NOT_FOUND, 404)

  await db
    .update(chunks)
    .set({ status: 'archived' })
    .where(and(eq(chunks.documentId, docId), eq(chunks.orgId, orgId)))
  await db
    .update(documents)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'document.archive',
    resourceType: 'document',
    resourceId: docId,
    metadata: { filename: doc.filename, previousStatus: doc.status },
  })

  return c.json({ success: true, data: null })
})

// POST /orgs/:id/documents/:docId/unarchive (restores document + chunks to retrieval)
documentsRoute.post('/:docId/unarchive', async (c) => {
  const orgId = c.req.param('id')
  const docId = c.req.param('docId')
  if (!orgId || !docId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const role = c.get('role')

  if (!hasPermission(role, 'documents:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const doc = await findOrgDocument(orgId, docId)
  if (!doc) return c.json(NOT_FOUND, 404)
  if (doc.status !== 'archived') {
    return c.json({ success: false, error: { code: 'CONFLICT', message: 'Document is not archived' } }, 409)
  }

  const restored = await db
    .update(chunks)
    .set({ status: 'active' })
    .where(and(eq(chunks.documentId, docId), eq(chunks.orgId, orgId), eq(chunks.status, 'archived')))
    .returning({ id: chunks.id })

  // A document that never produced chunks (failed ingestion) goes back to
  // failed rather than pretending to be ingested.
  await db
    .update(documents)
    .set({ status: restored.length > 0 ? 'complete' : 'failed', updatedAt: new Date() })
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'document.unarchive',
    resourceType: 'document',
    resourceId: docId,
    metadata: { filename: doc.filename, chunksRestored: restored.length },
  })

  return c.json({ success: true, data: null })
})

// DELETE /orgs/:id/documents/:docId (hard delete — permanent, cascades chunks + ingestion jobs)
documentsRoute.delete('/:docId', async (c) => {
  const orgId = c.req.param('id')
  const docId = c.req.param('docId')
  if (!orgId || !docId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const role = c.get('role')

  if (!hasPermission(role, 'documents:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const doc = await findOrgDocument(orgId, docId)
  if (!doc) return c.json(NOT_FOUND, 404)

  await db.delete(documents).where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'document.delete',
    resourceType: 'document',
    resourceId: docId,
    metadata: { filename: doc.filename, previousStatus: doc.status },
  })

  return c.json({ success: true, data: null })
})

export default documentsRoute
