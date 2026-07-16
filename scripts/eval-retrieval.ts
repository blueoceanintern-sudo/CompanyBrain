/**
 * Retrieval quality eval against scripts/golden-set.json.
 *   bun scripts/eval-retrieval.ts [--out results.json]
 *
 * Requires the local DB running and OPENAI_API_KEY in .env.
 * Metrics:
 *   - answered:  gate passed and chunks returned (answerable questions)
 *   - hit@k:     expected document + content found in returned chunks
 *   - MRR:       mean reciprocal rank of the first correct chunk
 *   - refused:   gate correctly blocked out-of-KB questions
 */
import { db } from '../db/client'
import { orgs, users } from '../db/schema'
import { retrieveChunks } from '../services/retrieval'
import goldenSet from './golden-set.json'

interface GoldenQuestion {
  id: string
  query: string
  expect?: { filename: string; contains: string[] }
  outOfKb?: boolean
}

interface QuestionResult {
  id: string
  query: string
  outOfKb: boolean
  answered: boolean
  hit: boolean
  rank: number | null
  confidence: number
  pass: boolean
}

function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').toLowerCase()
}

async function main() {
  const outFlagIndex = process.argv.indexOf('--out')
  const outPath = outFlagIndex >= 0 ? process.argv[outFlagIndex + 1] : undefined

  const org = (await db.select().from(orgs)).find((o) => o.name === goldenSet.org)
  if (!org) throw new Error(`Org not found: ${goldenSet.org}`)

  const user = (await db.select().from(users)).find((u) => u.email === goldenSet.userEmail)
  if (!user) throw new Error(`User not found: ${goldenSet.userEmail}`)

  const results: QuestionResult[] = []

  for (const q of goldenSet.questions as GoldenQuestion[]) {
    const result = await retrieveChunks({
      orgId: org.id,
      userId: user.id,
      query: q.query,
      accessTier: 'internal',
      userRole: user.role,
    })

    if (!result.success) {
      throw new Error(`Retrieval failed for "${q.id}": ${result.error.message}`)
    }

    const { chunks, confidence } = result.data
    const answered = chunks.length > 0

    let rank: number | null = null
    if (q.expect) {
      const needles = q.expect.contains.map(normalise)
      const expectedFile = normalise(q.expect.filename)
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        if (!chunk) continue
        const content = normalise(chunk.content)
        const fileMatches = normalise(chunk.filename) === expectedFile
        if (fileMatches && needles.some((n) => content.includes(n))) {
          rank = i + 1
          break
        }
      }
    }

    const pass = q.outOfKb ? !answered : rank !== null
    results.push({
      id: q.id,
      query: q.query,
      outOfKb: q.outOfKb ?? false,
      answered,
      hit: rank !== null,
      rank,
      confidence: Number(confidence.toFixed(3)),
      pass,
    })

    const icon = pass ? '✓' : '✗'
    const detail = q.outOfKb
      ? answered
        ? 'answered but should have refused'
        : 'correctly refused'
      : rank !== null
        ? `hit at rank ${rank}`
        : answered
          ? 'answered but expected chunk missing'
          : 'gated ("I don\'t know")'
    console.log(`${icon} [${q.id}] conf=${confidence.toFixed(3)} — ${detail}`)
  }

  const answerable = results.filter((r) => !r.outOfKb)
  const ood = results.filter((r) => r.outOfKb)

  const answeredCount = answerable.filter((r) => r.answered).length
  const hitCount = answerable.filter((r) => r.hit).length
  const mrr =
    answerable.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / (answerable.length || 1)
  const refusedCount = ood.filter((r) => !r.answered).length

  const summary = {
    answerable: {
      total: answerable.length,
      answered: answeredCount,
      hit: hitCount,
      hitRate: Number((hitCount / (answerable.length || 1)).toFixed(3)),
      mrr: Number(mrr.toFixed(3)),
    },
    outOfKb: {
      total: ood.length,
      refused: refusedCount,
      refusalRate: Number((refusedCount / (ood.length || 1)).toFixed(3)),
    },
  }

  console.log('\n─── Summary ───')
  console.log(
    `Answerable: ${answeredCount}/${answerable.length} answered, ` +
      `${hitCount}/${answerable.length} hit expected chunk (hit rate ${summary.answerable.hitRate}), MRR ${summary.answerable.mrr}`
  )
  console.log(
    `Out-of-KB:  ${refusedCount}/${ood.length} correctly refused (refusal rate ${summary.outOfKb.refusalRate})`
  )

  if (outPath) {
    await Bun.write(outPath, JSON.stringify({ summary, results }, null, 2))
    console.log(`\nResults written to ${outPath}`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
