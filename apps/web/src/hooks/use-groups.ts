'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  setGroupMembers,
  setUserGroups,
  getCompartmentGrants,
  setCompartmentGrants,
} from '@/lib/api'
import type { CompartmentGrantSet } from '@company-brain/shared'

export function useGroups(orgId: string) {
  return useQuery({
    queryKey: ['groups', orgId],
    queryFn: async () => {
      const result = await getGroups(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useCreateGroup(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const result = await createGroup(orgId, data)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      toast.success('Group created')
      qc.invalidateQueries({ queryKey: ['groups', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateGroup(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ gId, data }: { gId: string; data: { name?: string; description?: string } }) => {
      const result = await updateGroup(orgId, gId, data)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: () => {
      toast.success('Group updated')
      qc.invalidateQueries({ queryKey: ['groups', orgId] })
      qc.invalidateQueries({ queryKey: ['users', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteGroup(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (gId: string) => {
      const result = await deleteGroup(orgId, gId)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: () => {
      toast.success('Group deleted')
      qc.invalidateQueries({ queryKey: ['groups', orgId] })
      qc.invalidateQueries({ queryKey: ['users', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useGroupMembers(orgId: string, gId: string | null) {
  return useQuery({
    queryKey: ['group-members', orgId, gId],
    queryFn: async () => {
      const result = await getGroupMembers(orgId, gId!)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId && !!gId,
  })
}

export function useSetGroupMembers(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ gId, userIds }: { gId: string; userIds: string[] }) => {
      const result = await setGroupMembers(orgId, gId, userIds)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: (_data, { gId }) => {
      toast.success('Members updated')
      qc.invalidateQueries({ queryKey: ['group-members', orgId, gId] })
      qc.invalidateQueries({ queryKey: ['groups', orgId] })
      // the users page shows group membership per user
      qc.invalidateQueries({ queryKey: ['users', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSetUserGroups(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, groupIds }: { userId: string; groupIds: string[] }) => {
      const result = await setUserGroups(orgId, userId, groupIds)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: () => {
      toast.success('Groups updated')
      qc.invalidateQueries({ queryKey: ['users', orgId] })
      qc.invalidateQueries({ queryKey: ['groups', orgId] })
      qc.invalidateQueries({ queryKey: ['group-members', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCompartmentGrants(orgId: string, cId: string | null) {
  return useQuery({
    queryKey: ['compartment-grants', orgId, cId],
    queryFn: async () => {
      const result = await getCompartmentGrants(orgId, cId!)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId && !!cId,
  })
}

export function useSetCompartmentGrants(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cId, grants }: { cId: string; grants: CompartmentGrantSet }) => {
      const result = await setCompartmentGrants(orgId, cId, grants)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: (_data, { cId }) => {
      toast.success('Access updated')
      qc.invalidateQueries({ queryKey: ['compartment-grants', orgId, cId] })
      // grantCount on the compartment list feeds the "no access granted" nudge
      qc.invalidateQueries({ queryKey: ['compartments', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
