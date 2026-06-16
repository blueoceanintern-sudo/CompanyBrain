import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createHash } from 'crypto'
import { db } from '@company-brain/db'
import { documents, ingestionJobs, chunks } from '@company-brain/db'
import { eq, and, desc } from 'drizzle-orm'
import { ingestDocument } from '@company-brain/ingestion'
import { canManageDocuments } from '@company-brain/access-control'
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

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.createdAt))

  return c.json({ success: true, data: rows })
})

// POST /orgs/:id/documents
documentsRoute.post('/', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const role = c.get('role')

  if (!canManageDocuments(role)) {
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

  const defaultVisibility = {
    allowedGroups: ['super_admin', 'org_admin', 'dept_admin', 'staff'] as Parameters<typeof ingestDocument>[0]['visibility']['allowedGroups'],
    deniedGroups: [] as Parameters<typeof ingestDocument>[0]['visibility']['deniedGroups'],
    allowedPrincipals: [],
    classification: 'restricted' as const,
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
    visibility: defaultVisibility,
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

  if (!canManageDocuments(role)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
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

  return c.json({ success: true, data: null })
})

// DELETE /orgs/:id/documents/:docId (soft delete — archives)
documentsRoute.delete('/:docId', async (c) => {
  const orgId = c.req.param('id')
  const docId = c.req.param('docId')
  if (!orgId || !docId) return c.json(BAD_ORG, 400)
  const role = c.get('role')

  if (!canManageDocuments(role)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  await db.update(chunks).set({ status: 'archived' }).where(eq(chunks.documentId, docId))
  await db
    .update(documents)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))

  return c.json({ success: true, data: null })
})

export default documentsRoute
