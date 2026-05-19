'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MOCK_COMPARTMENTS } from '@/lib/mock-data'
import { getCompartments, createCompartment } from '@/lib/api'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || process.env.NEXT_PUBLIC_API_URL === undefined

export function useCompartments(orgId: string) {
  return useQuery({
    queryKey: ['compartments', orgId],
    queryFn: async () => {
      if (USE_MOCK) return MOCK_COMPARTMENTS
      const result = await getCompartments(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data as typeof MOCK_COMPARTMENTS
    },
    enabled: !!orgId,
  })
}

export function useCreateCompartment(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; mode?: string }) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400))
        return { id: crypto.randomUUID(), orgId, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      }
      const result = await createCompartment(orgId, data)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compartments', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
