'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MOCK_USERS } from '@/lib/mock-data'
import { getUsers, inviteUser, updateUserRole } from '@/lib/api'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || process.env.NEXT_PUBLIC_API_URL === undefined

export function useUsers(orgId: string) {
  return useQuery({
    queryKey: ['users', orgId],
    queryFn: async () => {
      if (USE_MOCK) return MOCK_USERS
      const result = await getUsers(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data as typeof MOCK_USERS
    },
    enabled: !!orgId,
  })
}

export function useInviteUser(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { email: string; role: string; temporaryPassword: string }) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600))
        return { id: crypto.randomUUID(), email: data.email, role: data.role }
      }
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
      if (USE_MOCK) return null
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
