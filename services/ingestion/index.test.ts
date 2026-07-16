import { describe, expect, test } from 'bun:test'
import { stitchChunks } from './index'

describe('stitchChunks', () => {
  test('removes the chunker overlap between consecutive chunks', () => {
    // Mirror chunkText: the next chunk starts with the previous chunk's last
    // 200 chars followed by '\n\n' and the new paragraph.
    const first = 'para one\n\n' + 'a'.repeat(1900)
    const overlap = first.slice(-200)
    const tail = 'para two ' + 'b'.repeat(100)
    const second = overlap + '\n\n' + tail

    expect(stitchChunks([first, second])).toBe(first + '\n\n' + tail)
  })

  test('tolerates trimmed overlap edges', () => {
    // Trimming during chunking can shave a few leading chars off the overlap;
    // the stitcher should still find the (shorter) suffix-prefix match.
    const first = 'x'.repeat(500) + ' this sentence forms the overlap window between chunks'
    const shavedOverlap = first.slice(-190 + 7) // overlap minus 7 trimmed chars
    const second = shavedOverlap + '\n\nnext paragraph'
    expect(stitchChunks([first, second])).toBe(first + '\n\nnext paragraph')
  })

  test('falls back to paragraph join when chunks do not overlap', () => {
    expect(stitchChunks(['hello world', 'goodbye moon'])).toBe('hello world\n\ngoodbye moon')
  })

  test('handles single and empty inputs', () => {
    expect(stitchChunks(['only chunk'])).toBe('only chunk')
    expect(stitchChunks([])).toBe('')
  })
})
