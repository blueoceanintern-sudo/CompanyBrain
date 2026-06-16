'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { submitQuery, getQueryHistory } from '@/lib/api'

export function useQueryHistory(orgId: string) {
  return useQuery({
    queryKey: ['query-history', orgId],
    queryFn: async () => {
      const result = await getQueryHistory(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useSubmitQuery(orgId: string, accessTier: 'internal' | 'external' = 'internal') {
  return useMutation({
    mutationFn: async (query: string) => {
      const result = await submitQuery(orgId, query, accessTier)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
