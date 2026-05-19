'use client'

import { useQuery } from '@tanstack/react-query'
import { MOCK_ANALYTICS_OVERVIEW, MOCK_TOP_UNANSWERED } from '@/lib/mock-data'
import { getAnalyticsOverview, getTopUnanswered } from '@/lib/api'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || process.env.NEXT_PUBLIC_API_URL === undefined

export function useAnalyticsOverview(orgId: string, days: number) {
  return useQuery({
    queryKey: ['analytics-overview', orgId, days],
    queryFn: async () => {
      if (USE_MOCK) return MOCK_ANALYTICS_OVERVIEW
      const result = await getAnalyticsOverview(orgId, days)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useTopUnanswered(orgId: string, days: number) {
  return useQuery({
    queryKey: ['analytics-unanswered', orgId, days],
    queryFn: async () => {
      if (USE_MOCK) return MOCK_TOP_UNANSWERED
      const result = await getTopUnanswered(orgId, days)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}
