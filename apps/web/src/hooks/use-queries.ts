'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { submitQuery, getQueryHistory } from '@/lib/api'
import type { ConversationTurn } from '@company-brain/shared'

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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ query, history }: { query: string; history?: ConversationTurn[] }) => {
      const result = await submitQuery(orgId, query, accessTier, history)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['query-history', orgId] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
