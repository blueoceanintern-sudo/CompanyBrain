import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteObject, deletePrefix, documentKey, getObject, getObjectBuffer, putObject } from './index'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const DOC_1 = '33333333-3333-4333-8333-333333333333'
const DOC_2 = '44444444-4444-4444-8444-444444444444'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'cb-storage-'))
  process.env.STORAGE_ROOT = root
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('storage keys', () => {
  test('a key is org-scoped and relative, so it survives a backend swap', () => {
    // The whole portability story rests on this: no absolute path, no bucket,
    // nothing backend-specific ever reaches documents.storage_key.
    const key = documentKey(ORG_A, DOC_1)
    expect(key).toBe(`${ORG_A}/${DOC_1}`)
    expect(key.startsWith('/')).toBe(false)
  })

  test('path traversal is rejected rather than resolved', async () => {
    const result = await putObject('../../etc/passwd', Buffer.from('x'), 'text/plain')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('STORAGE_ERROR')
  })

  test('a key that is not two UUIDs is rejected', async () => {
    for (const key of [ORG_A, `${ORG_A}/not-a-uuid`, `${ORG_A}/${DOC_1}/extra`, '']) {
      const result = await getObject(key)
      expect(result.success).toBe(false)
    }
  })
})

describe('object round trip', () => {
  test('bytes come back byte-for-byte identical', async () => {
    const key = documentKey(ORG_A, DOC_1)
    const original = Buffer.from('%PDF-1.7\n\x00\x01binary\xff bytes')

    const put = await putObject(key, original, 'application/pdf')
    expect(put.success).toBe(true)

    const got = await getObjectBuffer(key)
    expect(got.success).toBe(true)
    if (got.success) expect(got.data.equals(original)).toBe(true)
  })

  test('getObject reports the size the route sends as Content-Length', async () => {
    const key = documentKey(ORG_A, DOC_2)
    await putObject(key, Buffer.from('twelve bytes'), 'text/plain')

    const got = await getObject(key)
    expect(got.success).toBe(true)
    if (got.success) expect(got.data.sizeBytes).toBe(12)
  })

  test('a missing object is NOT_FOUND, not a crash', async () => {
    const result = await getObject(documentKey(ORG_B, DOC_1))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('deletion', () => {
  test('deleting an already-deleted object succeeds, so a retry is safe', async () => {
    const key = documentKey(ORG_A, DOC_1)
    expect((await deleteObject(key)).success).toBe(true)
    expect((await deleteObject(key)).success).toBe(true)
    expect((await getObject(key)).success).toBe(false)
  })

  test('deletePrefix removes one org and leaves other tenants untouched', async () => {
    const mine = documentKey(ORG_A, DOC_1)
    const theirs = documentKey(ORG_B, DOC_1)
    await putObject(mine, Buffer.from('mine'), 'text/plain')
    await putObject(theirs, Buffer.from('theirs'), 'text/plain')

    const purged = await deletePrefix(ORG_A)
    expect(purged.success).toBe(true)

    expect((await getObject(mine)).success).toBe(false)
    expect((await getObject(theirs)).success).toBe(true)
  })

  test('a non-org prefix cannot be used to purge the whole store', async () => {
    for (const prefix of ['', '.', '..', '*']) {
      const result = await deletePrefix(prefix)
      expect(result.success).toBe(false)
    }
    // The store is intact.
    expect((await getObject(documentKey(ORG_B, DOC_1))).success).toBe(true)
  })
})
