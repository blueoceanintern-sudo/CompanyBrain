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
    mutationFn: async (data: { name: string; email: string; role: string; temporaryPassword: string; groupIds?: string[] }) => {
      const result = await inviteUser(orgId, data)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: (_data, variables) => {
      toast.success(`Invite sent to ${variables.email}`)
      qc.invalidateQueries({ queryKey: ['users', orgId] })
      if (variables.groupIds?.length) {
        qc.invalidateQueries({ queryKey: ['groups', orgId] })
        qc.invalidateQueries({ queryKey: ['group-members', orgId] })
      }
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
    onSuccess: (_data, { role }) => {
      toast.success('Role updated')
      qc.invalidateQueries({ queryKey: ['users', orgId] })
      // Demoting to external_client strips the user's group memberships and
      // folder grants server-side; refresh the views that reflect them so the
      // change appears immediately (prefix-matched keys cover per-group / folder).
      if (role === 'external_client') {
        qc.invalidateQueries({ queryKey: ['groups', orgId] })
        qc.invalidateQueries({ queryKey: ['group-members', orgId] })
        qc.invalidateQueries({ queryKey: ['compartment-grants', orgId] })
        qc.invalidateQueries({ queryKey: ['compartments', orgId] })
      }
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
      // Deleting a user cascades their group memberships and folder grants in the
      // DB (ON DELETE CASCADE); refresh every view that reflects them so the
      // removal shows up immediately, not on the next incidental refetch. These
      // keys prefix-match, so the per-group / per-compartment queries are covered.
      qc.invalidateQueries({ queryKey: ['groups', orgId] })              // member counts
      qc.invalidateQueries({ queryKey: ['group-members', orgId] })       // per-group member lists
      qc.invalidateQueries({ queryKey: ['compartment-grants', orgId] })  // per-folder granted users
      qc.invalidateQueries({ queryKey: ['compartments', orgId] })        // grant counts + "no access" nudge
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
