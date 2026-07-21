/**
 * One-time backfill for the compartments.access_tier column (migration 0009
 * added it nullable). Run after `bun db:migrate` applies 0009, before the
 * follow-up migration that sets it NOT NULL:
 *
 *   bun run scripts/backfill-compartment-tier.ts
 *
 * A compartment now holds exactly one tier (internal or external), never
 * both. For each compartment:
 *   - no documents, or all documents share one tier -> set that tier
 *     directly (empty compartments default to 'internal')
 *   - documents split across both tiers -> split the compartment: the
 *     majority tier keeps the original compartment, the minority tier's
 *     documents (and their chunks) move to a new sibling compartment
 *     ("<name> (External)" / "<name> (Internal)"), same parent.
 */
import { db, compartments, documents, chunks, auditLogs, eq, inArray } from '../db'
import { resolveCompartmentTier } from './lib/resolve-compartment-tier'

async function main() {
  const allCompartments = await db.select().from(compartments)
  const allDocuments = await db
    .select({ id: documents.id, compartmentId: documents.compartmentId, accessTier: documents.accessTier })
    .from(documents)

  const docsByCompartment = new Map<string, typeof allDocuments>()
  for (const doc of allDocuments) {
    const list = docsByCompartment.get(doc.compartmentId) ?? []
    list.push(doc)
    docsByCompartment.set(doc.compartmentId, list)
  }

  let singleTierCount = 0
  let emptyCount = 0
  let splitCount = 0

  for (const compartment of allCompartments) {
    if (compartment.accessTier) continue // already backfilled (safe to re-run)

    const docs = docsByCompartment.get(compartment.id) ?? []
    const { majorityTier, majorityDocIds, minorityTier, minorityDocIds } = resolveCompartmentTier(docs)

    await db.update(compartments).set({ accessTier: majorityTier }).where(eq(compartments.id, compartment.id))

    if (minorityTier === null) {
      if (docs.length === 0) emptyCount++
      else singleTierCount++
      console.log(`[backfill] "${compartment.name}" -> ${majorityTier}${docs.length === 0 ? ' (empty)' : ''}`)
      continue
    }

    // Mixed: majority tier stays, minority tier's documents move to a new sibling.
    const siblingName = `${compartment.name} (${minorityTier === 'external' ? 'External' : 'Internal'})`
    const [sibling] = await db
      .insert(compartments)
      .values({
        orgId: compartment.orgId,
        name: siblingName,
        description: compartment.description,
        restricted: compartment.restricted,
        parentCompartmentId: compartment.parentCompartmentId,
        accessTier: minorityTier,
      })
      .returning()

    if (!sibling) throw new Error(`Failed to create sibling compartment for "${compartment.name}"`)

    await db.update(documents).set({ compartmentId: sibling.id }).where(inArray(documents.id, minorityDocIds))
    await db.update(chunks).set({ compartmentId: sibling.id }).where(inArray(chunks.documentId, minorityDocIds))

    await db.insert(auditLogs).values({
      orgId: compartment.orgId,
      userId: null,
      action: 'compartment.tier_split',
      resourceType: 'compartment',
      resourceId: compartment.id,
      metadata: {
        originalName: compartment.name,
        keptTier: majorityTier,
        keptDocuments: majorityDocIds.length,
        splitIntoCompartmentId: sibling.id,
        splitTier: minorityTier,
        movedDocuments: minorityDocIds.length,
      },
    })

    splitCount++
    console.log(
      `[backfill] "${compartment.name}" was mixed -> kept as ${majorityTier} (${majorityDocIds.length} docs), ` +
        `split ${minorityDocIds.length} ${minorityTier} doc(s) into new compartment "${siblingName}" (${sibling.id})`
    )
  }

  console.log(
    `\n[backfill] done. ${singleTierCount} single-tier, ${emptyCount} empty (defaulted internal), ${splitCount} mixed (split).`
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
