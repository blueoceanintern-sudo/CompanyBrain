import { describe, expect, test } from 'bun:test'
import {
  INLINE_VIEWABLE_MIME_TYPES,
  UPLOAD_MIME_TYPES,
  visibilityForTier,
} from '@company-brain/shared'
import { contentDispositionHeader } from './documents'

// A document's visibility policy is now always derived from its compartment's
// tier (never chosen independently) — this is the single source of truth for
// that mapping, used at upload and whenever a document moves compartments.
describe('visibilityForTier', () => {
  test('internal tier is restricted to internal roles', () => {
    const policy = visibilityForTier('internal')
    expect(policy.allowedRoles).toEqual(['super_admin', 'org_admin', 'dept_admin', 'staff'])
    expect(policy.allowedRoles).not.toContain('external_client')
    expect(policy.classification).toBe('restricted')
  })

  test('external tier is open to external clients too', () => {
    const policy = visibilityForTier('external')
    expect(policy.allowedRoles).toContain('external_client')
    expect(policy.classification).toBe('public')
  })
})

// Serving an uploaded file back to the browser is the one place user-supplied
// bytes get a Content-Type from us. These rules are what stop that from
// becoming stored XSS against the session cookie.
describe('original file serving rules', () => {
  test('only PDF may render inline; every other accepted type downloads', () => {
    expect(INLINE_VIEWABLE_MIME_TYPES).toEqual(['application/pdf'])
    for (const [extension, mimeType] of Object.entries(UPLOAD_MIME_TYPES)) {
      if (extension === '.pdf') continue
      expect(INLINE_VIEWABLE_MIME_TYPES).not.toContain(mimeType)
    }
  })

  test('the upload allowlist excludes formats the browser would execute', () => {
    for (const extension of ['.html', '.htm', '.svg', '.xhtml', '.js']) {
      expect(UPLOAD_MIME_TYPES[extension]).toBeUndefined()
    }
  })

  test('legacy .doc is excluded — ingestion cannot parse it', () => {
    expect(UPLOAD_MIME_TYPES['.doc']).toBeUndefined()
    expect(UPLOAD_MIME_TYPES['.docx']).toBeDefined()
  })

  test('a filename cannot inject a second response header', () => {
    const header = contentDispositionHeader('evil\r\nSet-Cookie: a=b.pdf', false)
    expect(header).not.toContain('\r')
    expect(header).not.toContain('\n')
  })

  test('a filename cannot escape the quoted ASCII form', () => {
    const header = contentDispositionHeader('a"; x="b.pdf', false)
    const ascii = header.slice(header.indexOf('filename="') + 10, header.indexOf('"; filename*='))
    expect(ascii).not.toContain('"')
  })

  test('non-ASCII filenames survive via the RFC 5987 form', () => {
    const header = contentDispositionHeader('Chính sách.pdf', true)
    expect(header.startsWith('inline;')).toBe(true)
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('Chính sách.pdf')}`)
  })
})
