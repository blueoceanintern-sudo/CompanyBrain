'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { MOCK_QUERIES } from '@/lib/mock-data'
import { submitQuery, getQueryHistory } from '@/lib/api'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || process.env.NEXT_PUBLIC_API_URL === undefined

export function useQueryHistory(orgId: string) {
  return useQuery({
    queryKey: ['query-history', orgId],
    queryFn: async () => {
      if (USE_MOCK) return MOCK_QUERIES
      const result = await getQueryHistory(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data as typeof MOCK_QUERIES
    },
    enabled: !!orgId,
  })
}

export function useSubmitQuery(orgId: string) {
  return useMutation({
    mutationFn: async ({
      query,
      accessTier,
    }: {
      query: string
      accessTier: 'internal' | 'external'
    }) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1400))
        const lq = query.toLowerCase()
        const hasMock = MOCK_QUERIES.find((q) => q.queryText.toLowerCase().includes(lq.slice(0, 10)))
        if (hasMock) return { answer: hasMock.answer, citations: hasMock.citations, confidence: hasMock.confidence, missing: hasMock.missing }
        return {
          answer: "I don't know — this question is not in the knowledge base.",
          citations: [],
          confidence: 0.28,
          missing: [query],
        }
      }
      const result = await submitQuery(orgId, query, accessTier)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
  })
}
