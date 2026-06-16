'use client'

import { useQuery } from '@tanstack/react-query'
import { getAnalyticsOverview, getTopUnanswered } from '@/lib/api'

export function useAnalyticsOverview(orgId: string, days: number) {
  return useQuery({
    queryKey: ['analytics-overview', orgId, days],
    queryFn: async () => {
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
      const result = await getTopUnanswered(orgId, days)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}
