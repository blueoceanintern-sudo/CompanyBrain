'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getCompartments, createCompartment } from '@/lib/api'

export function useCompartments(orgId: string) {
  return useQuery({
    queryKey: ['compartments', orgId],
    queryFn: async () => {
      const result = await getCompartments(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data as Array<{ id: string; name: string; description?: string | null; mode: string; orgId: string; createdAt: string; updatedAt: string }>
    },
    enabled: !!orgId,
  })
}

export function useCreateCompartment(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; mode?: string }) => {
      const result = await createCompartment(orgId, data)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      toast.success('Compartment created')
      qc.invalidateQueries({ queryKey: ['compartments', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
