'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getUsers, inviteUser, updateUserRole, deleteUser } from '@/lib/api'

export function useUsers(orgId: string) {
  return useQuery({
    queryKey: ['users', orgId],
    queryFn: async () => {
      const result = await getUsers(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useInviteUser(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { email: string; role: string; temporaryPassword: string }) => {
      const result = await inviteUser(orgId, data)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: (_data, variables) => {
      toast.success(`Invite sent to ${variables.email}`)
      qc.invalidateQueries({ queryKey: ['users', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateUserRole(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const result = await updateUserRole(orgId, userId, role)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: () => {
      toast.success('Role updated')
      qc.invalidateQueries({ queryKey: ['users', orgId] })
    },
    onError: () => toast.error('Role update failed'),
  })
}

export function useDeleteUser(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await deleteUser(orgId, userId)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: () => {
      toast.success('User removed')
      qc.invalidateQueries({ queryKey: ['users', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
