import { rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import type { ServiceResult } from '@company-brain/shared'

// Original uploaded files. Chunks in the DB are the searchable form of a
// document; this is the byte-for-byte original, kept so it can be viewed in its
// original formatting and re-parsed if ingestion needs a retry.
//
// PORTABILITY RULE: a storage key is always relative — `{orgId}/{documentId}`,
// never an absolute path. The driver owns the prefix (a root directory here, a
// bucket under S3), so the same key works unchanged against the filesystem,
// S3, R2, or MinIO. Migrating backends is a file copy plus an env var; nothing
// stored in `documents.storage_key` has to change.

export interface StoredObject {
  body: ReadableStream<Uint8Array>
  sizeBytes: number
}

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const KEY_PATTERN = new RegExp(`^${UUID}/${UUID}$`)
const PREFIX_PATTERN = new RegExp(`^${UUID}$`)

export function documentKey(orgId: string, documentId: string): string {
  return `${orgId}/${documentId}`
}

// ─── Driver resolution ────────────────────────────────────────────────────────

function storageRoot(): string {
  return resolve(process.env.STORAGE_ROOT ?? './.storage')
}

function assertLocalDriver(): void {
  const driver = process.env.STORAGE_DRIVER ?? 'local'
  if (driver === 'local') return
  if (driver === 's3') {
    throw new Error(
      'STORAGE_DRIVER=s3 is not implemented yet. Keys are already S3-compatible — add an S3 driver here (Bun.S3Client needs no extra dependency) and copy the STORAGE_ROOT tree into the bucket.'
    )
  }
  throw new Error(`Unknown STORAGE_DRIVER "${driver}" (expected "local" or "s3")`)
}

// Keys are built from UUIDs we generate, never from user input — but a filename
// that reached this function would be a path traversal, so it is rejected here
// rather than trusted upstream.
function resolveKeyPath(key: string): string {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`Invalid storage key "${key}" (expected "{orgId}/{documentId}")`)
  }
  const root = storageRoot()
  const path = resolve(join(root, key))
  if (path !== root && !path.startsWith(root + sep)) {
    throw new Error(`Storage key "${key}" resolves outside the storage root`)
  }
  return path
}

function storageError(err: unknown): { success: false; error: { code: string; message: string } } {
  const message = err instanceof Error ? err.message : 'Unknown storage error'
  return { success: false, error: { code: 'STORAGE_ERROR', message } }
}

// ─── Operations ───────────────────────────────────────────────────────────────

// `contentType` is recorded on the object by the S3 driver. The local driver
// ignores it — `documents.mime_type` is the authoritative copy either way.
export async function putObject(
  key: string,
  bytes: Buffer,
  _contentType: string
): Promise<ServiceResult<{ key: string; sizeBytes: number }>> {
  try {
    assertLocalDriver()
    await Bun.write(resolveKeyPath(key), bytes, { createPath: true })
    return { success: true, data: { key, sizeBytes: bytes.byteLength } }
  } catch (err) {
    console.error(`[storage] put ${key} failed:`, err)
    return storageError(err)
  }
}

export async function getObject(key: string): Promise<ServiceResult<StoredObject>> {
  try {
    assertLocalDriver()
    const file = Bun.file(resolveKeyPath(key))
    if (!(await file.exists())) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Stored file not found' } }
    }
    return { success: true, data: { body: file.stream(), sizeBytes: file.size } }
  } catch (err) {
    console.error(`[storage] get ${key} failed:`, err)
    return storageError(err)
  }
}

export async function getObjectBuffer(key: string): Promise<ServiceResult<Buffer>> {
  try {
    assertLocalDriver()
    const file = Bun.file(resolveKeyPath(key))
    if (!(await file.exists())) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Stored file not found' } }
    }
    return { success: true, data: Buffer.from(await file.arrayBuffer()) }
  } catch (err) {
    console.error(`[storage] get buffer ${key} failed:`, err)
    return storageError(err)
  }
}

// Deleting an object that is already gone is a success — callers delete the DB
// row and the bytes, and a retry of a half-finished delete must not fail.
export async function deleteObject(key: string): Promise<ServiceResult<null>> {
  try {
    assertLocalDriver()
    await rm(resolveKeyPath(key), { force: true })
    return { success: true, data: null }
  } catch (err) {
    console.error(`[storage] delete ${key} failed:`, err)
    return storageError(err)
  }
}

// Removes every object for one org. Used by the 30-day org purge, where
// leaving files behind would break the permanent-deletion guarantee.
export async function deletePrefix(prefix: string): Promise<ServiceResult<null>> {
  try {
    assertLocalDriver()
    if (!PREFIX_PATTERN.test(prefix)) {
      throw new Error(`Invalid storage prefix "${prefix}" (expected an org ID)`)
    }
    const root = storageRoot()
    const path = resolve(join(root, prefix))
    if (!path.startsWith(root + sep)) {
      throw new Error(`Storage prefix "${prefix}" resolves outside the storage root`)
    }
    await rm(path, { recursive: true, force: true })
    return { success: true, data: null }
  } catch (err) {
    console.error(`[storage] delete prefix ${prefix} failed:`, err)
    return storageError(err)
  }
}
