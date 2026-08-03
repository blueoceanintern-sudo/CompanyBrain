'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getRoles, updateRolePermissions } from '@/lib/api'
import type { Permission } from '@company-brain/shared'

export function useRoles(orgId: string) {
  return useQuery({
    queryKey: ['roles', orgId],
    queryFn: async () => {
      const result = await getRoles(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useUpdateRolePermissions(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ role, permissions }: { role: string; permissions: Permission[] }) => {
      const result = await updateRolePermissions(orgId, role, permissions)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      toast.success('Permissions updated')
      qc.invalidateQueries({ queryKey: ['roles', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
