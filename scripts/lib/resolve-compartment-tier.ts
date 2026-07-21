export type AccessTier = 'internal' | 'external'

export interface TierSplitResult {
  majorityTier: AccessTier
  majorityDocIds: string[]
  minorityTier: AccessTier | null
  minorityDocIds: string[]
}

// A compartment holds exactly one tier. Given the documents currently inside
// one, decide which tier it keeps and which documents (if any) need to move
// out to a new sibling compartment. Ties favour 'internal' (the safer default
// — nothing is exposed externally that wasn't already).
export function resolveCompartmentTier(docs: Array<{ id: string; accessTier: AccessTier }>): TierSplitResult {
  const internalDocs = docs.filter((d) => d.accessTier === 'internal')
  const externalDocs = docs.filter((d) => d.accessTier === 'external')

  if (externalDocs.length === 0) {
    return { majorityTier: 'internal', majorityDocIds: internalDocs.map((d) => d.id), minorityTier: null, minorityDocIds: [] }
  }
  if (internalDocs.length === 0) {
    return { majorityTier: 'external', majorityDocIds: externalDocs.map((d) => d.id), minorityTier: null, minorityDocIds: [] }
  }

  return internalDocs.length >= externalDocs.length
    ? { majorityTier: 'internal', majorityDocIds: internalDocs.map((d) => d.id), minorityTier: 'external', minorityDocIds: externalDocs.map((d) => d.id) }
    : { majorityTier: 'external', majorityDocIds: externalDocs.map((d) => d.id), minorityTier: 'internal', minorityDocIds: internalDocs.map((d) => d.id) }
}
