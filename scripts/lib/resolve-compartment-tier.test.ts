import { describe, expect, test } from 'bun:test'
import { resolveCompartmentTier } from './resolve-compartment-tier'

describe('resolveCompartmentTier', () => {
  test('all-internal compartment stays internal with no split', () => {
    const result = resolveCompartmentTier([
      { id: 'a', accessTier: 'internal' },
      { id: 'b', accessTier: 'internal' },
    ])
    expect(result).toEqual({
      majorityTier: 'internal',
      majorityDocIds: ['a', 'b'],
      minorityTier: null,
      minorityDocIds: [],
    })
  })

  test('all-external compartment stays external with no split', () => {
    const result = resolveCompartmentTier([{ id: 'a', accessTier: 'external' }])
    expect(result).toEqual({
      majorityTier: 'external',
      majorityDocIds: ['a'],
      minorityTier: null,
      minorityDocIds: [],
    })
  })

  test('empty compartment defaults to internal with no split', () => {
    expect(resolveCompartmentTier([])).toEqual({
      majorityTier: 'internal',
      majorityDocIds: [],
      minorityTier: null,
      minorityDocIds: [],
    })
  })

  test('mixed compartment keeps the majority tier and splits the minority out', () => {
    const result = resolveCompartmentTier([
      { id: 'a', accessTier: 'internal' },
      { id: 'b', accessTier: 'internal' },
      { id: 'c', accessTier: 'internal' },
      { id: 'd', accessTier: 'external' },
    ])
    expect(result).toEqual({
      majorityTier: 'internal',
      majorityDocIds: ['a', 'b', 'c'],
      minorityTier: 'external',
      minorityDocIds: ['d'],
    })
  })

  test('external majority keeps external and splits internal out', () => {
    const result = resolveCompartmentTier([
      { id: 'a', accessTier: 'internal' },
      { id: 'b', accessTier: 'external' },
      { id: 'c', accessTier: 'external' },
    ])
    expect(result).toEqual({
      majorityTier: 'external',
      majorityDocIds: ['b', 'c'],
      minorityTier: 'internal',
      minorityDocIds: ['a'],
    })
  })

  test('a tie favours internal', () => {
    const result = resolveCompartmentTier([
      { id: 'a', accessTier: 'internal' },
      { id: 'b', accessTier: 'external' },
    ])
    expect(result.majorityTier).toBe('internal')
    expect(result.minorityTier).toBe('external')
  })
})
