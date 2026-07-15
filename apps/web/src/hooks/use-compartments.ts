'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getCompartments, createCompartment, updateCompartment, deleteCompartment } from '@/lib/api'

export function useCompartments(orgId: string) {
  return useQuery({
    queryKey: ['compartments', orgId],
    queryFn: async () => {
      const result = await getCompartments(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useCreateCompartment(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; restricted?: boolean }) => {
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

export function useUpdateCompartment(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cId, data }: { cId: string; data: { name?: string; description?: string; restricted?: boolean } }) => {
      const result = await updateCompartment(orgId, cId, data)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: () => {
      toast.success('Compartment updated')
      qc.invalidateQueries({ queryKey: ['compartments', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCompartment(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cId, targetCompartmentId }: { cId: string; targetCompartmentId?: string }) => {
      const result = await deleteCompartment(orgId, cId, targetCompartmentId)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: () => {
      toast.success('Compartment deleted')
      qc.invalidateQueries({ queryKey: ['compartments', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
